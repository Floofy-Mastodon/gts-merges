gts-merges
===

Posts new commits to the [GoToSocial](https://github.com/superseriousbusiness/gotosocial)
codebase to the fediverse, as a demo for [botsinbox.net](https://botsinbox.net/). Free to use.

Uses Cloudflare Workers and checks the `.atom` feed for the repo once a minute. Commits in the feed are checked against
keys in KV to determine if they've already been seen, and if not posts them to the fediverse.

Running
---

1. `npm i --include=dev
2. Populate `.dev.vars` with `GTS_TOKEN`, and change `GTS_URL` in `wrangler.toml` if not using botsinbox.net.
3. `npm run dev`

Will get you up and running.

To deploy: `npm run deploy`.
