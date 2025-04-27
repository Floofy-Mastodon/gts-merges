import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
import { Commit } from './types';
import { XMLParser } from 'fast-xml-parser';
import { createRestAPIClient } from 'masto';

// const USER_AGENT = "botsinbox.net/@gts_merges (Cloudflare Worker)";
const USER_AGENT = "curl/8.13.0" // TEMPORARY.
const GITHUB_COMMIT_PREFIX = "tag:github.com,2008:Grit::Commit/";
const CODEBERG_COMMIT_LINK = "https://codeberg.org/superseriousbusiness/gotosocial/commit/";

export class MergebotWorkflow extends WorkflowEntrypoint<Env, Params> {
	async run(_event: WorkflowEvent<any>, step: WorkflowStep) {
		const resp = await step.do("fetch latest commits rss", async () => {
			const resp = await fetch('https://codeberg.org/superseriousbusiness/gotosocial/atom/branch/main', {
					headers: {
						"User-Agent": USER_AGENT
					}
				});
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
					link: `${CODEBERG_COMMIT_LINK}${commit}`
				}});
		});

		const filtered_commits = await step.do("filter existing posted commit ids", async () => {
			const posted = await this.env.COMMITS.list();
			const existingIds = posted.keys.map((x) =>
				// GitHub prefixed commit IDs, but Codeberg does not, so we just drop it.
				x.name.replace(GITHUB_COMMIT_PREFIX, '')
			);
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
						"User-Agent": USER_AGENT
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
