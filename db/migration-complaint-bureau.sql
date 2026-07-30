-- Migration PRÉPARÉE, NON APPLIQUÉE — Complaint Bureau, version minimale (2026-07-30).
--
-- Lire cet en-tête avant de l'exécuter. Le bloc est idempotent et ne touche à aucune
-- table existante : il n'ajoute que deux tables et leurs index. Aucune écriture
-- concurrente n'est bloquée, aucune colonne n'est supprimée.
--
-- Ce que ces tables tiennent, et pourquoi elles sont séparées du reste du schéma :
--
--   * `complaint_filings` est le registre PRIVÉ des dépôts. Un dépôt est recevable
--     seulement si son auteur est partie PROUVÉE à une affaire TERMINÉE — la doctrine du
--     2026-07-30. La preuve est une signature sur une déclaration canonique reconstruite
--     par le serveur (lib/complaints.ts) : elle établit le contrôle d'une des deux
--     adresses, jamais autre chose. Elle est conservée telle quelle, avec le texte signé,
--     pour qu'un tiers puisse refaire la vérification sans nous croire.
--
--   * `complaint_events` est le journal APPEND-ONLY d'un dossier : tentative de
--     notification, réponse de la contrepartie, correction datée, publication. Un
--     dossier publié n'est jamais retiré ; il est corrigé avec une date. C'est pour ça
--     que la clé étrangère est `on delete restrict` et que UPDATE/DELETE sont retirés
--     même à service_role : la seule opération autorisée est l'ajout.
--
-- Trois choix à ne pas défaire sans y réfléchir :
--
--   1. `id` est DÉRIVÉ du contenu (réseau, référence d'affaire, adresse, rôle) plutôt
--      qu'aléatoire. Un dépôt rejoué retombe donc sur le même dossier au lieu de créer un
--      doublon, et corriger son récit ne crée pas un second dossier concurrent.
--   2. `filer_contact` est privé par construction. Aucune lecture publique ne le
--      sélectionne, et la Data API REST de Supabase n'a aucun droit sur la table.
--   3. `visible` sur un événement est une relecture HUMAINE, pas une modération de fond.
--      Une réponse reçue mais pas encore relue est comptée et annoncée sur le dossier ;
--      elle n'est jamais dissimulée. Voir la note de limite sur /complaints.
--
-- Après application : replier ce bloc dans db/schema.sql (déjà fait pour la section 23)
-- et archiver ce fichier sous archive/<mois>/applied-migrations/ avec son manifeste.

create table if not exists complaint_filings (
  id                        text primary key,          -- cb-<sha256(network|matter|address|role) tronqué>
  seq                       bigint generated always as identity,
  created_at                timestamptz not null default now(),

  -- Cycle manuel et assumé : reçu -> vérifié à la main -> publié (ou rejeté avec sa raison).
  status                    text not null default 'received'
                            check (status in ('received', 'verified', 'published', 'rejected')),

  -- Les deux parties de UNE transaction. La symétrie est structurelle : le payeur
  -- conteste ce qu'il a reçu, l'encaisseur conteste le comportement de son client.
  claimant_role             text not null check (claimant_role in ('payer', 'payee')),
  claimant_address          text not null check (claimant_address ~ '^0x[0-9a-f]{40}$'),
  counterparty_address      text not null check (counterparty_address ~ '^0x[0-9a-f]{40}$'),
  network                   text not null check (char_length(network) between 5 and 41),

  -- L'affaire, telle qu'elle est publiée par ailleurs. On ne renomme rien.
  matter_reference          text not null check (char_length(matter_reference) between 6 and 200),
  matter_url                text check (matter_url is null or char_length(matter_url) <= 2000),

  -- Pourquoi l'affaire est terminée, et comment un tiers le vérifie seul.
  settled_basis             text not null check (settled_basis in (
                              'payment_reached_payee',
                              'terminal_onchain_state',
                              'frozen_past_deadline'
                            )),
  terminal_state            text check (terminal_state in ('paid', 'refunded', 'expired', 'arbitrated')),
  announced_deadline        date,
  settled_evidence          text not null check (char_length(settled_evidence) between 20 and 1000),

  -- Le sujet TEL QU'IL EST PUBLIÉ. Nommer commercialement un vendeur exige un lien
  -- observable ; à défaut on montre la ressource et l'adresse encaisseuse.
  subject_label             text not null check (char_length(subject_label) between 2 and 300),

  -- La plainte elle-même, plus son empreinte : c'est cette empreinte qui est signée,
  -- donc une signature qui fuiterait ne permet pas de déposer une AUTRE version des faits.
  account                   text not null check (char_length(account) between 80 and 6000),
  account_digest            text not null check (account_digest ~ '^[a-f0-9]{64}$'),

  -- La preuve, conservée vérifiable par un tiers.
  signed_statement          text not null,
  signature                 text not null check (signature ~ '^0x[0-9a-fA-F]{130}$'),

  -- Le délai de réponse ne dépasse jamais la vitesse à laquelle la contrepartie facture.
  counterparty_channel_kind text not null check (counterparty_channel_kind in ('machine', 'human', 'none')),
  counterparty_channel      text check (counterparty_channel is null or char_length(counterparty_channel) <= 500),
  reply_window_hours        int not null check (reply_window_hours between 0 and 24),
  reply_deadline            timestamptz not null,

  -- Privé : sert à vérifier le dépôt, ne sort d'aucune lecture publique.
  filer_contact             text not null check (char_length(filer_contact) between 5 and 320),

  published_at              timestamptz,
  rejected_reason           text,

  constraint complaint_filings_distinct_parties
    check (claimant_address <> counterparty_address),
  constraint complaint_filings_publication_shape
    check ((status = 'published') = (published_at is not null)),
  constraint complaint_filings_rejection_shape
    check ((status = 'rejected') = (rejected_reason is not null)),
  -- Un état terminal n'a de sens que pour la base qui l'invoque, et un gel exige le
  -- délai annoncé : sans lui, « en retard de trente jours » n'est pas mesurable.
  constraint complaint_filings_terminal_state_shape
    check ((settled_basis = 'terminal_onchain_state') = (terminal_state is not null)),
  constraint complaint_filings_freeze_shape
    check ((settled_basis = 'frozen_past_deadline') = (announced_deadline is not null))
);

-- Une seule affaire par (réseau, référence, déposant) : la clé primaire dérivée le
-- garantit déjà, cet index sert les lectures par affaire quand deux parties déposent.
create index if not exists complaint_filings_matter_idx
  on complaint_filings (network, lower(matter_reference));
create index if not exists complaint_filings_published_idx
  on complaint_filings (published_at desc) where status = 'published';
create index if not exists complaint_filings_claimant_recent_idx
  on complaint_filings (claimant_address, created_at desc);

create table if not exists complaint_events (
  id               uuid primary key default gen_random_uuid(),
  seq              bigint generated always as identity,
  filing_id        text not null references complaint_filings(id) on delete restrict,
  kind             text not null check (kind in (
                     'notification_attempt', 'reply', 'correction', 'publication'
                   )),
  occurred_at      timestamptz not null default now(),
  actor            text not null check (actor in ('bureau', 'claimant', 'counterparty')),
  actor_address    text check (actor_address is null or actor_address ~ '^0x[0-9a-f]{40}$'),
  channel          text check (channel is null or char_length(channel) <= 500),
  body             text not null check (char_length(body) between 1 and 6000),
  body_digest      text check (body_digest is null or body_digest ~ '^[a-f0-9]{64}$'),
  signed_statement text,
  signature        text check (signature is null or signature ~ '^0x[0-9a-fA-F]{130}$'),
  -- Relu à la main, donc rendu sur le dossier public. Une réponse non encore relue est
  -- annoncée et comptée sur le dossier : jamais dissimulée.
  visible          boolean not null default false,
  created_at       timestamptz not null default now(),

  -- Une réponse signée est authentifiée : elle porte donc sa preuve, comme un dépôt.
  constraint complaint_events_reply_shape
    check (kind <> 'reply' or (actor = 'counterparty' and body_digest is not null))
);

-- Idempotence d'une réponse rejouée : même dossier, même texte, une seule ligne.
create unique index if not exists complaint_events_reply_unique_idx
  on complaint_events (filing_id, kind, body_digest)
  where body_digest is not null;
create index if not exists complaint_events_filing_idx
  on complaint_events (filing_id, seq);

-- Aucune Data API publique : le registre est privé jusqu'à publication décidée à la main,
-- et le contact du déposant ne doit jamais pouvoir fuir par l'API REST auto-générée.
alter table complaint_filings enable row level security;
alter table complaint_events  enable row level security;
revoke all on table public.complaint_filings from anon, authenticated;
revoke all on table public.complaint_events  from anon, authenticated;
revoke all on sequence public.complaint_filings_seq_seq from anon, authenticated;
revoke all on sequence public.complaint_events_seq_seq  from anon, authenticated;
grant select, insert, update on table public.complaint_filings to service_role;
grant select, insert         on table public.complaint_events  to service_role;
grant usage, select on sequence public.complaint_filings_seq_seq to service_role;
grant usage, select on sequence public.complaint_events_seq_seq  to service_role;
-- Append-only au sens fort : le CORPS d'un événement ne se réécrit jamais et ne s'efface
-- jamais. Seule la colonne `visible` reste modifiable, parce que la relecture humaine est
-- une décision de rendu et non une réécriture de ce que quelqu'un a dit — d'où un droit
-- d'UPDATE limité à cette colonne plutôt qu'à la table.
revoke update, delete, truncate on table public.complaint_events from public, service_role;
grant update (visible) on table public.complaint_events to service_role;
-- UPDATE reste ouvert sur complaint_filings pour la seule transition d'état manuelle.
revoke delete, truncate on table public.complaint_filings from public, service_role;
