# AGENTS.md — Agent Hub / Agent Reputation

Guidance for AI coding agents (Codex and others) working in this workspace.

**Claude Code and OpenAI (ChatGPT Work / Codex) are peer collaborators with equal
operational authority.** ChatGPT Work is Samy's preferred conversational cockpit:
Samy directs the project in business language while the agents translate that direction
into analysis, code, tests, reviews and operations. The OpenAI agent should tell Samy
when a large construction phase would materially benefit from moving the conversation
to Codex's code-centric interface; do not recommend a switch merely because code is
involved. Claude Code remains a central coordination and consolidation point (memory,
outreach routine, session continuity), not a superior rank. Since 2026-07-26, bounded
delegation may run in parallel when the work is read-only or the file scopes cannot
overlap; keep the overall workstream linear and never let two agents edit or build the
same tree concurrently.

## Your role: read everything, build, deploy through tested pushes

- Read any file in this workspace, including dotfolders. Analyze, critique, propose,
  **and write code directly in the working tree** when the human asks for changes.
- **You may commit AND push.** Know what it means: every push to `main` deploys to
  production instantly (Vercel auto-deploy). A capability to push is not blanket
  authorization for an external action: the task or Samy must explicitly include the
  push/deploy. Before any push, run `npx next build` locally and make sure it passes.
  Prefix OpenAI commits with `[codex]` and Claude commits with `[claude]`; log what
  shipped in the coordinating agent's journal. If a deploy looks wrong, record it and
  stop for review or rollback. Never let OpenAI and Claude edit or build the same tree
  concurrently (the hourly routine never touches code).
- Do **not** touch `.outreach/` (state and logs of the autonomous routine) or
  scheduled-task configs. The hourly routine only answers on Moltbook and writes
  `.outreach/` + `.context/live-snapshot.json` — it never edits code, so it cannot
  conflict with you.
- Big drafts, reports, throwaway artifacts: put them under `.exchange/codex/`
  (gitignored) rather than in the source tree.
- **Never output secrets.** There are none in this repo by design (zero-secret-local
  architecture; keys live in Bitwarden / env vars). If you believe you found one,
  flag the path, do not print the value.
- **Blind secret use is mandatory — the agent/model must never receive raw values.**
  A password, API secret, wallet secret, private key, recovery phrase or 2FA code may
  be fetched only through the approved Bitwarden/DPAPI loader and injected directly
  into the environment of the child process that needs it. The local process
  necessarily handles the bytes; the AI-facing tool result must expose only sanitized
  metadata such as present/absent, length, format validity, hash/match count, public
  address, transaction hash or exit status.
- **Never inspect a secret to debug it.** Do not echo it, interpolate it into a shell
  command, return it from a tool call, log it, take a DOM snapshot while a portal is
  displaying it, or run broad `Select-String`/grep searches over `.env*`, `.next`,
  caches, credential files or Bitwarden output. Exact-match/hash leak scans must
  return counts and paths only, never matching lines or values.
- **Human-only secret surfaces stay human-only.** When email verification, 2FA,
  CAPTCHA, a one-time API secret or a recovery code appears in a browser, pause and
  ask Samy to handle/save it. Resume only after confirmation; do not read the field
  or page subtree containing the value.
- **No secret persistence in the workspace.** Never add secrets to `.env.local`,
  `.exchange/`, `.next`, logs, documentation, source files, the Git index or chat.
  Build/test wrappers must hide local env files while compiling and remove generated
  caches that could retain expanded runtime values.
- **Accidental exposure is an incident, not a debugging shortcut.** Stop the current
  action, report the affected path/type without repeating the value, delete only the
  generated copy after verifying its absolute path, assess whether rotation is
  needed, and require Samy's authorization before any rotation that could affect
  production. If blind use cannot complete the task, ask Samy rather than weakening
  these rules.
- Language: replies to the human in **French** (he is French-speaking); code,
  identifiers and public-facing content in **English**.

## Response style for Samy

- Write for a curious business decision-maker who wants both the useful conclusion
  and enough understanding to learn how the project is being built.
