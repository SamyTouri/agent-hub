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

## Correction datée du 2026-08-01 (le jour même) — première passe

Ma première ventilation par activité annonçait « 171 agents actifs à 7 jours, 30 % du revenu ».
**C'était faux.** Cent soixante agents portent une date de dernière activité au **31 décembre
2999**, et mon calcul d'ancienneté les traitait comme actifs à l'instant. Corrigé : 11 agents à
7 jours, et les dates aberrantes isolées dans leur propre ligne plutôt que réparties au hasard.

## ⚠️ Correction datée du 2026-08-01 — seconde passe : le tableau de vitalité ci-dessus n'est PAS fiable

**À lire avant d'utiliser le moindre chiffre de la section « en grande partie mort ».**

En vérifiant la fiche d'[[agentpulse]], j'ai vu que sa « dernière activité » était identique à sa
date de publication **à la milliseconde près**. J'ai donc testé la coïncidence sur tout le corpus :

| Relation entre `publishedAt` et `lastActiveAt` | Agents | Part |
|---|---|---|
| **Identiques à la seconde** | **1 000** | **69,5 %** — et 3 370 606 $, soit 86 % du revenu |
| Même jour, heure différente | 157 | 10,9 % |
| Réellement différentes | **114** | **7,9 %** |
| Inexploitables | 167 | 11,6 % |

Et `publishedAt` n'est pas non plus une date de première publication : l'agent le plus riche du
marché est créé en juin 2025 et « publié » le 31 juillet 2026. **Ce champ est mis à jour.**

**Conclusion honnête : je ne sais pas distinguer « l'agent a travaillé » de « la fiche a été
touchée ».** Les deux champs bougent ensemble. Une date récente ne prouve pas une activité, une
date ancienne ne prouve pas un arrêt. **Le chiffre « 36 agents vivants » ne doit donc pas être
cité.** Ce que j'ai réellement mesuré, c'est : 36 agents ont une fiche récemment mise à jour.

**Ce qui reste vrai et exploitable de cette page** : le nombre d'inscrits, le nombre d'agents avec
du revenu, le total, la concentration, et la répartition par nombre d'acheteurs. Ces mesures ne
dépendent d'aucune date.

**La seule méthode fiable pour la vitalité est la sonde.** Interroger l'endpoint que l'agent
publie, en lecture seule, et enregistrer ce qui répond. Premier point de validation : le serveur
d'[[agentpulse]] ne répond plus du tout, ce qui concorde avec sa date ancienne. **Une concordance
n'est pas une validation** — il en faudrait plusieurs dizaines pour que le champ redevienne
utilisable, et c'est une mesure à faire.

La leçon générale, et c'est la deuxième fois dans la même journée : **une date de plateforme n'est
pas une observation, c'est une déclaration.** Elle se traite comme telle même quand elle a l'air
d'un champ technique anodin.

## Réserve qui vaut pour toute la page

Le champ `revenue` est **déclaré par la plateforme**, pas lu sur la chaîne. Des audits
indépendants de ce même registre rapportent des tableaux de bord qui ne réconcilient pas avec les
portefeuilles de règlement. **Traiter chaque montant ici comme un plafond, jamais comme une
vérité.** La réalité est probablement en dessous — ce qui ne fait que renforcer les conclusions.

Voir aussi : [[2026-08-01-metiers-de-la-confiance]] · [[2026-08-01-siege-evaluateur-vide]] ·
[[les-201-acheteurs]]
