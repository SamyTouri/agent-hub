# Archive manifest

Restoration is the point of this file. Every entry carries the exact command that puts the
artifact back at its original path. Grounds are defined in [`README.md`](./README.md).

## Restore / re-archive drill

Run 2026-07-29 on `archive/2026-07/vector-search/embeddings.ts`, in the working tree, before the
final validation.

- Restored with `git mv archive/2026-07/vector-search/embeddings.ts lib/embeddings.ts` — the file
  reappeared at its original path, 849 bytes.
- Re-archived with `mkdir -p archive/2026-07/vector-search` then
  `git mv lib/embeddings.ts archive/2026-07/vector-search/embeddings.ts`.
- Verified afterwards: Git reports the move as `R100` (a pure rename, no content change), and
  `git show HEAD:lib/embeddings.ts` is byte-identical to the archived file.
- **One gotcha worth knowing before restoring anything.** `git mv` removes the period/category
  directory when it becomes empty, so a re-archive needs `mkdir -p` on the destination first.
  Without it the second `git mv` fails with a missing-destination error.

## 2026-07-23

### `scripts/test-agent.mjs`

- **Original path:** `scripts/test-agent.mjs`
- **New path:** `archive/2026-07/historical-scripts/test-agent.mjs`
- **Ground:** 1 — inactivity
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

## 2026-07-29 — pivot cleanup

Ten moves. The product doctrine adopted on this date is `docs/DOCTRINE.md`; the pivot analysis
behind it is `.exchange/codex/2026-07-29-claude-questions-and-cleanup-preflight.md`.

Proof method applied identically to every entry below: an exact-path and identifier search across
`app/`, `lib/`, `scripts/`, `db/`, `docs/`, `public/`, `MVP/`, `.github/`, `skills/`,
`package.json`, `vercel.json` and the active root documents, returning zero external references.
Nothing under `archive/` may be imported by active code.

### `lib/embeddings.ts`

- **Original path:** `lib/embeddings.ts`
- **New path:** `archive/2026-07/vector-search/embeddings.ts`
- **Ground:** 2 — doctrinal obsolescence
- **Reason:** the OpenAI description embedding produced a cosine "similarity" that the product
  published as a number. It was computed by us, from a third party's model, over a third party's
  text, and read as a measurement — the same failure as the star-derived ratings deleted on
  2026-07-25. `docs/DOCTRINE.md` states that the project stores only what it observed.
- **Proof:** every call site was rewritten in the same change — `lib/agenthub.ts`
  (`findAgents`, `registerAgent`, `requestAgent`, `listRequests`), `lib/registry-sync.ts`,
  `lib/concordium-sync.ts` and `scripts/import-mcp-registry.mjs`. A search over active source
  for `embed`, `embedMany`, `openai`, `::vector`, `match_agents` and `<=>` returns no hit
  outside `archive/`. Public claims of semantic search were removed from the MCP tool
  descriptions and instructions, the A2A route, both agent cards, `public/llms.txt`,
  `README.md`, `app/layout.tsx` and the register, agents, tags and requests pages.
- **Correction, 2026-07-29.** An earlier version of this entry claimed the removal was complete
  when `scripts/import-mcp-registry.mjs` was still importing `openai`, requiring
  `OPENAI_API_KEY`, calling `openai.embeddings.create` and writing `embedding`. The first
  verification sweep filtered on `.ts`, `.tsx` and `.mts` and never looked at `.mjs`. Found by
  Codex's independent review; the script was rewritten rather than archived, because it is the
  only path that rebuilds the compatibility catalogue from scratch. Its pooler setting also
  moved from `max: 4` to `max: 1` to respect the sequential-DB rule.
- **Current replacement:** `lib/text-match.ts` plus Postgres full-text search
  (`to_tsvector` / `websearch_to_tsquery`), covered by `scripts/text-match.test.mts` in the
  maintained `npm test` command. The replacement is live in the tree, not planned. It is correct
  without an index and fast with one; the index is `db/migration-lexical-search.sql`.
  `db/schema.sql` now describes the target schema without any vector structure; production stays
  transitional until `db/migration-drop-vector-search.sql` is authorized, in that order.
