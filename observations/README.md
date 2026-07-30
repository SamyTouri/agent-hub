# Carnet d'observations — le volet enquête

Ouvert le 2026-07-30 sur décision de Samy : tout ce qu'on croise de public et d'utile sur le
marché des agents est enregistré au moment où on le voit, plutôt que perdu. C'est le volet
« journaliste-enquêteur » du projet : on va chercher l'information périphérique là où elle
vit, on la date, et on dit exactement à quel point elle est vérifiée.

Le fichier de travail est `observations/YYYY-MM.jsonl`, une ligne JSON par observation,
**append-only**. On n'édite jamais une ligne : on en ajoute une nouvelle qui corrige la
précédente, en la citant par son identifiant. C'est la même discipline que le reste du dépôt —
une correction est datée, jamais un effacement.

## Le degré de vérification est obligatoire

C'est la colonne qui protège tout l'édifice. Une observation sans degré n'a pas le droit
d'exister, parce que c'est exactement comme ça qu'un témoignage devient une preuve par
inadvertance.

| `trust` | Ce que ça veut dire | Ce que ça autorise |
|---|---|---|
| `signed` | Une partie a signé, et nous avons vérifié la signature nous-mêmes | Seul niveau recevable pour un dossier de plainte publié |
| `onchain` | Une transaction publique est citée et vérifiable, mais personne n'a signé pour nous | Citable comme fait, jamais comme dossier |
| `observed` | Nous avons observé le fait directement, et un tiers peut le refaire | Citable comme mesure, avec la méthode |
| `reported` | Témoignage public de première main, non vérifié | Citable comme déclaration attribuée, jamais comme fait |
| `secondhand` | Quelqu'un rapporte ce qu'un autre a dit | Piste de travail, ne se cite pas |

Deux règles qui découlent du reste de la doctrine et qu'il ne faut pas contourner ici. On ne
porte jamais de jugement dans l'observation : on enregistre ce qui a été dit ou constaté, pas
si c'est bien ou mal. Et dès qu'une observation met en cause une contrepartie identifiable,
on lui propose de répondre si elle est joignable ; si elle ne l'est pas, on l'écrit, et
l'absence de canal devient elle-même une information.

## Champs

```
id          identifiant stable, "obs-YYYYMMDD-NNN"
seen_at     date de lecture, ISO
kind        offer | dispute | outage | term_change | testimony | actor | market
trust       signed | onchain | observed | reported | secondhand
subject     de qui ou de quoi il s'agit, tel que publié
claim       le fait, en une phrase, sans qualification ni jugement
source      URL ou identifiant de publication
method      comment on l'a établi, quand trust vaut observed
supersedes  identifiant de l'observation corrigée, le cas échéant
```
