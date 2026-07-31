-- Immuabilité des pièces d'un dossier — 2026-07-31
--
-- POURQUOI. La migration d'origine a serré `complaint_events` correctement : UPDATE révoqué,
-- puis rendu sur la seule colonne `visible`, de sorte que le corps d'une réponse est
-- immuable une fois reçu. La table des dossiers n'a pas reçu le même traitement : elle porte
-- un `grant select, insert, update` sans liste de colonnes, donc `service_role` peut réécrire
-- le récit, la déclaration signée et la signature elle-même.
--
-- Aucun chemin de code ne s'en sert. Le site insère avec `on conflict do nothing` et ne met
-- jamais à jour ; l'outil opérateur ne touche que le statut, la date de publication et le
-- motif de rejet. Le droit est donc plus large que l'usage, et c'est exactement la situation
-- où l'immuabilité repose sur la discipline plutôt que sur la base. Pour un registre dont la
-- valeur entière tient à ce que ses pièces ne bougent pas, la base doit l'interdire.
--
-- CE QUI RESTE POSSIBLE APRÈS : faire avancer un dossier dans ses états, et rien d'autre.
-- Corriger un dossier publié passe déjà par un ÉVÉNEMENT daté ajouté au registre, jamais par
-- une réécriture — c'est la règle « un dossier publié n'est jamais retiré, il est corrigé
-- avec une date », et ce verrou la rend structurelle au lieu de conventionnelle.
--
-- Appliquer par le port de session (5432), le DDL n'étant pas supporté par le pooler :
--   pwsh -File scripts/with-agenthub-db.ps1 -Port 5432 node scripts/run-sql-file.mjs \
--     db/migration-complaint-filings-immutability.sql

begin;

-- Retire le droit large. `public` est inclus : un rôle futur ne doit pas hériter du trou.
revoke update on table public.complaint_filings from public, service_role;

-- Rend uniquement les trois colonnes que l'outil opérateur fait réellement bouger.
--   status         : received -> verified -> published | rejected
--   published_at   : horodatage de l'acte irréversible
--   rejected_reason: motif d'un refus, conservé sur la ligne
grant update (status, published_at, rejected_reason)
  on table public.complaint_filings to service_role;

commit;