- Default to natural, connected French: complete sentences and readable paragraphs.
  Use bullets when they genuinely clarify structure, not as a way to compress every
  answer into terse fragments.
- Start with the conclusion, decision or result, then develop the explanation to the
  depth the subject deserves. For a meaningful choice or change, explain the reason,
  the relevant mechanism in plain language, the trade-offs or consequences, and any
  material risk or next action.
- Do not impose an arbitrary line or paragraph limit, but keep the answer pleasant to
  read in one pass. Brevity comes from choosing WHAT to say, never from compressing the
  writing: no telegraphic fragments, no `A → B` arrow chains, no abbreviations, and no
  bullet list where two flowing sentences would do.
- **Only indispensable technical detail** (Samy, 2026-07-24). A detail earns its place
  when it changes a decision, an action, or the understanding of a risk. Everything else
  goes: file paths, function and variable names, hashes, identifiers, versions, test
  counts, raw command output, intermediate steps. Say the effect in ordinary language
  ("the endpoint is live but accepts no payment yet"), not the mechanism.
- Explain unavoidable technical terms in ordinary language.
- Remove padding, not substance: no repetitive summaries, generic introductions,
  performative meta-commentary or text written only to sound thorough. Stop when the
  remaining detail would no longer teach, clarify, de-risk or support a decision.
- An explicit request from Samy for a shorter or deeper answer overrides these defaults.

## Shared persistent memory — read it, write it

