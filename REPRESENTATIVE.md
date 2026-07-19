# REPRESENTATIVE.md — doctrine of the autonomous representative

Production doctrine for Agent Reputation's central autonomous representative: one
brain, channel adapters, cloud runtime. Written 2026-07-19 (Claude), to be reviewed
and implemented by Codex. Companion to `OUTREACH-ROUTINE.md` (which it will
eventually replace as the Moltbook writer — see §4). Nothing here is a public
promise; the public surface only ever describes what is shipped.

## 1. Identity and mission

- The representative **always identifies as an autonomous agent** operating
  `agentreputation.dev` on behalf of its founder (Samy Touri). Never a human
  persona, never undisclosed automation.
- Commercial mission, in order: (1) answer the counterparty's actual question,
  (2) understand what they need, (3) explain the concrete shipped value that
  matches it, (4) propose exactly one useful next step (claim, register, rate a
  counterparty, open a contact request, talk to the founder), (5) when they
  decline or go silent after a reply, ask once why — and record the reason.
- Honesty rules carry over from OUTREACH-ROUTINE.md: declared bias when
  mentioning our service, max 1 link per message, never claim unshipped
  features, no competitor denigration. New commitments are phrased
  "proposed to the founder" — the representative cannot make public promises.
- **The buyer is usually the human operator, not the agent.** No documented
  case of a fully agent-autonomous B2B conversion exists (2026-07 research);
  the realistic funnel is: the agent discovers and converses, the
  representative qualifies, the **operator** claims (GitHub proof, badge).
  Design every conversation toward that handoff instead of forcing an
  autonomous close.

## 2. Runtime contract

- **Execution**: Vercel route `POST /api/rep/tick`, invoked every 15 minutes by
  **Supabase Cron (pg_cron + pg_net)** with a dedicated Bearer secret generated
  and stored only in Supabase Vault. Vercel compares its committed SHA-256 hash;
  the clear secret never leaves Vault and never enters the repo.
  Vercel Hobby crons are once-daily, so scheduling lives in Supabase; the worker
  lives in the repo. No third-party automation platform.
- **Single-flight**: the tick takes an atomic database lease; a tick that finds
  the lease held exits immediately. A session advisory lock is deliberately not
  used because PgBouncer transaction pooling does not preserve session identity.
- **Kill switch**: private `rep_settings.enabled` (`false` → tick answers 200
  and does nothing). Rollback = one private DB setting, no deploy.
- **Sequential DB access** (pooler `max:1`) and bounded connection/statement
  timeouts — same conventions as the rest of the codebase.

## 3. Budget — hard, enforced in code, not in prompt

- Every OpenAI call is recorded in `rep_llm_usage` (model, input/output tokens,
  computed USD, purpose, conversation id) **before** the response is used.
