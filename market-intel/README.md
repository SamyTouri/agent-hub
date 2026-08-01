---
title: Base de connaissance marché — mode d'emploi
type: meta
updated: 2026-08-01
---

# Base de connaissance « marché des agents »

Dossier **autonome et transportable**. Il ne dépend d'aucun code du dépôt : on peut le copier
dans le vault Obsidian, l'ouvrir comme un vault à lui seul, ou le lire tel quel sur GitHub. Les
liens internes sont au format `wikilink Obsidian (double crochet autour du nom de fiche)` pour qu'Obsidian les résolve sans transformation.

Il vit **dans le dépôt** plutôt que directement dans le vault, pour une raison précise : chaque
fait ici est daté, et git donne gratuitement l'historique de ses corrections. Pour un projet dont
l'argument central est « on conserve ce que personne ne conserve », une base de connaissance sans
historique de ses propres révisions serait une contradiction. Copier vers le vault reste possible
à tout moment ; l'inverse ne l'est pas.

**Prose en français** — c'est un outil de travail interne pour Samy et Claude, pas une surface
publique. Les identifiants, noms d'agents et citations restent dans leur langue d'origine.

## La règle qui structure tout : trois statuts, jamais mélangés

C'est la doctrine du projet appliquée à notre propre savoir.

| Statut | Ce que c'est | Comment on l'écrit |
|---|---|---|
| **MESURÉ** | On l'a compté soi-même, la méthode est écrite, quelqu'un d'autre peut refaire le calcul | Chiffre + méthode + date |
| **RAPPORTÉ** | Quelqu'un d'autre l'a mesuré ou l'affirme, on ne l'a pas revérifié | Chiffre + qui l'a dit + URL + date de lecture |
| **DÉCLARÉ** | Un acteur affirme quelque chose sur lui-même | Citation exacte + source + date, jamais reformulée en fait |

**Une page ne mélange jamais les trois sans les étiqueter.** Un chiffre sans étiquette est un
défaut à corriger, pas un détail de forme.

Corollaire : **on ne recopie jamais un compteur d'écosystème** (« 400 000 agents », « 150 M de
transactions ») sans son périmètre et sa méthode. Ces compteurs se contredisent d'un facteur dix
entre sources. C'est la forme exacte du « 15 000+ agents » que le projet a dû rétracter
publiquement le 25/07.

## Les dossiers

- `mesures/` — **ce qu'on a compté soi-même**, une page par mesure, datée, avec sa méthode
  reproductible. C'est le cœur : c'est ce que personne d'autre ne publie.
- `acteurs/` — une page par agent, plateforme, protocole ou personne qui compte.
- `regles/` — comment le marché fonctionne **mécaniquement** : ce que les normes imposent, qui
  paie qui, quand l'argent bouge. Distinct des acteurs, parce que les règles survivent aux acteurs.
- `declarations/` — ce que les acteurs affirment publiquement, cité exactement, avec sa source.
  On garde ce qui a été dit même quand on pense que c'est faux — surtout quand on pense que c'est
  faux.
- `questions-ouvertes/` — ce qu'on ne sait pas, écrit noir sur blanc, avec ce qu'il faudrait pour
  trancher. Une question fermée devient une mesure ; elle n'est jamais effacée en silence.

## Conventions

- Un fait qui change n'écrase pas l'ancien : on ajoute une section **« Correction datée du … »**.
  L'historique de nos erreurs vaut autant que les faits.
- Chaque page commence par un en-tête `title / type / updated`, pour qu'Obsidian et un humain
  pressé sachent tout de suite de quoi il s'agit.
- Le point d'entrée est [[index]].
- Les **concepts** sont la colonne vertébrale : une leçon qui a servi deux fois devient une fiche
  dans `concepts/`, et les mesures y renvoient au lieu de la réexpliquer. C'est ce qui empêche la
  base de n'être qu'une pile de fichiers.
