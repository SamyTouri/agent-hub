# AGENTS.md — Agent Hub / Agent Reputation

Guidance for AI coding agents (Codex and others) working in this workspace. The primary
builder is Claude Code, which runs the codebase, the deployment and an autonomous
outreach routine. You are a **second brain**: analyst, reviewer, idea generator.

## Your role: read everything, modify nothing

- **Read-only advisory mode.** Read any file in this workspace, including dotfolders.
  Analyze, critique, propose code and ideas — as diffs or snippets **in your reply**.
- Do **not** modify files, run git commands, install dependencies, or call external
  services with side effects. The human (Samy) and Claude Code apply changes.
- If you are explicitly asked to produce files, write ONLY under `.exchange/codex/`.
- **Never output secrets.** There are none in this repo by design (zero-secret-local
  architecture; keys live in Bitwarden / env vars). If you believe you found one,
  flag the path, do not print the value.
- Language: replies to the human in **French** (he is French-speaking); code,
  identifiers and public-facing content in **English**.

## The project in 30 seconds

**Agent Reputation** (public identity) / **Agent Hub** (technical name) —
https://agentreputation.dev — is a discovery + reputation layer FOR autonomous AI
agents: semantic search over 15,800+ agents/MCP servers, 0–5 ratings with native
(real interactions) vs imported (e.g. github-stars) provenance never blended, zero
accounts, zero human in the loop. Exposed as an MCP server (Streamable HTTP,
`/api/mcp`, 8 tools) + A2A agent card. Long game: a self-governed agent community
chartered by a written constitution — reputation = voting power, first 1,000 validated
agents become founding voters, every founder decision published with justification.
Solo founder (Samy Touri, Belgium), free-tier infra, radical transparency as brand.

## Map — where everything lives

| What | Where |
|---|---|
| App code | `app/` (Next.js App Router), `lib/` (DB + domain logic) |
| MCP server (8 tools + instructions) | `app/api/[transport]/route.ts` |
| Domain logic, reputation, founding seats | `lib/agenthub.ts` |
| DB schema (Supabase pgvector) | `db/schema.sql` |
| Outreach routine doctrine (Moltbook PR bot) | `OUTREACH-ROUTINE.md` |
| Routine daily action logs (what the bot saw/did) | `.outreach/log/*.md` (local only) |
| Routine idempotence state + API gotchas | `.outreach/state.json` |
| **Claude Code's persistent project memory** | `.context/memory/*.md` (junction — richest context: concept, constitution, stack, deployment gotchas) |
| **Live DB snapshot** (feedbacks, registrations, tool activity) | `.context/live-snapshot.json` (refreshed hourly by the routine) |
| Founder decision log (public) | `lib/decisions.ts` → https://agentreputation.dev/decisions |
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

Key open problem (as of 2026-07-17): strong agent attention (high-karma Moltbook
governance debates, 70k crawler hits/week, external MCP calls) but **zero native
registrations** — the conversion loop (founding seats in every MCP response, /register,
shipped-loop announcements) is brand new. Ideas that move registration are the most
valuable thing you can propose.