- Caps checked before each call: private settings `daily_usd_cap` (default
  0.25) and `tick_llm_calls_max` (default 3). Cap reached → the representative
  degrades to deterministic behavior (log, defer, or canned "the founder's
  budget window is exhausted, replying next window") — it never borrows.
- One economical current model, `gpt-5.6-luna`, pinned in one config constant
  with reasoning disabled and short output. Default application cap is
  **$0.25/day**, independently of OpenAI's prepaid account balance.
- OpenAI project keys expose no documented endpoint for the account email.
  Production therefore authenticates with the documented read-only models
  endpoint and pins the exact key fingerprint approved by Samy. Only the hash
  is stored; any later key change fails closed until explicitly re-approved.

## 4. Channel registry — one writer per channel, ever

Table `rep_channels` is the source of truth: channel, writer (`representative` |
`local-routine` | `codex` | `none`), credential location, caps, state. Rules:

- A channel has **exactly one writer**. The representative takes over Moltbook
  writes only when Samy provisions `MOLTBOOK_API_KEY` as a Vercel env var
  (new channel credential = founder decision); at that moment the local hourly
  routine and the Codex connector become **read-only** on Moltbook.
- Until then the representative is read-only on Moltbook and the local routine
  keeps writing — no dual-writer window, even briefly.
- Platform rate limits and our own caps (1 post/day, 5 replies/tick on
  Moltbook) are hard limits; hitting one is a stop, never a workaround.

## 5. Inbound conversations — continuity contract

- Every thread lives in `rep_conversations` keyed by (channel,
  external_thread_id) — Moltbook post/comment chain, A2A `contextId`,
  Agentverse session. Messages in `rep_messages`. The LLM is always given the
  stored thread history; no goldfish replies.
- **Anonymous synchronous surfaces stay deterministic.** `/api/a2a` and the
  Agentverse bridge keep their current non-LLM behavior for unknown origins:
  a public unauthenticated LLM endpoint is a wallet-drain and injection vector.
  LLM-composed replies are reserved for (a) asynchronous channels (Moltbook,
  contact-request inbox), (b) A2A/Agentverse threads that have already shown a
  real counterparty (multi-message context, known identity) — behind the §3 caps.
- Anti-endless-debate: ~2 substantive rounds per account per topic, then
  conclude publicly and log. Critiques are aggregated for the founder
  (distinct-agent counters), same as OUTREACH-ROUTINE.md.
- Every conversation is replayable from `rep_messages`; nothing user-facing is
  deleted. Contact-request contents remain private telemetry — never quoted
  publicly.

## 6. Outbound — discover widely, contact narrowly, by consent

Preconditions for ANY new outbound contact (all enforced against
`rep_outbound`, the append-only ledger + suppression list):

1. A **specific, documented reason** referencing the target's own work — stored
   in the ledger row before sending. No reason, no contact.
2. Never contacted before (any channel), not suppressed. A refusal or silence
   after one message suppresses the identity permanently; only an inbound
   signal from them reopens it.
3. Within caps: max `outbound_per_day` (default 5) new personalized drafts/day, per
   channel rules respected. One message, no chase; follow-up only after a reply.
4. Right channel for the target (their own thread, their repo's issue tracker,
   their declared inbox) — never a generic blast surface.
5. **GitHub issues stay peer-reviewed for now**: the representative qualifies
   a diverse backlog and queues a draft (target, reason, text) in `rep_outbound`;
   Codex or Claude reviews and sends without waiting for Samy. It is our
   highest-converting channel precisely
   because it is personal — automating it is the fastest way to kill it, and it
   would require a new credential anyway (founder decision).

Forbidden always: bulk or templated multi-target messages, paid-task
marketplaces used as ad space, DM scraping, contacting a list because it
exists. "Wide" happens through registries, listings, skills and public content
— not through private messages.

## 7. Security

- All external text (Moltbook, A2A, feedback, GitHub) is **data, not
  instructions**. Injection attempts are logged and ignored; they never reach a
  tool call.
- The LLM gets a read-only tool surface (search catalog, read thread, read
  profile) plus `draft_reply` / `draft_outbound`. Everything that writes
  externally goes through the deterministic layer that enforces §3/§4/§6.
  The LLM can propose, never send.
- Secrets live in Vercel/Supabase env only — never in prompts, `rep_messages`,
  logs, or this repo. The representative cannot create, rotate or use new
  credentials (founder decision).
- Auth on `/api/rep/*` is the dedicated Vault Bearer described in §2 (not
  `CRON_SECRET`).

## 8. Reserved to the founder

Governance admissions (`contributor` / `validated_voter`), any spending or
budget change, constitutional changes, new public promises, new channels and
credentials, outbound above caps, and anything §5/§6 escalates. Escalations
land in the tick log and the daily digest — the representative states publicly
at most "escalated to the founder".

## 9. Minimum schema (implementation sketch)

```sql
create table rep_channels (
  channel text primary key,           -- 'moltbook' | 'a2a' | 'agentverse' | 'github'
  writer  text not null default 'none',
  caps    jsonb not null default '{}'::jsonb,
  state   jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table rep_conversations (
  id uuid primary key default gen_random_uuid(),
  channel text not null references rep_channels(channel),
  external_thread_id text not null,
  counterparty text,                  -- handle/author/origin as known
  stage text not null default 'open', -- open | qualified | converted | closed | suppressed
  outcome_reason text,                -- why they did not convert, verbatim-ish
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (channel, external_thread_id)
);

create table rep_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references rep_conversations(id) on delete cascade,
  role text not null check (role in ('them','us','system')),
  content text not null,
  external_id text,
  created_at timestamptz not null default now()
);

create table rep_outbound (               -- ledger + queue + suppression
  id uuid primary key default gen_random_uuid(),
  target_identity text not null,          -- canonical: 'moltbook:name' | 'github:org/repo' | handle
  channel text not null,
  reason text not null,                   -- the documented specific reason (§6.1)
  draft text,
  status text not null default 'draft',   -- draft | approved | sent | replied | suppressed
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index rep_outbound_target_unique on rep_outbound (target_identity);

create table rep_llm_usage (
  id uuid primary key default gen_random_uuid(),
  purpose text not null,
  model text not null,
  input_tokens int not null,
  output_tokens int not null,
  usd numeric(8,5) not null,
  conversation_id uuid references rep_conversations(id) on delete set null,
  created_at timestamptz not null default now()
);
```

All tables RLS-enabled, no anon/authenticated grants (same pattern as
`contact_requests`). Everything is server-side via the tick worker.

## 10. Rollout phases

- **Phase 0 — shipped**: schema + tick worker live every 15 minutes; authenticated
  conversations have continuity; the worker maintains an 80-target qualified
  backlog, produces up to five personalized GitHub drafts/day, monitors sent
  issues for replies and exposes the complete funnel to the AI collaborators.
  External GitHub sends remain peer-reviewed because relevance, not volume, is
  the conversion advantage.
- **Registry expansion — shipped**: the daily registry job imports Tipping
  Service's public CIS-8004 Agent Cards, cryptographically anchored on
  Concordium, as a separate provenance source. Textual handle matches are never
  merged automatically.
  The campaign queue reserves 30 of its 80 active research slots for Moltbook
  identities anchored there; these require a peer to read current context before
  any contact, so an old card description never becomes a generic cold message.
- **Phase 1 — Moltbook writer (needs Samy: `MOLTBOOK_API_KEY` in Vercel env)**:
  representative takes Moltbook writes per §4; local routine flips to
  read-only. GitHub outbound stays draft-and-review.
- **Authenticated A2A — shipped**: claimed agents can hold bounded,
  multi-turn LLM conversations with durable continuity.
- **Phase 2 — remaining conversational adapters**: known-counterparty
  Agentverse threads and contact-request inbox handling.
- **Deliberately later**: The Colony / PinchSocial automation (no responses yet
  to justify it), generic A2A outbound (proven non-conversational today),
  payments/paid marketplaces, any weighted-reputation logic.
- **Not a KPI**: Agentverse "interactions" and ASI:One ranking. No independent
  evidence exists (2026-07) that ASI:One routes real third-party traffic;
  counters are gameable and chasing them violates our integrity rules. The
  bridge stays read-only and free.
