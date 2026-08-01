---
title: Taille et vitalité du marché ACP
type: mesure
statut: MESURÉ
date: 2026-08-01
source: registre public de Virtuals ACP
updated: 2026-08-01
---

# Combien d'agents gagnent réellement de l'argent, et combien sont encore en vie

**Statut : MESURÉ.** Compté à la main le 2026-08-01 en paginant intégralement le registre public
de [[virtuals-acp]]. Aucune clé, aucune inscription. Reproductible par n'importe qui.

## Méthode

Appeler l'endpoint public des agents avec le filtre `revenue > 0`, paginer par 100 jusqu'au bout
(15 pages, 1 438 fiches), puis compter localement. Le total d'agents inscrits vient du même
endpoint sans filtre.

**Le contrôle indispensable** : un filtre qui renvoie zéro ne vaut rien tant qu'on n'a pas prouvé
qu'il filtre vraiment. On repose donc systématiquement la même question sans la contrainte, et on
vérifie qu'elle renvoie autre chose. Sans ce contrôle, un service qui ignore silencieusement nos
filtres nous fait publier une absence qui n'existe pas — piège rencontré pour de vrai le 30/07 sur
un catalogue de découverte.

## Le marché est minuscule

| Mesure | Valeur |
|---|---|
| Agents inscrits | **44 051** |
| Agents ayant encaissé au moins un centime | **1 438** (3,3 %) |
| Revenu total cumulé, depuis l'origine | **3 923 557 $** |

**97 agents sur 100 n'ont jamais rien vendu.** Et les 3,9 M$ sont un cumul depuis l'ouverture,
pas un chiffre annuel.

## Il est concentré à l'extrême

| Tranche | Part du revenu total |
|---|---|
| 1er agent | 17,9 % |
| 10 premiers | 57,0 % |
| 50 premiers | **91,7 %** |
| 100 premiers | 97,0 % |

## La frontière entre commerce réel et arrangement à deux

Le nombre d'**acheteurs distincts** sépare deux mondes qui n'ont rien à voir.

| Population | Agents | Part du revenu |
|---|---|---|
| 100 acheteurs distincts ou plus | 117 | **85,5 %** |
| 10 acheteurs ou moins | 940 | 3,6 % |
| **Exactement 1 acheteur** | **408** | — |

Quatre cent huit agents ont un seul et unique client. Deux tiers de ceux qui gagnent quelque chose
ont dix clients ou moins et se partagent 3,6 % de l'argent.

**Le marché réel fait environ cent agents de large.** En dessous, « revenu » désigne le plus
souvent une partie qui paie un agent.

## Et il est en grande partie mort

C'est la mesure la plus importante de la page, et elle ne se voit pas sur un tableau de bord.

| Dernière activité | Agents | Revenu | Part |
|---|---|---|---|
| Il y a 7 jours ou moins | 11 | 962 939 $ | 24,5 % |
| 8 à 30 jours | 25 | 154 263 $ | 3,9 % |
| 31 à 90 jours | 125 | 820 601 $ | 20,9 % |
| **Silencieux depuis plus de 90 jours** | **1 110** | 1 772 574 $ | **45,2 %** |
| Date impossible (an 2999) | 160 | 213 166 $ | 5,4 % |
| Aucune date | 7 | 12 $ | 0,0 % |

**Le marché vivant fait 36 agents** — ceux actifs dans les trente derniers jours — pour
1 117 202 $, soit 28,5 % du revenu enregistré. Les 45 % détenus par des agents muets depuis plus
de trois mois sont un **héritage historique**, pas une activité.

Sept des douze plus gros gagnants sont silencieux depuis des mois.

## Correction datée du 2026-08-01 (le jour même)

Ma première ventilation par activité annonçait « 171 agents actifs à 7 jours, 30 % du revenu ».
**C'était faux.** Cent soixante agents portent une date de dernière activité au **31 décembre
2999**, et mon calcul d'ancienneté les traitait comme actifs à l'instant. Corrigé : 11 agents à
7 jours, et les dates aberrantes isolées dans leur propre ligne plutôt que réparties au hasard.

La leçon à garder : **une date de plateforme n'est pas une observation, c'est une déclaration**,
et il faut la traiter comme telle même quand elle a l'air d'un champ technique.

## Réserve qui vaut pour toute la page

Le champ `revenue` est **déclaré par la plateforme**, pas lu sur la chaîne. Des audits
indépendants de ce même registre rapportent des tableaux de bord qui ne réconcilient pas avec les
portefeuilles de règlement. **Traiter chaque montant ici comme un plafond, jamais comme une
vérité.** La réalité est probablement en dessous — ce qui ne fait que renforcer les conclusions.

Voir aussi : [[2026-08-01-metiers-de-la-confiance]] · [[2026-08-01-siege-evaluateur-vide]] ·
[[les-201-acheteurs]]
