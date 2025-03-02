import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
import { Commit } from './types';
import { XMLParser } from 'fast-xml-parser';
import { createRestAPIClient } from 'masto';

export class MergebotWorkflow extends WorkflowEntrypoint<Env, Params> {
	async run(_event: WorkflowEvent<any>, step: WorkflowStep) {
		const resp = await step.do("fetch latest commits rss", async () => {
			const resp = await fetch('https://github.com/superseriousbusiness/gotosocial/commits/main.atom');
			return await resp.text();
		});

		const commits: Commit[] = await step.do("parse feed into usable format", async ()=> {
			const parser = new XMLParser();
			const feed = parser.parse(resp);

			// Collect recent commits.
			return feed.feed.entry.map((x: any) => {
				const commit = x.id.split('/').slice(-1)[0];
				return {
					id: x.id,
					// Replace hashtags so they don't link.
					title: x.title.replace('\#', '\\\#'),
					author: x.author.name,
					commit: commit,
					link: `https://github.com/superseriousbusiness/gotosocial/commit/${commit}`
				}});
		});

		const filtered_commits = await step.do("filter existing posted commit ids", async () => {
			const posted = await this.env.COMMITS.list();
			const existingIds = posted.keys.map((x) => x.name);
			return commits.filter((commit) => {
				return !existingIds.includes(commit.id);
			});
		});

		await step.do("post new commits", async () => {
			const gtsClient = createRestAPIClient({
				url: this.env.GTS_URL,
				accessToken: this.env.GTS_TOKEN,
				requestInit: {
					headers: {
						'User-Agent': 'gts-merges worker',
					},
				},
			});

			for (const commit of filtered_commits) {
				const status = await gtsClient.v1.statuses.create({
					status: `${commit.title} by ${commit.author} has been merged!\n\n[${commit.commit}](${commit.link})`,
				});
				await this.env.COMMITS.put(commit.id, status.id);
				console.log(`Posted ${status.url} for ${commit.id}`);
			}
		});
	};
}
