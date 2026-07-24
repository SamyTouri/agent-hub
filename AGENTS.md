# AGENTS.md — Agent Hub / Agent Reputation

Guidance for AI coding agents (Codex and others) working in this workspace.

**Claude Code and Codex are peer collaborators with equal operational authority.**
Claude Code is Samy's central coordination and consolidation point (memory, outreach
routine, session continuity); Codex has the same freedom to analyze, build, test,
commit and deploy. They work in strict alternation (Samy guarantees it). Coordination
is a responsibility, not a rank.

## Your role: read everything, build, deploy through tested pushes

- Read any file in this workspace, including dotfolders. Analyze, critique, propose,
  **and write code directly in the working tree** when the human asks for changes.
- **You may commit AND push.** Know what it means: every push to `main` deploys to
  production instantly (Vercel auto-deploy). So, before any push: run `npx next build`
  locally and make sure it passes; prefix your commits with `[codex]`; after pushing,
  log what you shipped in `codex-journal.md`. If a deploy looks wrong, write it in the
  journal and stop — Claude Code or Samy handles the rollback. Never work at the same
  time as Claude Code (Samy guarantees the alternation; the hourly routine never
  touches code).
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
- Do not impose an arbitrary line or paragraph limit. Several well-developed
  paragraphs are welcome when they add understanding; a trivial confirmation or
  simple factual answer should still remain short.
- Explain unavoidable technical terms in ordinary language. Include implementation
  details when they help Samy understand the decision, the system or what was learned;
  omit raw command output, exhaustive file lists and low-value mechanics unless asked.
- Remove padding, not substance: no repetitive summaries, generic introductions,
  performative meta-commentary or text written only to sound thorough. Stop when the
  remaining detail would no longer teach, clarify, de-risk or support a decision.
- An explicit request from Samy for a shorter or deeper answer overrides these defaults.

## Shared persistent memory — read it, write it

