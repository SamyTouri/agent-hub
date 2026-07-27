-- Migration 2026-07-27 — journal de preuves append-only + cohorte pilote suivie.
--
-- Additive : ne touche à aucune table existante, ne migre aucune donnée. Le code qui
-- l'utilise tolère l'absence de ces tables (SQLSTATE 42P01) et se contente de ne rien
-- écrire tant que la migration n'est pas appliquée. Idempotent : relançable.
--
-- Application :  node scripts/run-sql-file.mjs db/migration-evidence-history.sql
-- Puis replié dans db/schema.sql (section 21), comme les migrations précédentes.
--
-- ---------------------------------------------------------------------------
-- POURQUOI CE JOURNAL
-- ---------------------------------------------------------------------------
-- Tout le reste du schéma conserve l'état PRÉSENT : l'import registre écrase la
-- description et l'endpoint, la sonde écrase la disponibilité, l'import dépôt écrase le
-- compteur. La valeur remplacée disparaît. Or c'est précisément elle qui a de la valeur
-- avant un achat : un concurrent futur pourra toujours reconstituer l'état courant, jamais
-- l'état supprimé. Ce journal garde ce que les autres tables écrasent.
--
-- Deux règles rendent la chose soutenable sur le plan gratuit :
--   1. une observation n'est écrite que si l'empreinte normalisée change ;
--   2. horodatages et compteurs ne font PAS partie de l'empreinte, donc une sonde
--      identique au 90e jour n'écrit rien. « Quand a-t-on regardé » reste répondu par
--      l'état courant (agents.metadata.endpoint_check) ; « qu'est-ce qui a changé » est
--      répondu ici.
-- Une photographie quotidienne des 17 497 fiches ferait plus de six millions de lignes
-- par an, quasi identiques, pour une preuve nulle. Elle est exclue par construction.

-- ---------------------------------------------------------------------------
-- 1. Cohorte suivie — bornée, et surtout auditable
-- ---------------------------------------------------------------------------
-- La raison de sélection est stockée AVEC le sujet. Un acheteur qui demande « pourquoi
-- ces sujets-là ? » doit obtenir une règle versionnée, pas une intuition rétrospective.
--
-- Pas de clé étrangère vers agents, pour la même raison que le journal : une justification
-- de sélection est un fait daté sur NOTRE méthode, pas une dépendance de la fiche courante.
-- Un `on delete cascade` aurait effacé la trace de la sélection en même temps que le sujet,
-- c'est-à-dire précisément au moment où l'on aimerait pouvoir expliquer pourquoi on avait
-- commencé à le suivre. subject_key garde le handle du jour de la sélection, sinon il ne
-- resterait qu'un uuid orphelin et une raison sans sujet.
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

-- ---------------------------------------------------------------------------
-- 2. Observations — append-only
-- ---------------------------------------------------------------------------
-- Pas de clé étrangère vers agents : c'est délibéré. L'histoire d'un sujet doit survivre
-- à la suppression de sa fiche courante — sans quoi le journal perdrait exactement ce
-- qu'il est censé être seul à détenir. Le lien logique reste subject_agent_id, et
-- subject_key conserve l'identifiant tel qu'il était au moment de l'observation, ce qui
-- rend auditable un changement de handle plutôt que de le réécrire.
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
  -- Une observation sans prédécesseur est un socle, et un socle n'a rien changé.
  check (previous_observation_id is not null or change_summary = '[]'::jsonb)
);

-- Un seul socle par (sujet, source), et un seul successeur par observation : ces deux
-- index sont la garantie RÉELLE contre une double écriture concurrente. Le trigger
-- ci-dessous porte la sémantique, mais deux transactions simultanées le franchiraient
-- toutes les deux — pas ces index.
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

-- ---------------------------------------------------------------------------
-- 3. Immuabilité — refusée au niveau du moteur, pas par convention
-- ---------------------------------------------------------------------------
-- Un journal de preuves qu'on peut corriger discrètement ne prouve rien. Une erreur se
-- rétracte par une nouvelle observation datée (doctrine de correction publique du
-- 2026-07-25), jamais par un UPDATE. Le seul moyen de contourner ce verrou est de
-- désactiver explicitement le trigger en tant que propriétaire de la table : un geste
-- délibéré et traçable, pas un accident applicatif.
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

-- ---------------------------------------------------------------------------
-- 4. Intégrité de chaîne et déduplication
-- ---------------------------------------------------------------------------
-- Volontairement PAS d'unicité globale sur (sujet, source, empreinte) : elle interdirait
-- d'enregistrer un retour à un état antérieur. Or un hôte qui retombe en panne après
-- s'être rétabli est exactement l'information qu'un acheteur veut voir. La déduplication
-- porte donc sur la SUITE : deux observations consécutives identiques sont refusées.
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

-- ---------------------------------------------------------------------------
-- 5. Exposition — aucune, par défaut
-- ---------------------------------------------------------------------------
-- RLS activée et aucune policy : même convention que le reste du schéma, tout passe par
-- le serveur. Surtout, aucun grant anon/authenticated : ces tables ne sont pas une Data
-- API publique. La chronologie complète est le produit payant ; elle ne doit pas fuir par
-- l'API REST auto-générée de Supabase.
alter table evidence_cohort       enable row level security;
alter table evidence_observations enable row level security;

revoke all on table public.evidence_cohort       from anon, authenticated;
revoke all on table public.evidence_observations from anon, authenticated;
revoke all on sequence public.evidence_observations_seq_seq from anon, authenticated;

-- Créées par connexion postgres directe (hors SQL editor) → pas de grants par défaut pour
-- service_role. On accorde le strict nécessaire, et JAMAIS update/delete/truncate sur les
-- observations : défense en profondeur derrière le trigger.
grant select, insert, update on table public.evidence_cohort to service_role;
grant select, insert         on table public.evidence_observations to service_role;
grant usage, select on sequence public.evidence_observations_seq_seq to service_role;
revoke update, delete, truncate on table public.evidence_observations from public, service_role;