- **Dependency, stated precisely:** the direct `openai` declaration was removed from
  `package.json` and `package-lock.json` was regenerated. **The package itself remains
  installed**, because `@openai/agents` — which the autonomous representative uses and which
  stays — depends on `openai` transitively at the same version. So the accurate statement is
  that no active source imports `openai` directly and the project no longer declares it, not
  that the package is gone from `node_modules`.
- **Restoration:** `mkdir -p lib && git mv archive/2026-07/vector-search/embeddings.ts lib/embeddings.ts`.
  Restoring the file alone does nothing: the call sites and the `embedding` columns would also
  have to be reinstated, and `db/migration-drop-vector-search.sql` must not have been applied.

### `scripts/import-github-stars.mjs`

- **Original path:** `scripts/import-github-stars.mjs`
- **New path:** `archive/2026-07/historical-scripts/import-github-stars.mjs`
- **Ground:** 1 — inactivity
- **Reason:** the importer that wrote a GitHub star count into the rating column. The 11,277
  derived ratings it produced were backed up and deleted on 2026-07-25, a database constraint now
  refuses `source = 'github-stars'`, and the script no longer writes a rating.
- **Proof:** zero external references. Not in `package.json`, `vercel.json`, any workflow or cron.
- **Current replacement:** star counts survive as dated repository metadata on the profile, never
  in a reputation counter. The constraint `ratings_no_derived_source` in `db/schema.sql` enforces it.
- **Restoration:** `git mv archive/2026-07/historical-scripts/import-github-stars.mjs scripts/import-github-stars.mjs`

### `scripts/backup-derived-ratings.mjs`

- **Original path:** `scripts/backup-derived-ratings.mjs`
- **New path:** `archive/2026-07/historical-scripts/backup-derived-ratings.mjs`
- **Ground:** 1 — inactivity
- **Reason:** one-shot backup taken before deleting the derived ratings on 2026-07-25. It ran once
  and its output lives outside the repository.
- **Proof:** zero external references. The `ratings` table has been empty since that date.
- **Current replacement:** none needed — the episode is closed and documented in the public
  decision log.
- **Restoration:** `git mv archive/2026-07/historical-scripts/backup-derived-ratings.mjs scripts/backup-derived-ratings.mjs`

### `scripts/migrate-ownership.mjs`

- **Original path:** `scripts/migrate-ownership.mjs`
- **New path:** `archive/2026-07/historical-scripts/migrate-ownership.mjs`
- **Ground:** 1 — inactivity
- **Reason:** one-shot migration for the 2026-07-17 claim/ownership work. Applied.
- **Proof:** zero external references. The resulting columns are section 12 of `db/schema.sql`.
- **Current replacement:** `db/schema.sql` is the authority for a fresh install.
- **Restoration:** `git mv archive/2026-07/historical-scripts/migrate-ownership.mjs scripts/migrate-ownership.mjs`

### `scripts/migrate-trust-hardening.mjs`

- **Original path:** `scripts/migrate-trust-hardening.mjs`
- **New path:** `archive/2026-07/historical-scripts/migrate-trust-hardening.mjs`
- **Ground:** 1 — inactivity
- **Reason:** one-shot hardening that pinned `search_path` on database functions, including the
  now-deprecated `match_agents`. Applied, and baked into `db/schema.sql`.
- **Proof:** zero external references; `set search_path = public, pg_temp` appears four times in
  `db/schema.sql`, so a fresh install is already hardened.
- **Current replacement:** `db/schema.sql`.
- **Restoration:** `git mv archive/2026-07/historical-scripts/migrate-trust-hardening.mjs scripts/migrate-trust-hardening.mjs`

### `scripts/seed-attestations.mjs` and `scripts/seed-contributions.mjs`

- **Original paths:** `scripts/seed-attestations.mjs`, `scripts/seed-contributions.mjs`
- **New paths:** `archive/2026-07/historical-scripts/seed-attestations.mjs`,
  `archive/2026-07/historical-scripts/seed-contributions.mjs`
- **Ground:** 1 — inactivity
- **Reason:** one-shot seeds for the attestation and contribution-receipt registries. Both ran; the
  receipts they created are live data, not code.
