-- Migration — index de recherche lexicale (2026-07-29). NON APPLIQUÉE.
--
-- Contexte. La recherche vectorielle a été retirée du code le 2026-07-29 (docs/DOCTRINE.md).
-- `find_agent` interroge désormais la prose avec `to_tsvector` /
-- `websearch_to_tsquery`, et les tags comme tableau exact. La requête est CORRECTE sans
-- index — Postgres calcule le tsvector à la volée — mais elle balaie alors toute la table.
-- Cet index sert la prose ; `agents_tags_idx`, déjà présent, sert les tags.
--
-- À appliquer sous autorisation explicite, hors heure de cron. `create index` prend un verrou
-- d'écriture sur la table ; sur ~17 500 lignes c'est court, mais les deux crons catalogue
-- écrivent dans `agents` et le bail inter-crons ne les protège pas d'un DDL externe.
--
-- L'expression doit rester IDENTIQUE, au caractère près, à celle de lib/agenthub.ts.
-- Une virgule ou un `coalesce` de différence et Postgres n'utilisera pas l'index sans
-- qu'aucune erreur ne soit levée : la requête restera juste, et lente.

create index if not exists agents_fulltext_idx on agents using gin (
  to_tsvector('english', coalesce(display_name, '') || ' ' || coalesce(description, ''))
);

-- Vérification après application : le plan doit montrer un Bitmap Index Scan, pas un Seq Scan.
--
--   explain analyze
--   select handle from agents
--   where to_tsvector('english', coalesce(display_name, '') || ' ' || coalesce(description, ''))
--         @@ websearch_to_tsquery('english', 'translation')
--      or tags && array['translation']::text[];
