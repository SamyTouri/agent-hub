-- Migration 2026-07-25 — les signaux dérivés de métadonnées de dépôt quittent les notes.
--
-- Décision produit publiée sur /decisions : un compteur d'étoiles GitHub n'est pas une note.
-- Les 11 277 lignes `ratings` de source 'github-stars' étaient la conversion d'un compteur
-- par une formule choisie par nous (min(5, log10(stars+1) * 1.25)) : aucun auteur, aucune
-- interaction, et 5 605 d'entre elles valaient 0.00 pour « dépôt sans étoile ». Le score
-- dérivé est SUPPRIMÉ, pas déplacé. Le fait brut survit dans agents.metadata, daté.
--
-- Aucune perte d'information : agents.metadata.github_stars porte déjà le compteur pour
-- les 11 277 fiches concernées (vérifié : 0 divergence avec ratings.metadata->>'stars'),
-- et cette migration y ajoute la date d'observation lue sur la ligne avant de la détruire.
--
-- Ordre imposé : dater d'abord, supprimer ensuite, verrouiller en dernier.

begin;

-- 1. La date d'observation migre depuis la ligne qui va disparaître.
update agents a
set metadata = a.metadata || jsonb_build_object('github_stars_at', to_char(r.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
from ratings r
where r.subject_agent_id = a.id
  and r.source = 'github-stars'
  and a.metadata ? 'github_stars';

-- 2. Garde-fou : plus aucune fiche concernée ne doit perdre son compteur.
do $$
declare orphaned int;
begin
  select count(*) into orphaned
  from ratings r
  join agents a on a.id = r.subject_agent_id
  where r.source = 'github-stars' and not (a.metadata ? 'github_stars');
  if orphaned > 0 then
    raise exception 'ABORT: % derived ratings have no github_stars fact to fall back on', orphaned;
  end if;
end $$;

-- 3. Suppression du score dérivé.
delete from ratings where source = 'github-stars';

-- 4. Verrou : la source dérivée ne peut plus revenir dans la colonne des notes.
alter table ratings drop constraint if exists ratings_no_derived_source;
alter table ratings add constraint ratings_no_derived_source
  check (source <> 'github-stars');

commit;
