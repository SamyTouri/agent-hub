-- Migration 2026-07-28 — bail d'exécution unique pour les tâches planifiées.
--
-- Additive : ne touche à aucune table existante, ne migre aucune donnée. Idempotente,
-- relançable. À appliquer AVANT le déploiement du code qui s'en sert, contrairement au
-- journal de preuves : un garde de concurrence n'a pas de mode dégradé acceptable, la
-- route refuse de travailler si elle ne peut pas prouver qu'elle est seule.
--
-- Application :  node scripts/run-sql-file.mjs db/migration-cron-single-flight.sql
-- Puis replié dans db/schema.sql (section 22), comme les migrations précédentes.
--
-- ---------------------------------------------------------------------------
-- POURQUOI
-- ---------------------------------------------------------------------------
-- Le 2026-07-28, quatre invocations de /api/cron/daily se sont chevauchées. Trois ont
-- atteint le plafond de 300 s de la plateforme, la quatrième est morte sur le délai
-- d'instruction PostgreSQL (57014). Les quatre sondaient les mêmes hôtes et écrivaient
-- les mêmes lignes en même temps, alors que chaque instance ne dispose que d'une
-- connexion vers le pooler transactionnel. Le journal append-only a tenu — c'est sa
-- raison d'être — mais le cycle n'a produit aucun résultat exploitable, et chaque agent
-- tiers a été sondé plusieurs fois pour rien.
--
-- ---------------------------------------------------------------------------
-- POURQUOI PAS UN VERROU POSTGRES
-- ---------------------------------------------------------------------------
-- `pg_advisory_lock` est lié à une SESSION. Derrière PgBouncer en mode transaction, la
-- session n'appartient pas à l'application : elle retourne au pool après chaque
-- instruction et peut servir un autre client, verrou compris. La variante
-- `pg_advisory_xact_lock` ne survit pas à sa transaction, alors que le travail à protéger
-- dure des minutes et ne peut pas tenir une transaction ouverte sur l'unique connexion
-- dont il a besoin pour écrire. Un état de processus ne protégerait rien non plus :
-- plusieurs instances serverless ne partagent aucune mémoire.
--
-- ---------------------------------------------------------------------------
-- CE QUE FAIT CETTE TABLE
-- ---------------------------------------------------------------------------
-- Un bail daté, une ligne par tâche. La prise est une seule instruction atomique :
--
--   insert into cron_locks ... on conflict (name) do update ... where l.expires_at <= now()
--
-- Le moteur prend le verrou de ligne avant d'évaluer la clause, donc deux invocations
-- simultanées ne peuvent pas gagner ensemble : la seconde ne reçoit aucune ligne et
-- s'arrête. La ligne n'est PAS verrouillée pendant le travail — l'instruction est validée
-- en quelques millisecondes — ce qui est précisément ce qui rend le bail compatible avec
-- le pooler transactionnel.
--
-- L'échéance est une donnée, pas une propriété de connexion : un détenteur tué par la
-- plateforme ne bloque personne au-delà de son bail. C'est la reprise automatique, et
-- c'est ce qui distingue un bail d'un verrou qu'il faut penser à relâcher.

create table if not exists cron_locks (
  -- Nom de la tâche protégée, p. ex. 'cron:daily'. Un nom par tâche : deux tâches qui
  -- partagent un nom se bloquent mutuellement, deux noms pour une tâche ne protègent rien.
  name        text        primary key,
  -- Identifiant de l'invocation détentrice. Sert de jeton : seule elle peut rendre son
  -- bail, donc une invocation en retard ne peut pas libérer le tour de garde d'une autre.
  holder      text        not null,
  acquired_at timestamptz not null default now(),
  -- Au-delà de cette date, le bail est repris sans question. Le code le cale sur le
  -- plafond de durée de la plateforme : aucune invocation ne peut vivre plus longtemps,
  -- donc un bail plus vieux appartient forcément à une invocation morte.
  expires_at  timestamptz not null
);

-- Aucune surface publique : l'état d'exécution des tâches internes n'a rien à faire dans
-- l'API REST auto-générée de Supabase.
alter table cron_locks enable row level security;
revoke all on table public.cron_locks from anon, authenticated;