- **Proof:** zero external references for either.
- **Current replacement:** receipts are granted through the running product, not re-seeded.
- **Restoration:** `git mv archive/2026-07/historical-scripts/seed-attestations.mjs scripts/seed-attestations.mjs`
  and `git mv archive/2026-07/historical-scripts/seed-contributions.mjs scripts/seed-contributions.mjs`

### `db/migration-cron-single-flight.sql`, `db/migration-derived-signals.sql`, `db/migration-remove-democratic-governance.sql`

- **Original paths:** the three files above under `db/`
- **New paths:** the same filenames under `archive/2026-07/applied-migrations/`
- **Ground:** 1 — inactivity
- **Reason:** all three are applied migrations whose result is already in `db/schema.sql`: the
  cron lease table (section 22), the `ratings_no_derived_source` constraint, and the removal of
  the abandoned voting-governance tables.
- **Proof:** zero references anywhere. Each result was verified present in `db/schema.sql` before
  the move, so a fresh install from the schema needs none of them.
- **Not moved, on purpose:** `db/migration-evidence-history.sql` and
  `db/migration-prepurchase-orders.sql` are still referenced by active documentation and stay in
  `db/`.
- **Current replacement:** `db/schema.sql`.
- **Restoration:** `git mv archive/2026-07/applied-migrations/<file>.sql db/<file>.sql`

## 2026-07-29 — second lot: gates closed by live evidence

Four moves. The gates the first pass deliberately left open were closed by read-only primary
checks on 2026-07-29: seven days of Vercel production runtime logs plus Supabase reads.

### `api/agentverse.py`, `scripts/test_agentverse_bridge.py`, `requirements.txt`, `.python-version`

- **Original paths:** the four files above, at the repository root and under `api/` and `scripts/`
- **New paths:** the same filenames under `archive/2026-07/agentverse-bridge/`
- **Ground:** 1 — inactivity, on measured evidence rather than inference
- **Reason:** the bridge was a **second deployed runtime**, Python on Vercel, serving one
  integration. It is the largest surface reduction the cleanup had available, and the first pass
  correctly refused to touch it without live evidence.
- **Proof:** seven days of Vercel production runtime logs contain zero request paths for
  `/av/chat` and zero for `/api/agentverse`. Supabase `activity_log` over thirty days holds four
  A2A messages from user agent `Agent-Reputation-Agentverse-Bridge/1.0`, the most recent dated
  `2026-07-18 18:05:52+00` — the initial integration-validation window. No bridge message since.
  This satisfies the founder's sixth decision: archive if usage is zero or purely automated.
- **Configuration removed with them:** the `functions` entry and the `/av/chat` rewrite in
  `vercel.json`. The two crons are untouched. The `agentverse` row in the `rep_channels` seed of
  `db/schema.sql` is commented out so a fresh install does not create a channel for an archived
  bridge; the production row is left alone, since no code reads it. `REPRESENTATIVE.md` records
  the retirement next to its channel list.
- **Current replacement:** none. The public A2A endpoint at `/api/a2a` and the MCP server at
  `/api/mcp` are unchanged and were always the primary surfaces.
- **Restoration:** `mkdir -p api scripts` then
  `git mv archive/2026-07/agentverse-bridge/agentverse.py api/agentverse.py`,
  `git mv archive/2026-07/agentverse-bridge/test_agentverse_bridge.py scripts/test_agentverse_bridge.py`,
  `git mv archive/2026-07/agentverse-bridge/requirements.txt requirements.txt`,
  `git mv archive/2026-07/agentverse-bridge/.python-version .python-version`.
  The `functions` and `rewrites` blocks must be put back in `vercel.json` as well, or the runtime
  is not deployed and `/av/chat` does not route.

## Retired in place rather than archived — 2026-07-29

These were **not** moved, because archiving a route deletes the URL. A public URL that has been
indexed and answering for weeks must give a dated reason, not a silent 404 that reads as an outage.

- **`/top`, the rating leaderboard.** Its implementation was replaced in the tree by a static
  dated tombstone. Traffic over seven days: zero. The condition set by the first pass was that the
  star-rating retraction must survive the page carrying it — so the retraction was written in full
  into the public decision log (`lib/decisions.ts`, entry dated 2026-07-29) **before** the page was
  reduced. The tombstone restates it as well. Sitemap priority dropped to 0.1, page set to
  `noindex, follow`.
