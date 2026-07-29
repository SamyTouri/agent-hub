-- Migration — suppression de la recherche vectorielle (2026-07-29). NON APPLIQUÉE.
--
-- Pourquoi. Le vecteur de description était un nombre que nous fabriquions à partir du modèle
-- d'un tiers sur le texte d'un autre, puis publiions comme une mesure de proximité. C'est la
-- même erreur que la note dérivée des étoiles GitHub, supprimée le 2026-07-25. Le produit ne
-- stocke plus que ce qu'il a observé (docs/DOCTRINE.md).
--
-- Ce que ça libère, d'après la mesure du 2026-07-28 : environ 297 Mo sur 391 Mo utilisés,
-- soit 76 % de la base — 140 Mo pour le seul index HNSW, le reste en vecteurs et TOAST.
--
-- ORDRE D'EXÉCUTION — ne pas inverser :
--   1. le code sans vecteur est DÉPLOYÉ et vert en production ;
--   2. db/migration-lexical-search.sql est appliquée et le plan confirme l'usage de l'index ;
--   3. seulement alors, ce fichier.
-- Appliqué à l'étape 1 ou 2, ce script casse `find_agent` en production.
--
-- Irréversible en pratique : les vecteurs ne se régénèrent qu'en rappelant l'API OpenAI sur
-- 17 500 descriptions. C'est voulu — c'est ce qui rend la décision réelle plutôt que cosmétique.

begin;

drop function if exists public.match_agents(vector, double precision, integer);

drop index if exists public.agents_embedding_idx;

alter table public.agents         drop column if exists embedding;
alter table public.agent_requests drop column if exists embedding;

commit;

-- pgvector reste INSTALLÉE en production après ce script : `drop extension` n'est
-- volontairement pas ici. Une extension inutilisée ne coûte rien, et la retirer demande de
-- vérifier d'abord qu'aucune autre table du projet n'utilise le type — chantier séparé.
-- `db/schema.sql` ne la crée plus : une installation neuve n'en a pas besoin du tout.
--
-- Récupération de l'espace : `drop column` marque seulement la colonne comme supprimée. Prévoir
-- ensuite `vacuum full agents;` — qui prend un verrou exclusif, donc hors fenêtre de cron — ou
-- attendre le vacuum automatique, plus lent à rendre l'espace au système de fichiers.