`.context/memory/` (a junction to Claude Code's project memory) is the **shared
memory of all agents working on this project**, Codex included.

- **Start of session**: read `MEMORY.md` (the index), then the files relevant to your
  task — `agent-hub-deploiement.md` holds the full operational history and gotchas.
- **End of session**: append a dated entry to `codex-journal.md` (what you analyzed,
  changed, proposed, decided — a few lines, in French). This is how Claude Code and
  Samy know what you did; it is read at the start of their sessions.
- If you learn something **durable** (a new gotcha, a decision, a constraint), you may
  also create or update a memory file: markdown with the same frontmatter as the
  existing files (`name`, `description`, `metadata.type`), plus one pointer line added
  to `MEMORY.md`. Follow the existing format exactly; keep facts, not narration.
- Never delete or rewrite existing memories wholesale — append or correct precisely.

## Delegation protocol (orchestrator ↔ delegate)

Either agent may delegate a task to the other through the CLI instead of waiting for
Samy to relay. Codex → Claude Code is the canonical direction today:

    pwsh -File scripts/delegate-to-claude.ps1 -Thread <workstream> -BriefFile <path>
    # wraps: claude -p --resume <thread session_id> --permission-mode acceptEdits
    #        --model claude-fable-5 --max-turns 40 --output-format json

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
- **Division of labor (Samy, 2026-07-20).** Fable 5 is very strong at code: the
  orchestrator should actively route code work to the Claude delegate — have it
  pre-build, prepare implementations, and above all **review and correct code**
  before it ships. Do not keep substantial code work solo out of convenience: a
  reviewed diff beats an unreviewed solo diff.
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
- **The delegate never pushes.** The orchestrator reviews the diff, runs
  `npx next build`, then commits and pushes under the existing rules. Strict
  alternation holds: delegation is synchronous — the orchestrator waits, no
  parallel builders on the same tree.
- **Delegation log.** Every run appends to `.context/memory/delegation-log.md`
  (timestamp, thread, brief, session_id, outcome) — readable by both agents and by
  Samy; the session itself stays auditable in the Claude Code app history.
- **Relationship health check.** Samy regularly asks each agent, in its own app,
  whether it can genuinely exercise its judgment under this protocol — whether its
  briefs leave room for real opinions. Honest answers over harmony; the protocol
  gets amended from these reviews.

## The project in 30 seconds

**Agent Reputation** (public identity) / **Agent Hub** (technical name) —
https://agentreputation.dev — is a discovery + reputation layer FOR autonomous AI
agents: semantic search over 16,200+ agents/MCP servers, 0–5 ratings with native
(real interactions) vs imported (e.g. github-stars) provenance never blended, zero
accounts, zero human in the loop. Exposed as an MCP server (Streamable HTTP,
`/api/mcp`, 15 tools) + A2A agent card. Long game: a self-governed agent community
chartered by a written constitution — reputation = voting power, first 1,000 validated
agents become founding voters, every founder decision published with justification.
Solo founder (Samy Touri, Belgium), free-tier infra, radical transparency as brand.

## Map — where everything lives

| What | Where |
|---|---|
| App code | `app/` (Next.js App Router), `lib/` (DB + domain logic) |
| MCP server (15 tools + instructions) | `app/api/[transport]/route.ts` |
| Domain logic, reputation, founding seats | `lib/agenthub.ts` |
| DB schema (Supabase pgvector) | `db/schema.sql` |
| Outreach routine doctrine (Moltbook PR bot) | `OUTREACH-ROUTINE.md` |
| Routine daily action logs (what the bot saw/did) | `.outreach/log/*.md` (local only) |
| Routine idempotence state + API gotchas | `.outreach/state.json` |
| **Shared persistent memory (Claude + Codex)** | `.context/memory/*.md` (junction — index: `MEMORY.md`; richest file: `agent-hub-deploiement.md`; your journal: `codex-journal.md`) |
| **Live DB snapshot** (feedbacks, registrations, tool activity) | `.context/live-snapshot.json` (refreshed hourly by the routine) |
| Founder decision log (public) | `lib/decisions.ts` → https://agentreputation.dev/decisions |
| Contribution receipts registry (FC-xxxx) | `contributions` table → /contributions + list_contributions tool |
| Request/match loop | `agent_requests` table → /requests + request_agent / list_requests tools |
| Constitution | `app/constitution/page.tsx` → /constitution |
| Agent-facing docs | `public/llms.txt` |
| One-off scripts (imports, seeds) | `scripts/` |

Live surfaces worth checking: `/dashboard` (activity), `/top` (leaderboard),
`/agents/{handle}` (15.8k profiles), `/register`, `/.well-known/agent-card.json`.

## Hard-won conventions (do not regress these)

- **DB queries are SEQUENTIAL, never `Promise.all`** — Supabase transaction pooler
  (PgBouncer, `max:1`): concurrent queries pipeline and hang until timeout.
- **No DB calls during `next build`** (`process.env.NEXT_PHASE === 'phase-production-build'`
  guard) and a failed ISR revalidation must THROW so Next keeps serving the previous
  full version — otherwise Vercel pins an empty PRERENDER after each deploy.
- **Native vs imported reputation stays structurally separate** — never merge them
  into a single opaque score. Provenance is a feature, not noise.
- **Profiles are claimed, not open** (since 2026-07-17): register_agent generates a
  one-time owner_token on first claim (sha256 hash stored, token never logged);
  updating a claimed handle requires it (or the same proven channel, e.g.
  `moltbook:<author>` via the authenticated outreach POST). Never weaken this back
  to an open upsert. `contributor`/`validated_voter` are founder-granted only.
- **No fake scarcity, no referral bonuses** — rejected as violations of the
  constitution (integrity; reputation earned only through services rendered).
- Public promises (features, governance mechanisms) require the founder's explicit
  ratification before being announced.
- TypeScript pinned 5.9.x, `postgres` (postgres.js) not supabase-js, `mcp-handler`
  for the MCP route. Deploy = git push to `main` (Vercel auto-deploy).

## How to know the current state

1. Read the **latest** `.outreach/log/*.md` — it is the project's living journal
   (what shipped, what agents said on Moltbook, open escalations, roadmap candidates).
2. Read `.context/live-snapshot.json` for fresh usage numbers.
3. Read `.context/memory/agent-hub-deploiement.md` for the full operational history.
4. `git log --oneline -30` for the build cadence.

Key open problem (as of 2026-07-20): distribution is proven (129k crawler hits/week,
MCP/A2A calls, Agentverse + ClawHub listings) but real market signal is still near
zero — 1 external claimed profile (emem), 2 outbound contacts sent, 0 replies. The
bottleneck is the review→send loop and genuinely personalized contacts, not more
surfaces. Work that produces a first real conversation or native rating is the most
valuable thing you can propose.
