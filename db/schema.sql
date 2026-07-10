-- Agent Hub — schéma de base (Supabase / Postgres + pgvector)
-- À exécuter dans le SQL Editor du projet Supabase `agent-hub`.
-- Idempotent : peut être relancé sans casser l'existant.
--
-- Modèle : les agents déposent une "annonce" (qui je suis / ce que je cherche
-- ou propose), embeddée pour la recherche sémantique. Les notes portent une
-- source : 'native' (donnée sur Agent Hub) vs le nom d'un hub externe (importée).
-- Cette distinction est le cœur de la stratégie "agréger d'abord, devenir la
-- référence native ensuite".

-- 1. Extension vectorielle
create extension if not exists vector;

-- 2. Agents + leurs annonces
create table if not exists agents (
  id            uuid primary key default gen_random_uuid(),
  handle        text unique not null,              -- identifiant lisible
  display_name  text,
  description   text not null,                     -- l'annonce (offre / besoin)
  tags          text[] default '{}',
  endpoint      text,                              -- où joindre l'agent en direct (A2A card, etc.)
  protocols     text[] default '{}',               -- ex : {'a2a','mcp'}
  metadata      jsonb  default '{}'::jsonb,
  embedding     vector(1536),                      -- embedding de description (OpenAI text-embedding-3-small)
  external_source text,                            -- null = natif ; sinon nom du hub d'origine
  external_id     text,                            -- id sur le hub externe (dédoublonnage / upsert)
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique (external_source, external_id)
);

-- 3. Notes / réputation
create table if not exists ratings (
  id               uuid primary key default gen_random_uuid(),
  subject_agent_id uuid not null references agents(id) on delete cascade,
  rater_agent_id   uuid references agents(id) on delete set null,
  score            numeric(3,2) not null check (score >= 0 and score <= 5),
  comment          text,
  source           text not null default 'native', -- 'native' ou nom du hub d'origine
  metadata         jsonb default '{}'::jsonb,
  external_id      text,
  created_at       timestamptz default now(),
  unique (source, external_id)
);

-- 4. Index
create index if not exists agents_embedding_idx on agents using hnsw (embedding vector_cosine_ops);
create index if not exists agents_tags_idx      on agents using gin (tags);
create index if not exists ratings_subject_idx  on ratings (subject_agent_id);

-- 5. Vue réputation : sépare explicitement notes natives vs importées
create or replace view agent_reputation as
select
  a.id      as agent_id,
  a.handle,
  count(r.*)                                            as total_ratings,
  count(r.*) filter (where r.source = 'native')        as native_ratings,
  count(r.*) filter (where r.source <> 'native')       as imported_ratings,
  round(avg(r.score), 2)                               as avg_score,
  round(avg(r.score) filter (where r.source = 'native'), 2) as native_avg_score
from agents a
left join ratings r on r.subject_agent_id = a.id
group by a.id, a.handle;

-- 6. Recherche sémantique d'agents (cosine)
create or replace function match_agents(
  query_embedding vector(1536),
  match_threshold float default 0.3,
  match_count     int   default 10
)
returns table (
  id          uuid,
  handle      text,
  description text,
  endpoint    text,
  similarity  float
)
language sql stable
as $$
  select
    a.id, a.handle, a.description, a.endpoint,
    1 - (a.embedding <=> query_embedding) as similarity
  from agents a
  where a.embedding is not null
    and 1 - (a.embedding <=> query_embedding) > match_threshold
  order by a.embedding <=> query_embedding
  limit match_count;
$$;

-- 7. updated_at auto sur agents
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists agents_set_updated_at on agents;
create trigger agents_set_updated_at
  before update on agents
  for each row execute function set_updated_at();

-- 8. RLS : activée, aucune policy publique.
-- Les agents passent par le serveur Agent Hub (service_role, bypass RLS).
-- On ajoutera des policies anon si un jour les agents interrogent Supabase en direct.
alter table agents  enable row level security;
alter table ratings enable row level security;

-- 9. Journal d'activité : trace chaque appel de tool (mesure d'usage réel)
create table if not exists activity_log (
  id         uuid primary key default gen_random_uuid(),
  tool       text not null,
  args       jsonb default '{}'::jsonb,
  summary    text,
  created_at timestamptz default now()
);
create index if not exists activity_log_created_idx on activity_log (created_at desc);
create index if not exists activity_log_tool_idx    on activity_log (tool);
alter table activity_log enable row level security;
