# Archive manifest

## 2026-07-23

### `scripts/test-agent.mjs`

- **Original path:** `scripts/test-agent.mjs`
- **New path:** `archive/2026-07/historical-scripts/test-agent.mjs`
- **Category:** historical to preserve
- **Reason:** the script is the original unauthenticated MCP smoke scenario. It registers two
  handles, discards the one-time owner token, then calls `submit_rating` without the now-required
  `rater_owner_token`; the current API therefore rejects its advertised “complete loop”.
- **Proof of no active use:** no import or exact-path reference exists outside the file; it is not
  named by `package.json`, `vercel.json`, any npm script, the active test suite or project
  documentation. Current rating enforcement is in `lib/agenthub.ts` and
  `app/api/[transport]/route.ts`.
- **Current replacement:** `npm test` covers the maintained automated suites. Runtime MCP behavior
  is exercised through the current API surfaces; a future smoke scenario must retain the
  first-registration token before rating.
- **Restoration:** from the repository root, run
  `git mv archive/2026-07/historical-scripts/test-agent.mjs scripts/test-agent.mjs`, then update it
  for the current owner-token contract before execution.
