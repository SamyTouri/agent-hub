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
  unique (source, external_id),
  -- Les signaux dérivés de métadonnées de dépôt n'entrent pas dans les notes (décision
  -- publique du 2026-07-25, /decisions). Un compteur d'étoiles est un fait de popularité,
  -- vit dans agents.metadata.github_stars avec sa date, et n'est jamais agrégé.
  -- Voir db/migration-derived-signals.sql.
  constraint ratings_no_derived_source check (source <> 'github-stars')
);

-- 4. Index
create index if not exists agents_embedding_idx on agents using hnsw (embedding vector_cosine_ops);
create index if not exists agents_tags_idx      on agents using gin (tags);
create index if not exists agents_directory_idx on agents ((external_source is not null), updated_at desc);
create index if not exists ratings_subject_idx  on ratings (subject_agent_id);
create index if not exists ratings_rater_idx    on ratings (rater_agent_id);
create index if not exists ratings_subject_created_idx on ratings (subject_agent_id, created_at desc);

-- 5. Vue réputation publique : seules les notes natives d'un rater claimed et
-- authentifié comptent. Les anciennes entrées anonymes restent auditables dans
-- ratings mais sont privées et sans effet sur les agrégats publics.
drop view if exists agent_reputation;
create view agent_reputation with (security_invoker = true) as
select
  a.id      as agent_id,
  a.handle,
  count(r.*) filter (
    where r.source <> 'native'
       or r.metadata->>'rater_verified' = 'true'
  ) as total_ratings,
  count(r.*) filter (
    where r.source = 'native'
      and r.metadata->>'rater_verified' = 'true'
  ) as native_ratings,
  count(r.*) filter (
    where r.source = 'native'
      and r.metadata->>'rater_verified' = 'true'
  ) as verified_native_ratings,
  count(r.*) filter (
    where r.source = 'native'
      and r.metadata->>'rater_verified' is distinct from 'true'
  ) as anonymous_native_ratings,
  count(r.*) filter (where r.source <> 'native') as imported_ratings,
  round(avg(r.score) filter (
    where r.source = 'native'
      and r.metadata->>'rater_verified' = 'true'
  ), 2) as native_avg_score,
  round(avg(r.score) filter (
    where r.source = 'native'
      and r.metadata->>'rater_verified' = 'true'
  ), 2) as verified_native_avg_score,
  round(avg(r.score) filter (
    where r.source = 'native'
      and r.metadata->>'rater_verified' is distinct from 'true'
  ), 2) as anonymous_native_avg_score,
  round(avg(r.score) filter (where r.source <> 'native'), 2) as imported_avg_score
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
set search_path = public, pg_temp
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
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
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
create index if not exists activity_log_tool_ip_created_idx
  on activity_log (tool, ip_hash, created_at desc);

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
create index if not exists feedback_ip_created_idx on feedback (ip_hash, created_at desc);
alter table feedback enable row level security;

-- 12. Ownership des fiches (chantier "claim/ownership", 2026-07-17).
--     Quatre états : listed (importé/non réclamé) → claimed (inscrit par son
--     namespace, verrouillé par owner_token auto-déclaré OU canal prouvé) → contributor
--     (reconnaissance historique, sans droit spécial). Le claim contrôle uniquement
--     le namespace du profil et ne crée aucun droit dans Agent Reputation.
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
  claim_channel     text,                           -- canal source requis pour lier le reçu (ex. moltbook:cwahq)
  created_at        timestamptz default now()
);
alter table contributions add column if not exists claim_channel text;
create index if not exists contributions_handle_idx on contributions (credited_handle);
create index if not exists contributions_agent_idx on contributions (agent_id);
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
create index if not exists agent_requests_ip_created_idx on agent_requests (ip_hash, created_at desc);
alter table agent_requests enable row level security;

