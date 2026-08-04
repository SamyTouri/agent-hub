---
title: Inspector by AURAA — les 88 % du marché des évaluateurs sont de l'argent sorti, pas gagné
type: mesure
statut: MESURÉ on-chain (Base), avec témoin
updated: 2026-08-04
---

# Le plus gros évaluateur d'ACP n'a jamais été payé une seule fois

Chantier A du point de reprise [[devenir-evaluateur-chantiers-ouverts]]. Mesuré le **2026-08-04**
en indexant chaque transfert USDC des portefeuilles concernés sur Base, sans intermédiaire.

**Contient une correction de notre propre mesure du 2026-08-04 matin** — la troisième fois que ce
chiffre change. Voir §6.

## 1. Ce que le registre déclare

`GET acpx.virtuals.io/api/agents?filters[id][$eq]=8806`, relu le 2026-08-04 :

| champ | valeur |
|---|---|
| nom | Inspector by AURAA |
| `description` | **`TESTTESTTESTTESTTESTTESTTESTTESTTESTTEST`** |
| `role` | `EVALUATOR` |
| `successfulJobCount` | 403 |
| `successRate` | 55,74 % |
| `grossAgenticAmount` | 21,95 |
| `revenue` | `null` |
| `uniqueBuyerCount` | **0** |
| `offerings` | **`[]`** — aucune offre publiée |
| `walletBalance` | `0` |
| `lastActiveAt` | 2026-05-27T12:54:22.490Z |
| propriétaire | `0xc346c5b657a609eeb84c30f7625a814f181a0636` |
| portefeuille | `0x9D78601966bEa207820B47644E03EA79B79964F0` |

C'est l'agent qui portait **88 % des 25,05 $** que nous avions présentés le matin même comme le
marché des évaluateurs d'ACP. Sa description est le mot `TEST` répété dix fois.

Le même propriétaire opère **exactement un autre agent** : `Metrics by AURAA` (#7442, `PROVIDER`,
679 missions, `grossAgenticAmount` 151,62, 6 acheteurs uniques). Les deux portent un `lastActiveAt`
au **2026-05-27T12:54:2x** — à deux secondes l'un de l'autre. Ce n'est pas de l'activité, c'est une
**écriture de métadonnée en lot**. Voir §4.

## 2. Méthode

Contrats lus sur Base (chainId 8453), nœud public `mainnet.base.org`, aucune clé :

- jeton **USDC** `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` ;
- événement `Transfer(address,address,uint256)`, `topic0`
  `0xddf252ad…3b3ef`, filtré sur `topic1` (émetteur) puis `topic2` (destinataire) ;
- fenêtre balayée par tranches de 10 000 blocs (limite du nœud public), blocs 41 800 000 →
  46 580 000, soit du 2026-01-30 au 2026-05-28 — plus large que toute la vie des agents mesurés.

**Deux adresses d'infrastructure identifiées au passage**, jamais publiées à notre connaissance :

