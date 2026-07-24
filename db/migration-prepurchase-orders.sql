-- Migration appliquée le 2026-07-23 au projet Supabase AgentHub sous le nom
-- prepurchase_orders, puis repliée dans db/schema.sql. Registre privé des
-- commandes préachat payées en x402. Le bloc reste idempotent.
--
-- Modèle de faits VOLONTAIREMENT séparés (règle produit Agent Reputation) :
--   1. paiement réglé   -> colonnes payment_* / settled_at (écrites par le serveur
--      après règlement facilitator, jamais avant) ;
--   2. livraison        -> delivered_at / delivery_reference (mises à jour à la main
--      quand le brief part — la livraison du MVP est manuelle) ;
--   3. résultat acheteur -> buyer_outcome / buyer_outcome_at (ce que l'acheteur dit
--      du brief, s'il le dit).
-- Un paiement réglé ne prouve NI la livraison NI la satisfaction : ne jamais
-- fusionner ces groupes dans une vue publique.

create table if not exists prepurchase_orders (
  id                  text primary key,             -- apo_<sha256(network:nonce) tronqué>, dérivable/rejouable
  created_at          timestamptz not null default now(),

  -- Cycle de paiement : reserved est créé avant settle sous verrou global de
  -- plafond ; settled n'est écrit qu'après confirmation du facilitator.
  payment_status      text not null default 'reserved'
                      check (payment_status in ('reserved', 'settled')),

  -- Faits de paiement (source : facilitator x402)
  network             text not null,                -- CAIP-2, ex. eip155:84532
  asset               text not null,                -- adresse du contrat USDC
  amount_atomic       numeric(38,0) not null,       -- unités atomiques (USDC : 6 décimales)
  pay_to              text not null,                -- adresse de réception configurée
  payer               text,                         -- adresse payeuse (facilitator ou authorization.from)
  payment_nonce       text not null,                -- nonce EIP-3009 : clé d'idempotence
  payment_transaction text,                         -- hash de la transaction de règlement
  settled_at          timestamptz,
  evidence_cutoff     timestamptz,                  -- borne de preuve annoncée à l'acheteur
  delivery_deadline   timestamptz,                  -- échéance promise (settled_at + 24h)

  -- Périmètre accepté (intake acheteur ; minimum nécessaire, pas plus)
  candidate           text not null,
  mission             text not null,
  budget_exposure     text not null,
  failure_consequence text not null,
  public_constraints  text,
  -- Contact privé de livraison : nécessaire pour livrer, JAMAIS exposé par une
  -- API publique, jamais loggé, purgeable après livraison + délai de litige.
  delivery_contact    text not null,

  -- Faits de livraison (manuels, séparés du paiement)
  delivered_at        timestamptz,
  delivery_reference  text,                         -- ex. hash de contenu du brief livré

  -- Faits de résultat acheteur (séparés de la livraison)
  buyer_outcome       text,
  buyer_outcome_at    timestamptz,

  unique (network, payment_nonce),
  constraint prepurchase_orders_settlement_shape
  check (
    (payment_status = 'reserved' and settled_at is null and evidence_cutoff is null and delivery_deadline is null)
    or
    (payment_status = 'settled' and settled_at is not null and evidence_cutoff is not null and delivery_deadline is not null)
  )
);

create index if not exists prepurchase_orders_created_idx on prepurchase_orders (created_at desc);

-- RLS : activée, aucune policy publique — même convention que le reste du schéma.
-- L'application passe par la connexion serveur ; aucun accès anon/authenticated.
alter table prepurchase_orders enable row level security;
revoke all on table public.prepurchase_orders from anon, authenticated;
-- Si la table est créée par connexion postgres directe (hors SQL editor), pas de
-- grants par défaut pour service_role — même pattern que crawler_hits :
grant select, insert, update on table public.prepurchase_orders to service_role;
