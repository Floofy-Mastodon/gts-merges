import { XMLParser } from 'fast-xml-parser';
import { createRestAPIClient } from "masto";

export interface Env {
	COMMITS: KVNamespace;
	GTS_URL: string;
	GTS_TOKEN: string;
}

type Commit = {
	id: string,
	title: string,
	author: string,
	commit: string,
	link: string
};

export default {
	async scheduled(_event, env, _ctx): Promise<void> {
		const resp = await fetch('https://github.com/superseriousbusiness/gotosocial/commits/main.atom');
		const atom = await resp.text();
		const parser = new XMLParser();
		const feed = parser.parse(atom);

		// Collect recent commits.
		const commits: Commit[] = feed.feed.entry.map((x: any) => {
			const commit = x.id.split('/').slice(-1)[0];
			return {
				id: x.id,
				// Replace hashtags so they don't link.
				title: x.title.replace('\#', '\\\#'),
				author: x.author.name,
				commit: commit,
				link: `https://github.com/superseriousbusiness/gotosocial/commit/${commit}`
		}});


		const posted = await env.COMMITS.list();
		const existingIds = posted.keys.map((x) => x.name);
		const filtered = commits.filter((commit) => {
			return !existingIds.includes(commit.id);
		});

		const gtsClient = createRestAPIClient({
			url: env.GTS_URL,
			accessToken: env.GTS_TOKEN,
			requestInit: {
				headers: {
					"User-Agent": "gts-merges worker",
				},
			},
		});

		for (const commit of filtered) {
			const status = await gtsClient.v1.statuses.create({
				status: `${commit.title} by ${commit.author} has been merged!\n\n[${commit.commit}](${commit.link})`,
			});
			await env.COMMITS.put(commit.id, status.id);
			console.log(`Posted ${status.url} for ${commit.id}`);
		}

	},
} satisfies ExportedHandler<Env>;