- `0xa6C9BA866992cfD7fd6460ba912bfa405adA9df0` — le **contrat ACP** appelé par les transactions
  (c'est aussi le champ `contractAddress` de chaque fiche agent) ;
- `0xef4364fe4487353df46eb7c811d4fac78b856c7f` — le **coffre** qui détient et verse les USDC.
  Proxy EIP-1967, implémentation `0x6168335568d731ebb113a2373168157c57c9d6fe`.

Toutes les sorties des agents passent par l'**EntryPoint ERC-4337**
`0x0000000071727De22E5E9d8BAf0edAc6f37da032` : ce sont des comptes à abstraction, poussés par un
relayeur.

## 3. Ce que la chaîne montre

**Inspector n'a que deux contreparties USDC dans toute son existence** : son propre propriétaire, et
le coffre ACP. Personne d'autre ne lui a jamais envoyé un centime.

| flux | transferts | USDC |
|---|---|---|
| coffre ACP → Inspector | 379 | **19,40** |
| Inspector → coffre ACP | 782 | **41,35** |
| propriétaire → Inspector | 2 | 30,00 |
| Inspector → propriétaire | 1 | 8,05 |

**Net vers le coffre : 41,35 − 19,40 = 21,95 USDC.** C'est, au centime près, le
`grossAgenticAmount` que le registre affiche. Et c'est de l'argent **sorti**.

### Le détail qui tranche : les dénominations

| sens | montants observés |
|---|---|
| Inspector → coffre | 777 × 0,05 $ · 5 × 0,50 $ |
| coffre → Inspector | 378 × 0,05 $ · 1 × 0,50 $ |

**Aucun montant fractionnaire n'est jamais arrivé.** Or une commission d'évaluateur ERC-8183 est un
**pourcentage** de la mission (5 % sur ACP) : elle produirait mécaniquement des montants qui ne sont
pas des multiples exacts du dépôt. Chaque entrée d'Inspector est la **restitution intégrale d'un
dépôt qu'il avait lui-même fait**.

**Conclusion : Inspector by AURAA n'a jamais encaissé une seule commission d'évaluateur.** Il a
déposé 41,35 $ dans le séquestre, en a récupéré 19,40 $ par remboursement, et a perdu la différence.

Le `uniqueBuyerCount: 0` n'est donc pas une anomalie du champ, contrairement à ce que nous
supposions le 04/08 au matin. **Il est exact.** Cet agent n'a pas d'acheteur parce qu'il est
lui-même l'acheteur.

### Le même motif chez les deux autres évaluateurs mesurables

| agent | dépôts vers le coffre | retours du coffre | net sorti | `grossAgenticAmount` |
|---|---|---|---|---|
| Inspector by AURAA | 777 × 0,05 + 5 × 0,50 = 41,35 | 378 × 0,05 + 1 × 0,50 = 19,40 | **21,95** | 21,95 |
| Minos | 20 × 0,10 = 2,00 | 1 × 0,10 = 0,10 | **1,90** | 1,90 |
| May | 21 × 0,01 = 0,21 | 1 × 0,01 = 0,01 | **0,20** | 0,20 |
| Cournot AI | 47 transferts = 0,695 | 9 transferts = 0,225 | **0,47** | 0,47 |

Quatre fois sur quatre, l'égalité avec le champ déclaré tombe **au centime**.

Cournot est le cas le plus instructif parce que ses montants sont variés — 0,01 · 0,02 · 0,025 ·
0,03 · 0,05 · 0,06. On pourrait y voir des commissions fractionnaires. Non : **chaque dénomination
entrante figure aussi dans ses sorties**, et pour la même unité. Ce sont encore des restitutions de
dépôts, une par une.

## 3bis. Le cinquième — et c'est lui qui valide la méthode

**Veri Agent** (#4980) est le seul des cinq dont les flux ont la forme inverse :

| flux | transferts | montant unitaire | total |
|---|---|---|---|
| coffre ACP → Veri | **53** | **0,008 $** — toujours le même | **0,424** |
| Veri → coffre ACP | **0** | — | **0** |

Aucune sortie. Un montant **fractionnaire** qui ne correspond à aucun dépôt, puisqu'il n'y a pas de
dépôt. Et **53 versements pour 53 missions réussies déclarées** — la correspondance est exacte.

C'est la signature qu'on attendait d'une commission : une part prélevée, pas une somme rendue. Le
critère « fractionnaire et sans contrepartie sortante » n'était donc pas une pétition de principe —
il sépare effectivement les cinq agents en deux groupes, et il en isole un seul du bon côté.

Son activité tient dans **une journée** (blocs 42 433 241 → 42 477 900, 2026-02-20). Elle est
antérieure à notre première fenêtre de balayage, ce qui l'avait rendue invisible : d'où
l'élargissement, et la règle qu'il vaut mieux relire que conclure.

## 3ter. Le total, une fois les deux formes séparées

| | USDC |
|---|---|
| déposé dans le séquestre par les cinq | **44,26** |
| remboursé aux cinq | 19,74 |
| **perdu net dans le séquestre** | **24,52** |
| **commissions d'évaluateur réellement encaissées** | **0,42** (Veri seul) |

**Le siège d'évaluateur d'ERC-8183/ACP a versé 0,42 dollar depuis son existence, à un seul agent,
en une journée de février 2026.** Ses occupants y ont laissé 58 fois cette somme.

## 4. La date d'arrêt que nous avions retenue est fausse

Nous avions écrit qu'Inspector s'était « arrêté le 2026-05-27 », en lisant `lastActiveAt`.

**Mesuré** : toute son activité USDC tient entre les blocs 43 225 566 et 43 412 080, soit du
**2026-03-11 au 2026-03-15** — environ **quatre jours**. Rien avant, rien après, jusqu'au terme du
balayage (2026-05-28).

Le 27 mai n'est pas une date d'activité : c'est l'horodatage d'une écriture de fiche, identique à
deux secondes près sur les deux agents du même propriétaire. Cas d'application directe de
[[date-de-plateforme-est-une-declaration]].

Même resserrement chez les autres : **Minos** a tout fait en ~7 heures (blocs 43 574 028 →
43 586 809), **May** en ~13 heures (42 986 700 → 43 010 769). Ce ne sont pas des carrières
d'évaluateur, ce sont des **sessions d'essai**.

## 5. Le témoin — et il refuse l'hypothèse facile

Doctrine maison : avant de publier une régularité, la mesurer sur un témoin qui n'a aucune raison de
la présenter. Témoin retenu : **Metrics by AURAA** (#7442), même propriétaire, rôle `PROVIDER`,
c'est-à-dire un agent qui *encaisse*.

| flux | transferts | USDC |
|---|---|---|
| coffre ACP → Metrics | 280 | 100,04 |
| Metrics → coffre ACP | 48 | 4,80 |
| **net reçu** | | **95,24** |
| `grossAgenticAmount` déclaré | | **151,62** |

**L'égalité ne tient pas.** 95,24 ≠ 151,62. Nous **n'avons donc pas décodé** ce que
`grossAgenticAmount` mesure, et nous ne le prétendons pas.

Ce que le témoin établit en revanche, et qui suffit :

1. Un agent qui gagne vraiment reçoit des **montants fractionnaires et variés** (0,04 · 0,24 · 0,40 ·
   0,80 · 1,60) — la signature d'une part prélevée sur des missions de tailles différentes. Les
   évaluateurs, eux, ne reçoivent que des remboursements ronds.
2. Le sens du flux est inversé : Metrics reçoit 100 et verse 5 ; Inspector verse 41 et reçoit 19.
3. Metrics **remonte ses gains au propriétaire** (5 virements, 91,88 $ nets). Inspector, lui, a été
   **alimenté** par le propriétaire.

## 6. CORRECTION — troisième version du même chiffre

| date | ce que nous avons publié | statut |
|---|---|---|
| 2026-08-01 | « 75 évaluateurs, **aucun revenu** » | faux par lecture d'un seul champ |
| 2026-08-04 matin | « **25,05 $ gagnés** sur 532 verdicts, ~0,047 $ pièce » | corrige le champ, **se trompe de sens** |
| 2026-08-04 soir | **les cinq ont perdu 24,52 $ net dans le séquestre ; les commissions d'évaluateur réellement versées totalisent 0,42 $, à un seul d'entre eux** | mesuré on-chain |

Le premier chiffre lisait `revenue` et concluait sur l'activité. Le deuxième lisait
`grossAgenticAmount` et **supposait** que c'était de l'argent entrant. Ni l'un ni l'autre n'avait
regardé la chaîne, alors que la chaîne est publique, gratuite, et qu'elle a demandé douze minutes.

La leçon n'est pas nouvelle, elle est juste plus chère cette fois : [[volume-brut-nest-pas-revenu]]
disait de se méfier du volume ; il faut ajouter **de se méfier de son sens**. Un champ appelé
« montant » ne dit pas qui paie qui.

**Ce que la correction ne change pas** : la conclusion de fond. Le siège d'arbitre d'ERC-8183 ne
nourrit personne. Elle la durcit d'un facteur soixante — on passe de « 25 $ gagnés pour 532
verdicts » à « **0,42 $ de commissions versées, et 24,52 $ laissés dans le séquestre par ceux qui
ont essayé** ».

**Ce qu'elle change pour nous** : c'est une raison d'y aller, pas d'y renoncer. Un siège que
personne n'occupe parce que personne n'a encore été payé pour l'occuper n'est pas la même chose
qu'un siège essayé et abandonné. Cadrage de Samy du 2026-08-04, non re-litigé.

## 7. Ce qui reste ouvert

- **L'écart de Veri** : il a encaissé 0,424 (53 × 0,008) alors que son `grossAgenticAmount` déclaré
  est 0,53 (= 53 × 0,01, son prix affiché). Le rapport est exactement **80 %**. Une retenue de 20 %
  par la plateforme sur la commission de l'évaluateur expliquerait le chiffre, mais **une seule
  observation ne fait pas une règle** — à confirmer avant tout usage.
- La commission d'évaluateur pourrait-elle être versée à l'**adresse du propriétaire** plutôt qu'au
  portefeuille de l'agent ? Vérification lancée sur `0xc346…` ; tant qu'elle n'a pas rendu, la
  formule prudente est « aucune commission n'est arrivée **sur le portefeuille de l'agent** ».
- Le volume total du coffre ACP et la **distribution des tailles de mission** — la mesure qui
  manque pour chiffrer ce que rapporterait réellement 5 % ([[devenir-evaluateur-chantiers-ouverts]],
  chantier B).

## Refaire la mesure

```
tranches de 10 000 blocs sur https://mainnet.base.org
eth_getLogs { address: USDC, topics: [Transfer, null, pad(wallet)] }   → entrées
eth_getLogs { address: USDC, topics: [Transfer, pad(wallet), null] }   → sorties
```
Script de session : `inspector-onchain.mjs`. Le coffre à reconnaître est
`0xef4364fe4487353df46eb7c811d4fac78b856c7f`.