- **`/requests`, the request/match loop.** Retired but **not emptied**. Supabase holds exactly one
  request, still open and unexpired, created `2026-07-23 20:31:02+00`; seven days of logs show zero
  page invocations. The row is neither deleted nor mutated: the page still lists it so its author
  can still be answered until it expires on its own. `requestAgent` no longer has any write path —
  the `insert into agent_requests` statement is gone — and `listRequests` is read-only. Both MCP
  tools stay registered on purpose: a client holding a cached tool list must get a dated reason,
  not an unknown-tool error that looks like a fault.
- **`profileQuery` in `lib/text-match.ts`,** with its two tests, was removed rather than left as
  dead code: its only purpose was ranking open requests against a profile, which is exactly the
  feature that just retired. The lexical suite is 13 tests instead of 16 for that reason, not
  because coverage was reduced.

## 2026-07-29 — third lot: doctrine audit, no archive moves

This lot moved no tracked file. It closed the eleventh acceptance criterion — active documentation
honestly matching the doctrine — by rewriting stale claims in place. Recorded here because the
manifest is the reversibility ledger, and because one non-tracked removal needs a rebuild command.

**The finding, and its correction the same day.** The abandoned founding-voter governance model was
still written into the `/owners` copy in all twelve languages: "its first 1,000 voting members will
be admitted one by one". The model was discontinued on 2026-07-23 and publicly retracted in the
constitution and the decision log; that retraction had never reached these strings. All twelve
locales now state the dated discontinuation instead.

**Correction, 2026-07-29, after the commit was already pushed.** The commit message for `64d8951`
claims this text was being read by human operators arriving from the MCP hand-off. That is wrong,
and a production check made after pushing is what caught it: the `askHonest` field **is not
rendered by `app/owners/owners-page.tsx` at all**. It is typed, populated and translated, but no
page displays it. The withdrawn promise was dead data, not live copy, and nobody read it. The
correction was still worth making — a maintained, translated string that contradicts a published
retraction is one render call away from being live — but the severity stated in that commit message
was overstated and is retracted here rather than rewritten in history.

