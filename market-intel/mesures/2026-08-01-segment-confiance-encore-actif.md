---
title: Le segment confiance, filtré sur l'activité récente
type: mesure
statut: MESURÉ (avec une réserve lourde sur le champ de date)
date: 2026-08-01
updated: 2026-08-01
---

# Sur les 463 agents de la confiance, combien ont une fiche touchée depuis un mois

**Lire d'abord la réserve en bas de page.** Le titre voulu était « combien sont encore actifs » ;
je ne peux pas le mesurer, et cette page dit pourquoi.

## Le résultat

| | |
|---|---|
| Segment confiance complet | 463 agents, 679 310 $ |
| **Fiche mise à jour dans les 30 derniers jours** | **19 agents, 28 038 $** |
| Part du segment | **4,1 %** |

## Les dix-neuf, en entier

| Agent | Revenu | Missions | Acheteurs | $/mission | Fiche vue le |
|---|---|---|---|---|---|
| ArAIstotle | 22 345 $ | 87 938 | 707 | 0,25 $ | 2026-07-04 |
| WachAI | 5 549 $ | 6 137 | 374 | 0,90 $ | 2026-07-07 |
| I.R.I.S | 98 $ | 15 | 4 | 6,54 $ | 2026-07-09 |
| ZeroAgent | 23 $ | 171 | 28 | 0,13 $ | 2026-07-08 |
| Oracle-42 Strike | 9 $ | 672 | 1 | 0,01 $ | 2026-07-06 |
| Delx | 5 $ | 34 | 4 | 0,14 $ | 2026-07-02 |
| ANVIL | 3 $ | 14 | 3 | 0,20 $ | 2026-07-06 |
| WalletProfiler | 2 $ | 77 | 3 | 0,03 $ | 2026-07-13 |
| W3RA · Credo · DALI | ~1 $ chacun | — | — | ~0,02 $ | fin juillet / 1er août |
| Shunsuke · blocknuri · X23Agent · entity-lens · WhaleAI · Custos · hashOracle · JJ | **0 $** | — | — | ~0,01 $ | juillet |

## Ce que ça dit, et c'est brutal

**Deux agents font 99,5 % du segment encore vivant.** ArAIstotle et WachAI totalisent 27 894 $ des
28 038 $. Les dix-sept autres cumulent **144 dollars**, et huit d'entre eux sont à zéro.

Les 17,3 % du marché que représente « la confiance » sont donc **un fait historique, pas une
activité en cours**. Les gros du segment — le scan de sécurité à 7,22 $ la mission, la réputation
à 5,54 $, la due diligence à 5,01 $ ([[2026-08-01-metiers-de-la-confiance]]) — ne sont pas dans
cette liste. Ils ont gagné leur argent puis se sont tus.

Et le seul agent qui vendait vraiment l'évaluation de contrepartie, [[agentpulse]], n'y est pas
non plus : son serveur est éteint, vérifié de première main.

## La réserve, et elle est lourde

Le filtre repose sur `lastActiveAt`, et
[[2026-08-01-marche-acp-taille-et-vitalite]] établit que ce champ est **identique à la date de
publication pour 69,5 % des agents**, les deux bougeant ensemble. Il ne distingue donc pas
« l'agent a travaillé » de « la fiche a été touchée ».

Ce que cette page mesure honnêtement, c'est : **dix-neuf agents du segment confiance ont une fiche
rafraîchie dans les trente derniers jours.** Ce n'est pas la même chose qu'une activité, et il ne
faut pas publier le chiffre comme si ça l'était.

**Ce qui rendrait la mesure solide** : sonder les points d'accès que ces agents publient, en
lecture seule, et enregistrer qui répond — comme cela a été fait pour [[agentpulse]], où date
ancienne et serveur mort concordent. C'est la prochaine mesure à faire, et elle transformerait
une déclaration de plateforme en observation.

Voir aussi : [[2026-08-01-metiers-de-la-confiance]] · [[agentpulse]]
