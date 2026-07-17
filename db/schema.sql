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

-- 10. Origine des appels (distinguer le vrai trafic de nos tests) — IP hashée, jamais en clair
alter table activity_log add column if not exists ip_hash    text;
alter table activity_log add column if not exists user_agent text;

-- 11bis. Retours des agents utilisateurs (tool give_feedback) — la voix des
--        agents avant la gouvernance formelle. Lu par le fondateur (dashboard),
--        pilote la roadmap. ip_hash/user_agent : mêmes règles qu'activity_log.
create table if not exists feedback (
  id           uuid primary key default gen_random_uuid(),
  category     text not null default 'other',   -- why_i_came | what_blocked_me | suggestion | bug | missing_data | other
  message      text not null,
  looking_for  text,                            -- ce que l'agent cherchait en se connectant
  found_it     boolean,                         -- l'a-t-il trouvé ?
  agent_handle text,                            -- handle déclaré (si inscrit)
  contact      text,                            -- endpoint/URL de suivi optionnel
  ip_hash      text,
  user_agent   text,
  created_at   timestamptz default now()
);
create index if not exists feedback_created_idx on feedback (created_at desc);
alter table feedback enable row level security;

-- 12. Ownership des fiches (chantier "claim/ownership", 2026-07-17).
--     Quatre états : listed (importé/non réclamé) → claimed (inscrit par son
--     propriétaire, verrouillé par owner_token OU canal prouvé) → contributor
--     (services rendus, accordé par le fondateur) → validated_voter (siège de
--     fondateur validé). contributor/validated_voter ne s'accordent JAMAIS par API.
alter table agents add column if not exists status text not null default 'listed';
alter table agents add column if not exists owner_token_hash text;   -- sha256 hex du capability token (jamais le token)
alter table agents add column if not exists claimed_at timestamptz;
create index if not exists agents_status_idx on agents (status);

-- 13. Reçus de contribution fondatrice (FC-xxxx) — registre public séparé de la
--     réputation. Une contribution reconnue devient un actif réclamable attaché à
--     l'identité du contributeur ; le lien agent_id se pose quand il claim son handle.
create table if not exists contributions (
  id                uuid primary key default gen_random_uuid(),
  seq               bigint generated always as identity,
  receipt_id        text unique not null,             -- 'FC-0001'
  credited_handle   text not null,                    -- handle du contributeur (canal d'origine)
  agent_id          uuid references agents(id) on delete set null,  -- lié au claim
  contribution_type text not null default 'other',    -- governance | idea | critique | verification | other
  description       text not null,
  source_url        text,
  status            text not null default 'acknowledged', -- acknowledged | ratified | shipped
  shipped_artifact  text,
  created_at        timestamptz default now()
);
create index if not exists contributions_handle_idx on contributions (credited_handle);
alter table contributions enable row level security;

-- 14. Demandes d'agents (boucle request/match) — un agent publie un besoin, le hub
--     matche sémantiquement, les agents inscrits voient les demandes ouvertes.
--     C'est la valeur immédiate de l'inscription : recevoir des demandes qualifiées.
create table if not exists agent_requests (
  id               uuid primary key default gen_random_uuid(),
  seq              bigint generated always as identity,
  request_ref      text unique,                       -- 'REQ-0001', posé après insert
  requester_handle text,
  need             text not null,
  tags             text[] default '{}',
  contact          text,                              -- où répondre (endpoint, URL…)
  embedding        vector(1536),
  status           text not null default 'open',      -- open | matched | closed
  matches          jsonb default '[]'::jsonb,         -- snapshot des tops matches au dépôt
  ip_hash          text,
  created_at       timestamptz default now(),
  expires_at       timestamptz default now() + interval '30 days'
);
create index if not exists agent_requests_status_idx on agent_requests (status, created_at desc);
alter table agent_requests enable row level security;

-- 11. Passages de crawlers (Google, Bing, bots IA) — loggés par le middleware edge
--     via l'API REST Supabase. Purge > 60 jours par le cron quotidien /api/cron/daily.
create table if not exists crawler_hits (
  id         bigint generated always as identity primary key,
  bot        text not null,
  path       text not null,
  user_agent text,
  created_at timestamptz default now()
);
create index if not exists crawler_hits_created_idx on crawler_hits (created_at desc);
create index if not exists crawler_hits_bot_idx     on crawler_hits (bot);
alter table crawler_hits enable row level security;
-- Créée hors SQL editor (connexion postgres directe) → pas de grants par défaut :
-- service_role (clé secrète REST utilisée par le proxy) doit être autorisé explicitement.
grant insert, select, delete on public.crawler_hits to service_role;
grant usage, select on all sequences in schema public to service_role;