-- 15. Demandes de contact privées et consenties. Une seule demande par paire
--     orientée : aucune relance via le Hub. Les coordonnées restent invisibles
--     publiquement et ne sont révélées à l'autre propriétaire qu'après auth/accord.
create table if not exists contact_requests (
  id                  uuid primary key default gen_random_uuid(),
  seq                 bigint generated always as identity,
  request_ref         text unique,                       -- 'CONTACT-0001', posé après insert
  requester_agent_id  uuid not null references agents(id) on delete cascade,
  recipient_agent_id  uuid not null references agents(id) on delete cascade,
  purpose             text not null default 'other'
    check (purpose in ('collaboration', 'feedback', 'service', 'research', 'other')),
  message             text not null check (char_length(message) between 1 and 1000),
  requester_contact   text
    check (requester_contact is null or char_length(requester_contact) <= 500),
                                                            -- privé : visible au destinataire authentifié
  status              text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  response_message    text
    check (response_message is null or char_length(response_message) <= 1000),
  recipient_contact   text
    check (recipient_contact is null or char_length(recipient_contact) <= 500),
                                                            -- privé : révélé au demandeur seulement si accepté
  ip_hash             text,
  created_at          timestamptz not null default now(),
  expires_at          timestamptz not null default now() + interval '14 days',
  responded_at        timestamptz,
  check (requester_agent_id <> recipient_agent_id),
  check (expires_at > created_at),
  check (
    (status = 'pending' and responded_at is null)
    or (status in ('accepted', 'declined') and responded_at is not null)
  ),
  check (recipient_contact is null or status = 'accepted')
);
create unique index if not exists contact_requests_pair_unique
  on contact_requests (requester_agent_id, recipient_agent_id);
create index if not exists contact_requests_recipient_status_idx
  on contact_requests (recipient_agent_id, status, created_at desc);
create index if not exists contact_requests_requester_status_idx
  on contact_requests (requester_agent_id, status, created_at desc);
create index if not exists contact_requests_requester_created_idx
  on contact_requests (requester_agent_id, created_at desc);
alter table contact_requests enable row level security;
-- Défense en profondeur : cette table n'est pas une API Data REST. Toutes les
-- lectures/écritures passent par les tools serveur après vérification du token.
revoke all on table public.contact_requests from anon, authenticated;
revoke all on sequence public.contact_requests_seq_seq from anon, authenticated;

-- 16. Anti-abus des notes natives (les imports passent par des scripts internes).
create index if not exists ratings_native_ip_created_idx
  on ratings ((metadata->>'ip_hash'), created_at desc)
  where source = 'native';
create index if not exists ratings_native_rater_subject_created_idx
  on ratings (rater_agent_id, subject_agent_id, created_at desc)
  where source = 'native';

-- 17. L'event-trigger de défense RLS n'est pas une API publique.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end
$$;

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