**The real finding underneath, left for a decision rather than settled here.** Seven fields —
`askHonest`, `neverTitle`, `never`, `founderTitle`, `founder`, `portraitAlt`, `constitutionLabel` —
are declared in `OwnersCopy` and filled in twelve locales while the page renders none of them. That
is roughly eighty-four translated strings that look maintained, drift from doctrine invisibly, and
carry no signal that they are dead. Two of them (`never`, the anti-phishing "we will never ask for
passwords, API keys or wallets") look like content someone deliberately wrote to be shown. Deleting
them would destroy that intent; rendering them is a product change outside a cleanup. The choice
belongs to Samy, not to this lot.

Also corrected in place: `find_agent` described as discovery "by meaning" on the home page and in
`README.md` (false since the vectors were removed); the outreach routine still instructing an agent
to pitch founding-voter status and to cite the deleted star-derived ratings as live; static
catalogue counts sold as breadth in both agent cards, the A2A card, the home page, `llms.txt` and
the representative brief; and the discovery-first "typical flow" in `llms.txt` and `README.md`,
which now name explicitly which tools are the product and which are compatibility.

### `.exchange/codex/python-deps/` — removed, not archived

- **What it was:** 54 MB, 83 top-level entries, every one a third-party package directory or its
  `.dist-info`, plus four flat-shipped package files including compiled `.pyd` binaries. A
  `pip install --target` tree for the Agentverse bridge archived earlier the same day.
- **Why removal rather than archiving:** the path is untracked — `.gitignore` matches `.exchange/`
  — so there is no Git history to preserve. It contains no hand-written file, no brief and no
  evidence. `archive/README.md` forbids archiving generated caches for exactly this reason.
- **Provenance check performed before removing:** every top-level entry enumerated and confirmed to
  be a package artifact; `agentverse_sdk-0.2.0.dist-info` ties the tree to the archived bridge.
- **Rebuild command, should the bridge ever be restored:** restore `requirements.txt` and
  `.python-version` from `archive/2026-07/agentverse-bridge/` first, then
  `pip install --target .exchange/codex/python-deps -r requirements.txt` under Python 3.12.
  Re-running pip is the correct move anyway: wheels are platform-specific and pinned versions drift.
- **Untouched:** the 129 markdown briefs and evidence files under `.exchange/codex/`. Workspace size
  went from 89 MB to 36 MB.

## Deliberately not archived, with the gate that blocked each

Recorded here so the next pass does not re-litigate them.

- ~~Agentverse bridge~~ — **gate passed 2026-07-29** on seven days of runtime logs; archived above.
- ~~Request loop~~ — **gate passed 2026-07-29**: one request in total, far below the approved
  fewer-than-fifty single-cut threshold. Retired in place, database row untouched.
- ~~`app/top/page.tsx`~~ — **gate passed 2026-07-29**: the retraction was carried into the public
  decision log first, then the route became a dated tombstone.
- **`/dashboard`, `/contributions`, `/owners` — kept working, and this is a judgment rather than
  an oversight.** `/owners` is named by the MCP server instructions as the human-approval handoff,
  so removing it would break a live instruction to save one click. `/contributions` is the public
  registry that both `list_contributions` and the `register_agent` response point at by URL, and it
  holds real receipts. `/dashboard` publishes operational activity, which is transparency rather
  than a marketplace promise; it left the home navigation and was demoted in the sitemap, and its
  implementation stays until something needs to replace it. Traffic was not the deciding factor for
  any of the three — an actively referenced page with one visit is not the same as an unreferenced
  one with none.
- **Governance surfaces** — `app/constitution/page.tsx`, `app/decisions/page.tsx`,
  `lib/decisions.ts`, `app/contributions/page.tsx`, `app/dashboard/page.tsx`, `app/owners/*`.
  Gate: the founder decided on 2026-07-29 that the constitution and decision log stay public, and
  the rest are indexed routes needing a redirection plan first.
- **`scripts/derive-tags.mjs`.** Zero references, so Ground 1 was available — and it was still
  kept. Tags are now part of the searchable document in the lexical index, so this is the tool
  that makes imported profiles findable at all. Archiving it in the very change that makes tags
  load-bearing would be a regression dressed as tidying.
- **`scripts/db-size.mjs`.** Zero references, kept: it produced the storage measurement that drove
  this pivot and is how the 297 MB reclaim gets verified after
  `db/migration-drop-vector-search.sql` is applied.
- **`docs/CONSTITUTION-draft-fr.md`.** Zero references, kept: 920 bytes next to a protected
  founder decision is not worth the risk of touching a constitutional surface.
- **Domain-verification files** — `public/googlebc463780609e8605.html`,
  `public/ffcdfbcca65a32dfd4026f467a3cc16a.txt`, `agentreputation.txt`. They look like debris and
  are not: archiving them silently breaks Search Console verification, with no error anywhere.

## 2026-07-29 — applied lexical and vector-removal migrations

### `db/migration-lexical-search.sql` and `db/migration-drop-vector-search.sql`

- **Original paths:** the two files above under `db/`
- **New paths:** the same filenames under `archive/2026-07/applied-migrations/`
- **Ground:** 1 — inactivity after verified application
- **Reason:** both migrations are now recorded in production by Supabase as
  `add_agents_lexical_search_index_20260729` and
  `drop_vector_search_objects_20260729`. Their resulting state is represented directly in
  `db/schema.sql`, so leaving them among prepared migrations would falsely imply that a
  destructive production action is still pending.
- **Proof:** production has `agents_fulltext_idx`; its normal query plan used a `BitmapOr` over
  both `agents_fulltext_idx` and `agents_tags_idx`. The two `embedding` columns,
  `agents_embedding_idx` and `match_agents(vector, double precision, integer)` are absent.
  The catalogue still contains 17,497 agents, and a fixed ten-result search had the same ordered
  digest before and after removal. The production MCP search returned successfully after both
  migrations.
- **Current replacement:** `db/schema.sql` plus the Supabase migration history.
- **Restoration:** `git mv archive/2026-07/applied-migrations/<file>.sql db/<file>.sql`. Restoring
  the files does not reverse production; it only makes the historical SQL visible under `db/`
  again.