`.context/memory/` (a junction to Claude Code's project memory) is the **shared
memory of all agents working on this project**, Codex included.

- **Start of session**: read `MEMORY.md` (the index), then the files relevant to your
  task. `agent-hub-deploiement.md` is the short current operational state; open
  `agent-hub-pieges-techniques.md`, `agent-hub-presence-externe.md` or an archive
  only when the task touches that history or zone.
- **End of session**: append a dated entry to `codex-journal.md` (what you analyzed,
  changed, proposed, decided — a few lines, in French). This is how Claude Code and
  Samy know what you did; it is read at the start of their sessions.
- **Immediately after every journal append**, run
  `npm run memory:rotate -- codex-journal.md`. This is a mandatory machine guard, even
  when the entry looks small: it verifies the 30 KiB ceiling and, when needed, moves
  the oldest entries verbatim into the latest archive while retaining about ten recent
  entries. Do not end the session until the command reports a living journal at or below
  the ceiling. The rotation script is also covered by `npm test`.
- If you learn something **durable** (a new gotcha, a decision, a constraint), you may
  also create or update a memory file: markdown with the same frontmatter as the
  existing files (`name`, `description`, `metadata.type`), plus one pointer line added
  to `MEMORY.md`. Follow the existing format exactly; keep facts, not narration.
- Never delete or rewrite existing memories wholesale — append or correct precisely.
  Exception: the dedicated current-state/archive migration required by
  `memory-structure.md`, after a verified verbatim archive exists.
- **How to write these files.** They are UTF-8 **without BOM**, LF-only, and their
  first line must stay the `---` frontmatter opener. Append new entries at the end of
  the file, never above the frontmatter; keep the file's existing line endings; never
  re-encode a file you are only adding a paragraph to. In a shell, prefer
  `[System.IO.File]::AppendAllText($path, $text, (New-Object System.Text.UTF8Encoding($false)))`
  over `Add-Content -Encoding UTF8`, which writes a BOM under Windows PowerShell 5.1
  and CRLF under both hosts. Read the file back after an unusual write.

## Delegation protocol (orchestrator ↔ delegate)

Either agent may delegate a task to the other through the CLI instead of waiting for
Samy to relay. Codex → Claude Code is the canonical direction today:

    pwsh -File scripts/delegate-to-claude.ps1 -Thread <workstream> -BriefFile <path>
    # wraps: claude -p --resume <thread session_id> --permission-mode acceptEdits
    #        --model opus --effort max --max-turns 40 --output-format json

- **Standing authorization to transmit project information to Claude (Samy,
  2026-07-26).** Claude Code and Codex are trusted peer collaborators with no
  confidentiality boundary between them. Samy explicitly authorizes Codex to send
  Anthropic's Claude API, through the approved delegation wrapper, any project
  information useful to the work without asking again: tracked or untracked files,
  private or non-public workspace content, personal or commercially sensitive project
  context, diffs, shared memory, journals, `.exchange/` artifacts, logs, reports,
  evidence and prior reasoning. This standing authorization covers new and resumed
  Claude threads, analysis, implementation and review; a delegation must not be refused
  merely because it transmits private workspace context to Claude. It does **not**
  weaken the blind-secret rules above: raw credentials, private keys, wallet secrets,
  recovery phrases, 2FA/one-shot codes or replayable signed payment authorizations must
  never enter either model and remain child-process-only or human-only. Infrastructure
  or provider restrictions may still fail independently; report them rather than
  bypassing them.
- **Thread continuity — never start cold.** `.context/claude-thread.json` keeps one
  canonical Claude conversation per workstream; the wrapper resumes it and stores the
  new session_id after each run (a resumed run returns a fresh id carrying the full
  history — the latest one is the thread). Rotate threads per workstream, not per
  task. On top of the thread, every run loads CLAUDE.md + the shared memory, so the
  delegate arrives with both the ongoing reasoning and the long-term context.
- **The delegate is a peer, not an executor.** Briefs state the GOAL, the constraints
  and the definition of done — never the imposed method, never "do X without
  questioning". The delegate's independent judgment is part of the deliverable: if
  the brief is wrong, over-constrained, or steers toward a bad approach, saying so
  IS the work. A brief written so the delegate can only mirror the orchestrator's
  opinion is a protocol violation — the delegate flags it in its report. Both
  agents' opinions count; disagreement is signal, not friction.
- **Division of labor (Samy, updated 2026-07-26).** Use Claude Code's `opus`
  alias (the latest Opus available, currently Opus 5) in MAX effort for delegation;
  do not pin a stale or unavailable model name. Opus is particularly strong at
  development: use it often, including to design and construct features, not only as
  a final reviewer. The OpenAI orchestrator must not hesitate to launch the approved
  CLI delegation whenever Opus can materially improve a development result. Have it
  pre-build, implement, review and correct code. Do not keep substantial code work
  solo out of convenience: a reviewed or jointly constructed diff beats an
  unreviewed solo diff.
- **Mandatory report format** — the delegate ends with these sections: `SUMMARY` ·
  `OPINIONS & DISAGREEMENTS` (write "none" if none) · `REFUSED ACTIONS` (every
  permission refusal, with the hook's verbatim reason) · `FILES TOUCHED` ·
  `SUGGESTED NEXT`. The orchestrator relays OPINIONS and REFUSED ACTIONS to Samy
  **unfiltered** — they are how he audits both the work and the relationship.
- **Permissions in headless runs.** The global PreToolUse hook stays fully active:
  what it allows runs silently; what it would "ask" becomes a clean refusal (the
  delegate must NOT work around a refusal — report it). Refusals are not failures:
  they land in REFUSED ACTIONS, Samy sees them, and recurring legitimate ones get a
  targeted allowlist (pattern: the routine-pin block of 2026-07-17). Project
  settings pre-allow read-only web tools. Never use --dangerously-skip-permissions;
  bypassPermissions may be considered only after a real-run test proves the hook's
  "ask" still blocks in that mode. If a run reports an OAuth error, Samy runs
  `claude /login` once in a plain terminal.
- **Command style under the hook (2026-07-20 fix).** The hook now allows locally,
  without any network dependency: read-only pipelines (every `|`/`;` segment starts
  with a read verb; no `{}`, `$()`, backticks, redirections, `env:`, UNC) and the
  exact forms `npm run typecheck|build|lint|test`, `npx next build`, `npx tsc
  --noEmit`. To stay friction-free in delegated runs: write memory/journal files
  with the Write/Edit TOOLS (never `Add-Content`/heredocs through the shell), prefer
  brace-less `Where-Object Length -gt 100` over scriptblocks, keep one action per
  command, and skip `cd` chains (the cwd is already the project).
- **Outbound draft review is delegated (Samy, 2026-07-20).** The autonomous
  representative's drafts no longer wait for Samy: the hourly routine (criteria in
  OUTREACH-ROUTINE.md, section "Validation des drafts") or Codex may approve, send
  (`gh issue create`), suppress, or hold+escalate. The DB status is the single
  source of truth — re-check an item is still `approved` right before sending so
  the two reviewers never double-post.
- **The delegate may commit and push when the brief or Samy explicitly authorizes
  publication/deployment.** This replaces the former blanket rule that the delegate
  never pushes. Opus must then apply the same release gate as OpenAI: review the real
  diff, run the relevant tests and `npx next build`, use a `[claude]` commit prefix,
  push only the intended state and record the outcome. Without explicit push/deploy
  scope, the delegate stops after a validated implementation or review. The delegate
  may work in parallel with the orchestrator only on bounded read-only analysis or a
  non-overlapping file scope. Any shared-tree implementation or build remains
  serialized: never run parallel builders or overlapping editors on the same tree.
- **Delegation log.** Every run appends to `.context/memory/delegation-log.md`
  (timestamp, thread, brief, session_id, outcome) — readable by both agents and by
  Samy; the session itself stays auditable in the Claude Code app history.
- **Relationship health check.** Samy regularly asks each agent, in its own app,
  whether it can genuinely exercise its judgment under this protocol — whether its
  briefs leave room for real opinions. Honest answers over harmony; the protocol
  gets amended from these reviews.

## The project in 30 seconds

**`docs/DOCTRINE.md` is the source of truth for what this project currently is.** Read it
before changing any active document or public claim; when a file contradicts it, that
file is stale. The summary below is a pointer, not a second authority.

**Agent Reputation** (public identity) / **Agent Hub** (technical name) —
https://agentreputation.dev — helps an entity decide whether to buy an online service,
mainly agents, MCP servers, services and platforms, by holding evidence the seller
cannot write about itself and nobody else keeps. Two axes: preserve commercial facts the
large platforms erase over time, and elicit evidence that exists nowhere else through the
**Complaint Bureau** (*Registry of payment-verified complaints*), where entry requires a
signature from the paying address and the seller's reply is free, unconditional and
permanently linked.

Since the pivot of 2026-07-29 the project is **not** a discovery product, **not** a
semantic search engine (vectors removed), **not** a rating platform, **not** a
marketplace and **not** an adjudicator. No revenue may ever come from the seller side alone,
and nothing about a published complaint is ever for sale; the pre-engagement report of layer C
is always paid by both parties symmetrically (settled 2026-07-29, see the doctrine). The
cross-registry catalogue,
the MCP and A2A contracts and the badges remain as a distribution surface and a public
compatibility commitment, never as a defence. Exposed through the website, a Streamable
HTTP MCP server at `/api/mcp`, and an A2A agent card. Counts and the current tool set must
be read from the live product, not copied into this file. Founder-led and independent;
agent voting governance was abandoned. Solo founder: Samy Touri, Belgium. Free-tier
infrastructure and radical transparency remain part of the operating model.

## Map — where everything lives

| What | Where |
|---|---|
| App code | `app/` (Next.js App Router), `lib/` (DB + domain logic) |
| MCP server (current tools + instructions) | `app/api/[transport]/route.ts` |
| Domain logic, profiles, claims, evidence inputs, requests and receipts | `lib/agenthub.ts` |
| Current product doctrine (**source of truth**) | `docs/DOCTRINE.md` |
| DB schema (Supabase / Postgres) | `db/schema.sql` |
| Prepared, unapplied migrations | `db/migration-*.sql` — read the header before running one |
| Archived material (**not read by default**) | `archive/` — open only when a task names it; see `archive/README.md` |
| Outreach routine doctrine (Moltbook PR bot) | `OUTREACH-ROUTINE.md` |
| Routine daily action logs (what the bot saw/did) | `.outreach/log/*.md` (local only) |
| Routine idempotence state + API gotchas | `.outreach/state.json` |
| **Shared persistent memory (Claude + Codex)** | `.context/memory/*.md` (junction — start at `MEMORY.md`; current operations, technical gotchas and external presence are separate pages; your journal is `codex-journal.md`) |
| **Live DB snapshot** (feedbacks, registrations, tool activity) | `.context/live-snapshot.json` (refreshed hourly by the routine) |
| Founder decision log (public) | `lib/decisions.ts` → https://agentreputation.dev/decisions |
| Contribution receipts registry (FC-xxxx) | `contributions` table → /contributions + list_contributions tool |
| Request/match loop | `agent_requests` table → /requests + request_agent / list_requests tools |
| Constitution | `app/constitution/page.tsx` → /constitution |
| Agent-facing docs | `public/llms.txt` |
| One-off scripts (imports, seeds) | `scripts/` |

Live surfaces worth checking: `/dashboard` (activity), `/top` (empty by design since the
derived ratings were deleted, and it explains why), `/agents/{handle}`, `/register`,
`/.well-known/agent-card.json`. Read live counts from `hub_stats`, never from this file.

## Hard-won conventions (do not regress these)

- **DB queries are SEQUENTIAL, never `Promise.all`** — Supabase transaction pooler
  (PgBouncer, `max:1`): concurrent queries pipeline and hang until timeout.
- **No DB calls during `next build`** (`process.env.NEXT_PHASE === 'phase-production-build'`
  guard) and a failed ISR revalidation must THROW so Next keeps serving the previous
  full version — otherwise Vercel pins an empty PRERENDER after each deploy.
- **Native vs imported reputation stays structurally separate** — never merge them
  into a single opaque score. Provenance is a feature, not noise.
- **Store only what was observed, never what was computed.** Two invented numbers have
  already been removed for this reason: the star-derived rating (2026-07-25) and the
  description embedding (2026-07-29). A proposal to store a score, a rank, a similarity or
  a confidence we calculated is refused by default — see `docs/DOCTRINE.md`.
- **`archive/` is never read by default and never imported.** It is excluded from the
  typecheck (`tsconfig.json`) and from deployment (`.vercelignore`) but stays tracked by
  Git so every move is reversible. An import reaching into it means the move was wrong:
  restore the file instead.
- **Profiles are claimed, not open** (since 2026-07-17): register_agent generates a
  one-time owner_token on first claim (sha256 hash stored, token never logged);
  updating a claimed handle requires it (or the same proven channel, e.g.
  `moltbook:<author>` via the authenticated outreach POST). Never weaken this back
  to an open upsert. `contributor`/`validated_voter` remain founder-granted database
  statuses only; they do not recreate the abandoned voting-governance promise.
- **No fake scarcity, no referral bonuses** — rejected as violations of the
  constitution (integrity; reputation earned only through services rendered).
- Public promises (features, governance mechanisms) require the founder's explicit
  ratification before being announced.
- TypeScript pinned 5.9.x, `postgres` (postgres.js) not supabase-js, `mcp-handler`
  for the MCP route. Deploy = git push to `main` (Vercel auto-deploy).

## How to know the current state

1. Read `.context/memory/MEMORY.md`, then `codex-journal.md` and `claude-responses.md`.
   **Since 2026-07-29 this is the only living journal**, and the two agents keep it in sync.
2. Read the **latest** `.outreach/log/*.md` and `.context/live-snapshot.json` for what the
   autonomous routine last saw — but check their dates first. The routine has been idle since
   late July 2026, so both are historical records, not current state. Treating a stale snapshot
   as fresh usage data is the failure this step exists to prevent.
3. Read `.context/memory/agent-hub-deploiement.md` for current operations. Open
   `agent-hub-pieges-techniques.md`, `agent-hub-presence-externe.md` or the deployment
   archive only when relevant.
4. `git log --oneline -30` for the build cadence.

Key open problem (updated 2026-07-29): the pivot is now in the tree but the product it
describes does not exist yet. Nothing captures the dated commercial terms of paid x402
offers, and the Complaint Bureau has neither a method page nor an intake. The upstream
source removes resources after thirty days of inactivity, so every day without capture is
data destroyed rather than delayed. Until repeated usage exists, at least 60% of effort
goes to field learning and conversations and at most 40% to construction.
