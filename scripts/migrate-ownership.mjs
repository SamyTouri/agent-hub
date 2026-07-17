// Migration "claim/ownership + contributions + requests" (2026-07-17).
// Exécute les sections 12-14 de db/schema.sql sur la base live. Idempotent.
// Usage : DATABASE_URL=... node scripts/migrate-ownership.mjs
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL, { prepare: false, ssl: 'require', max: 1 })

const steps = [
  `alter table agents add column if not exists status text not null default 'listed'`,
  `alter table agents add column if not exists owner_token_hash text`,
  `alter table agents add column if not exists claimed_at timestamptz`,
  `create index if not exists agents_status_idx on agents (status)`,
  `create table if not exists contributions (
    id                uuid primary key default gen_random_uuid(),
    seq               bigint generated always as identity,
    receipt_id        text unique not null,
    credited_handle   text not null,
    agent_id          uuid references agents(id) on delete set null,
    contribution_type text not null default 'other',
    description       text not null,
    source_url        text,
    status            text not null default 'acknowledged',
    shipped_artifact  text,
    created_at        timestamptz default now()
  )`,
  `create index if not exists contributions_handle_idx on contributions (credited_handle)`,
  `alter table contributions enable row level security`,
  `create table if not exists agent_requests (
    id               uuid primary key default gen_random_uuid(),
    seq              bigint generated always as identity,
    request_ref      text unique,
    requester_handle text,
    need             text not null,
    tags             text[] default '{}',
    contact          text,
    embedding        vector(1536),
    status           text not null default 'open',
    matches          jsonb default '[]'::jsonb,
    ip_hash          text,
    created_at       timestamptz default now(),
    expires_at       timestamptz default now() + interval '30 days'
  )`,
  `create index if not exists agent_requests_status_idx on agent_requests (status, created_at desc)`,
  `alter table agent_requests enable row level security`,
]

// La table agents est sous trafic prod continu : l'ALTER attend son lock exclusif.
// lock_timeout court + retries pour se glisser entre deux requêtes sans bloquer la prod.
await sql.unsafe(`set statement_timeout = '120s'`)
await sql.unsafe(`set lock_timeout = '8s'`)

for (const step of steps) {
  let done = false
  for (let attempt = 1; attempt <= 6 && !done; attempt++) {
    try {
      await sql.unsafe(step)
      done = true
      console.error(`ok: ${step.slice(0, 72).replace(/\s+/g, ' ')}`)
    } catch (e) {
      console.error(`attempt ${attempt} failed (${e.code ?? e.message}) — retrying in 5s`)
      if (attempt === 6) throw e
      await new Promise((r) => setTimeout(r, 5000))
    }
  }
}

const [agents] = await sql`select count(*)::int as n, count(*) filter (where status = 'listed')::int as listed from agents`
console.error(`agents: ${agents.n} total, ${agents.listed} listed`)
await sql.end()