-- 18. Représentant autonome central : mémoire de conversation, registre des
--     canaux, prospection ciblée, budget LLM et audit de chaque réveil.
--     Aucune table rep_* n'est une API Supabase publique.
create table if not exists rep_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists rep_channels (
  channel    text primary key,
  writer     text not null default 'none'
    check (writer in ('representative', 'local-routine', 'codex', 'none')),
  caps       jsonb not null default '{}'::jsonb,
  state      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists rep_conversations (
  id                 uuid primary key default gen_random_uuid(),
  channel            text not null references rep_channels(channel),
  external_thread_id text not null,
  counterparty       text,
  stage              text not null default 'open'
    check (stage in ('open', 'qualified', 'converted', 'closed', 'suppressed')),
  outcome_reason     text,
  next_step          text,
  metadata           jsonb not null default '{}'::jsonb,
  last_activity_at   timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  unique (channel, external_thread_id)
);

create table if not exists rep_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references rep_conversations(id) on delete cascade,
  role            text not null check (role in ('them', 'us', 'system')),
  status          text not null default 'received'
    check (status in ('received', 'draft', 'sent', 'failed')),
  content         text not null check (char_length(content) between 1 and 8000),
  external_id     text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create unique index if not exists rep_messages_external_unique
  on rep_messages (conversation_id, external_id)
  where external_id is not null;
create index if not exists rep_messages_conversation_created_idx
  on rep_messages (conversation_id, created_at);

create table if not exists rep_outbound (
  id              uuid primary key default gen_random_uuid(),
  target_identity text not null,
  channel         text not null references rep_channels(channel),
  target_url      text,
  reason          text not null check (char_length(reason) between 1 and 2000),
  draft           text check (draft is null or char_length(draft) <= 4000),
  status          text not null default 'draft'
    check (status in ('draft', 'approved', 'sent', 'replied', 'suppressed', 'failed')),
  source_agent_id uuid references agents(id) on delete set null,
  external_id     text,
  last_error      text,
  sent_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (target_identity)
);
-- The table started as a draft ledger and now also acts as the durable,
-- consent-safe prospect queue.  These ALTERs keep schema.sql idempotent for
-- installations created before the campaign engine existed.
alter table rep_outbound add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table rep_outbound add column if not exists next_action_at timestamptz;
alter table rep_outbound add column if not exists last_checked_at timestamptz;
alter table rep_outbound add column if not exists response_summary text;
alter table rep_outbound drop constraint if exists rep_outbound_status_check;
alter table rep_outbound add constraint rep_outbound_status_check
  check (status in (
    'discovered', 'qualified', 'draft', 'approved', 'sent', 'replied',
    'converted', 'declined', 'suppressed', 'failed'
  ));
create index if not exists rep_outbound_status_created_idx
  on rep_outbound (status, created_at);
create index if not exists rep_outbound_channel_idx on rep_outbound (channel);
create index if not exists rep_outbound_source_agent_idx
  on rep_outbound (source_agent_id)
  where source_agent_id is not null;
create index if not exists rep_outbound_next_action_idx
  on rep_outbound (status, next_action_at)
  where status in ('qualified', 'draft', 'approved', 'sent', 'replied');

create table if not exists rep_llm_usage (
  id              uuid primary key default gen_random_uuid(),
  purpose         text not null,
  model           text not null,
  input_tokens    int not null check (input_tokens >= 0),
  output_tokens   int not null check (output_tokens >= 0),
  usd             numeric(10,6) not null check (usd >= 0),
  conversation_id uuid references rep_conversations(id) on delete set null,
  response_id     text,
  created_at      timestamptz not null default now()
);
create index if not exists rep_llm_usage_created_idx on rep_llm_usage (created_at);
create index if not exists rep_llm_usage_conversation_idx
  on rep_llm_usage (conversation_id)
  where conversation_id is not null;

create table if not exists rep_runs (
  id                     uuid primary key default gen_random_uuid(),
  trigger                 text not null default 'cron',
  status                  text not null default 'running'
    check (status in ('running', 'completed', 'skipped', 'failed')),
  mode                    text not null default 'shadow',
  actions_count           int not null default 0,
  llm_calls               int not null default 0,
  openai_identity_match   boolean,
  summary                 text,
  error                   text,
  started_at              timestamptz not null default now(),
  finished_at             timestamptz
);
create index if not exists rep_runs_started_idx on rep_runs (started_at desc);

create table if not exists rep_escalations (
  id              uuid primary key default gen_random_uuid(),
  category        text not null,
  summary         text not null check (char_length(summary) between 1 and 2000),
  conversation_id uuid references rep_conversations(id) on delete set null,
  status          text not null default 'open'
    check (status in ('open', 'resolved', 'dismissed')),
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz
);
create index if not exists rep_escalations_status_created_idx
  on rep_escalations (status, created_at desc);
create index if not exists rep_escalations_conversation_idx
  on rep_escalations (conversation_id)
  where conversation_id is not null;

-- Lease atomique plutôt qu'un advisory lock de session : le projet passe par
-- PgBouncer en transaction pooling, où l'identité de session n'est pas stable.
create table if not exists rep_tick_lease (
  name         text primary key,
  holder       uuid,
  locked_until timestamptz not null default '-infinity',
  updated_at   timestamptz not null default now()
);

insert into rep_tick_lease (name) values ('representative')
on conflict (name) do nothing;

insert into rep_settings (key, value) values
  ('enabled', 'false'::jsonb),
  ('mode', '"shadow"'::jsonb),
  ('daily_usd_cap', '0.25'::jsonb),
  ('tick_llm_calls_max', '3'::jsonb),
  ('outbound_per_day', '5'::jsonb),
  ('prospect_backlog', '80'::jsonb)
on conflict (key) do nothing;

insert into rep_channels (channel, writer, caps) values
  ('a2a', 'representative', '{"authenticated_only": true}'::jsonb),
  ('agentverse', 'none', '{"mode": "deterministic_read_only"}'::jsonb),
  ('moltbook', 'local-routine', '{"posts_per_day": 1, "replies_per_tick": 5}'::jsonb),
  ('github', 'codex', '{"new_contacts_per_day": 5, "peer_review": true, "one_message_without_new_evidence": true}'::jsonb)
on conflict (channel) do nothing;

alter table rep_settings      enable row level security;
alter table rep_channels      enable row level security;
alter table rep_conversations enable row level security;
alter table rep_messages      enable row level security;
alter table rep_outbound      enable row level security;
alter table rep_llm_usage     enable row level security;
alter table rep_runs          enable row level security;
alter table rep_escalations   enable row level security;
alter table rep_tick_lease    enable row level security;

revoke all on table public.rep_settings from anon, authenticated;
revoke all on table public.rep_channels from anon, authenticated;
revoke all on table public.rep_conversations from anon, authenticated;
revoke all on table public.rep_messages from anon, authenticated;
revoke all on table public.rep_outbound from anon, authenticated;
revoke all on table public.rep_llm_usage from anon, authenticated;
revoke all on table public.rep_runs from anon, authenticated;
revoke all on table public.rep_escalations from anon, authenticated;
revoke all on table public.rep_tick_lease from anon, authenticated;

-- 20. Registre privé du MVP préachat payé en x402.
--
-- Les faits de paiement, de livraison et de résultat acheteur restent
-- structurellement séparés. Un règlement ne prouve ni livraison ni satisfaction.
create table if not exists prepurchase_orders (
  id                  text primary key,
  created_at          timestamptz not null default now(),
  payment_status      text not null default 'reserved'
                      check (payment_status in ('reserved', 'settled')),
  network             text not null,
  asset               text not null,
  amount_atomic       numeric(38,0) not null,
  pay_to              text not null,
  payer               text,
  payment_nonce       text not null,
  payment_transaction text,
  settled_at          timestamptz,
  evidence_cutoff     timestamptz,
  delivery_deadline   timestamptz,
  candidate           text not null,
  mission             text not null,
  budget_exposure     text not null,
  failure_consequence text not null,
  public_constraints  text,
  delivery_contact    text not null,
  delivered_at        timestamptz,
  delivery_reference  text,
  buyer_outcome       text,
  buyer_outcome_at    timestamptz,
  unique (network, payment_nonce),
  constraint prepurchase_orders_settlement_shape
  check (
    (
      payment_status = 'reserved'
      and settled_at is null
      and evidence_cutoff is null
      and delivery_deadline is null
    )
    or
    (
      payment_status = 'settled'
      and settled_at is not null
      and evidence_cutoff is not null
      and delivery_deadline is not null
    )
  )
);

create index if not exists prepurchase_orders_created_idx
  on prepurchase_orders (created_at desc);

alter table prepurchase_orders enable row level security;
revoke all on table public.prepurchase_orders from anon, authenticated;
grant select, insert, update on table public.prepurchase_orders to service_role;

-- 21. Journal de preuves append-only + cohorte pilote suivie (2026-07-27).
--
-- Tout le reste du schéma conserve l'état PRÉSENT : l'import registre écrase la
-- description et l'endpoint, la sonde écrase la disponibilité, l'import dépôt écrase le
-- compteur. Ce journal garde ce que les autres tables écrasent — la seule chose qu'un
-- concurrent futur ne pourra pas reconstituer.
--
-- Économie du modèle : une observation n'est écrite que si l'empreinte NORMALISÉE change,
-- et les horodatages/compteurs sont exclus de cette empreinte. Une sonde identique
-- n'écrit donc rien. « Quand a-t-on regardé » reste répondu par l'état courant
-- (agents.metadata.endpoint_check) ; « qu'est-ce qui a changé », par ce journal. Une
-- photographie quotidienne des 17 000 fiches est exclue par construction.
--
-- Détail commenté et procédure : db/migration-evidence-history.sql, docs/EVIDENCE-HISTORY.md.

-- Pas de clé étrangère vers agents : une justification de sélection est un fait daté sur
-- NOTRE méthode, pas une dépendance de la fiche courante. Un `on delete cascade` aurait
-- effacé la trace de la sélection au moment précis où l'on voudrait pouvoir expliquer
-- pourquoi on suivait ce sujet. subject_key garde le handle du jour de la sélection.
create table if not exists evidence_cohort (
  agent_id         uuid primary key,
  subject_key      text not null check (char_length(subject_key) between 1 and 400),
  cohort           text not null default 'pilot-2026-07',
  stratum          text not null check (stratum in (
                     'business_system_connector',
                     'multi_source_identity',
                     'availability_watch',
                     'non_mcp_provenance'
                   )),
  selection_rule   text not null check (selection_rule ~ '/v[0-9]+$'),
  selection_family text,
  -- La raison de sélection vit AVEC le sujet : « pourquoi ceux-là ? » doit obtenir une
  -- règle versionnée, pas une justification reconstruite après coup.
  selection_reason text not null check (char_length(selection_reason) between 20 and 1000),
  subject_kind     text not null default 'mcp_server'
                     check (subject_kind in ('agent', 'mcp_server', 'service')),
  active           boolean not null default true,
  added_at         timestamptz not null default now(),
  deactivated_at   timestamptz,
  check ((active and deactivated_at is null) or (not active and deactivated_at is not null))
);
create index if not exists evidence_cohort_active_idx
  on evidence_cohort (cohort, stratum) where active;

-- Pas de clé étrangère vers agents : délibéré. L'histoire d'un sujet doit survivre à la
-- suppression de sa fiche courante. subject_key garde l'identifiant tel qu'il était au
-- moment de l'observation, ce qui rend auditable un changement de handle.
create table if not exists evidence_observations (
  id                      uuid primary key default gen_random_uuid(),
  seq                     bigint generated always as identity,
  subject_kind            text not null check (subject_kind in ('agent', 'mcp_server', 'service')),
  subject_agent_id        uuid not null,
  subject_key             text not null check (char_length(subject_key) between 1 and 400),
  source                  text not null check (char_length(source) between 1 and 80),
  source_url              text check (source_url is null or char_length(source_url) <= 2000),
  observed_at             timestamptz not null default now(),
  effective_at            timestamptz,
  schema_version          int not null check (schema_version >= 1),
  content_hash            text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  facts                   jsonb not null,
  previous_observation_id uuid references evidence_observations(id),
  change_summary          jsonb not null default '[]'::jsonb,
  visibility              text not null default 'paid'
                            check (visibility in ('public_summary', 'paid', 'private')),
  collector               text not null check (char_length(collector) between 1 and 120),
  created_at              timestamptz not null default now(),
  check (jsonb_typeof(facts) = 'object'),
  check (jsonb_typeof(change_summary) = 'array'),
  check (previous_observation_id is not null or change_summary = '[]'::jsonb)
);

-- Garantie réelle contre la double écriture concurrente : le trigger porte la sémantique,
-- mais deux transactions simultanées le franchiraient toutes les deux — pas ces index.
create unique index if not exists evidence_observations_baseline_unique
  on evidence_observations (subject_agent_id, source)
  where previous_observation_id is null;
create unique index if not exists evidence_observations_successor_unique
  on evidence_observations (previous_observation_id)
  where previous_observation_id is not null;
create index if not exists evidence_observations_head_idx
  on evidence_observations (subject_agent_id, source, seq desc);
create index if not exists evidence_observations_observed_idx
  on evidence_observations (observed_at desc);
create index if not exists evidence_observations_source_idx
  on evidence_observations (source, observed_at desc);

-- Immuabilité refusée par le moteur, pas par convention. Une erreur se rétracte par une
-- nouvelle observation datée (doctrine de correction publique du 2026-07-25).
create or replace function evidence_observations_immutable()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'evidence_observations is append-only: % refused', tg_op
    using errcode = 'restrict_violation',
          hint = 'Retract by appending a dated observation; never rewrite history in place.';
end;
$$;

drop trigger if exists evidence_observations_no_mutation on evidence_observations;
create trigger evidence_observations_no_mutation
  before update or delete on evidence_observations
  for each row execute function evidence_observations_immutable();

drop trigger if exists evidence_observations_no_truncate on evidence_observations;
create trigger evidence_observations_no_truncate
  before truncate on evidence_observations
  for each statement execute function evidence_observations_immutable();

-- Volontairement PAS d'unicité globale sur (sujet, source, empreinte) : elle interdirait
-- d'enregistrer un retour à un état antérieur, or un hôte qui retombe en panne après
-- s'être rétabli est exactement ce qu'un acheteur veut voir. La déduplication porte sur
-- la SUITE : deux observations consécutives identiques sont refusées.
create or replace function evidence_observations_chain_guard()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
declare
  head_id   uuid;
  prev_hash text;
  prev_time timestamptz;
begin
  select id into head_id
  from evidence_observations
  where subject_agent_id = new.subject_agent_id and source = new.source
  order by seq desc
  limit 1;

  if new.previous_observation_id is null then
    if head_id is not null then
      raise exception 'a baseline already exists for subject % source %', new.subject_agent_id, new.source
        using errcode = 'unique_violation';
    end if;
    return new;
  end if;

  select content_hash, observed_at
    into prev_hash, prev_time
  from evidence_observations
  where id = new.previous_observation_id
    and subject_agent_id = new.subject_agent_id
    and source = new.source;

  if not found then
    raise exception 'previous observation % does not belong to subject % source %',
      new.previous_observation_id, new.subject_agent_id, new.source
      using errcode = 'check_violation';
  end if;

  if head_id is distinct from new.previous_observation_id then
    raise exception 'observations must extend the current head, not fork it'
      using errcode = 'check_violation';
  end if;

  if prev_hash = new.content_hash then
    raise exception 'identical consecutive observation refused for subject % source %',
      new.subject_agent_id, new.source
      using errcode = 'unique_violation',
            hint = 'Write an observation only when the normalized fingerprint changes.';
  end if;

  if new.observed_at < prev_time then
    raise exception 'observed_at must not go backwards'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists evidence_observations_chain on evidence_observations;
create trigger evidence_observations_chain
  before insert on evidence_observations
  for each row execute function evidence_observations_chain_guard();

-- Aucune Data API publique : la chronologie complète est le produit payant, elle ne doit
-- pas fuir par l'API REST auto-générée de Supabase.
alter table evidence_cohort       enable row level security;
alter table evidence_observations enable row level security;
revoke all on table public.evidence_cohort       from anon, authenticated;
revoke all on table public.evidence_observations from anon, authenticated;
revoke all on sequence public.evidence_observations_seq_seq from anon, authenticated;
grant select, insert, update on table public.evidence_cohort to service_role;
grant select, insert         on table public.evidence_observations to service_role;
grant usage, select on sequence public.evidence_observations_seq_seq to service_role;
revoke update, delete, truncate on table public.evidence_observations from public, service_role;

-- 22. Bail d'exécution unique des tâches planifiées (2026-07-28).
--     Le 2026-07-28, quatre invocations de /api/cron/daily se sont chevauchées : trois ont
--     atteint le plafond de 300 s de la plateforme, la quatrième est morte sur le délai
--     d'instruction PostgreSQL. Elles sondaient les mêmes hôtes et écrivaient les mêmes
--     lignes en même temps, sur un pooler où chaque instance n'a qu'une connexion.
--     Un verrou consultatif ne convient pas ici : `pg_advisory_lock` est lié à une session
--     que PgBouncer en mode transaction ne nous garantit pas, et `pg_advisory_xact_lock`
--     mourrait avec sa transaction alors que le travail dure des minutes. D'où un bail
--     daté : la prise est une seule instruction atomique
--     (`on conflict do update ... where expires_at <= now()`), la ligne n'est pas tenue
--     verrouillée pendant le travail, et un détenteur tué par la plateforme cesse de
--     bloquer à l'échéance de son bail.
--     Voir db/migration-cron-single-flight.sql et lib/single-flight.ts.
create table if not exists cron_locks (
  name        text        primary key,   -- une tâche, p. ex. 'cron:daily'
  holder      text        not null,      -- jeton de l'invocation : elle seule peut rendre son bail
  acquired_at timestamptz not null default now(),
  expires_at  timestamptz not null       -- calée sur le plafond de durée de la plateforme
);

alter table cron_locks enable row level security;
revoke all on table public.cron_locks from anon, authenticated;