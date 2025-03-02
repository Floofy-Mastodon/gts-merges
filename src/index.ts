// noinspection JSUnusedGlobalSymbols

import { MergebotWorkflow } from './workflow';

export { MergebotWorkflow };

export default {
	async scheduled(_event, env, _ctx): Promise<void> {
		let workflow_run = await env.MERGEBOT_WORKFLOW.create();
		console.log(`started workflow ${workflow_run.id}`);
	},
} satisfies ExportedHandler<Env>;
