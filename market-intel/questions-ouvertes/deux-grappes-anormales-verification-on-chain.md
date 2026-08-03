---
title: Les deux grappes — l'anomalie on-chain est RÉFUTÉE, et ce qui reste est plus intéressant
type: question ouverte (résolue en grande partie)
statut: MESURÉ — hypothèse initiale abandonnée le 2026-08-03
date: 2026-08-03
updated: 2026-08-03
---

# ⛔ L'anomalie on-chain n'existe pas. Test témoin à l'appui.

**Cette fiche a d'abord soutenu qu'un faible nombre d'expéditeurs autour de quinze agents était
troublant. C'était faux, et le test témoin prévu dans la version précédente l'a démontré le jour
même.** La version initiale est conservée plus bas pour que l'erreur reste lisible.

## Le test témoin, et il est sans appel

Même méthode, appliquée à des agents **hors grappe** de revenu comparable :

| Agent | Revenu | Acheteurs annoncés | **Expéditeurs distincts** |
|---|---|---|---|
| **Maya** (témoin) | 54 227 $ | **1 417** | **2** |
| x402guard_pentester (témoin) | 47 600 $ | 206 | 3 |
| BloombergAI (témoin) | 41 530 $ | 26 | 3 |
| ArAIstotle (témoin) | 22 345 $ | 707 | 7 |
| The TA Guru (témoin) | 26 368 $ | 613 | 9 |
| aixbt (témoin) | 38 200 $ | 1 904 | 14 |
| *Synapse (grappe B)* | *56 515 $* | *1 004* | *7* |
| *ERC-8183 Inspector (grappe A)* | *28 170 $* | *201* | *3* |

**Maya — agent parfaitement ordinaire, 1 417 acheteurs — montre DEUX expéditeurs. Deux fois moins
que l'agent de grappe.** Les grappes sont au milieu de la distribution témoin, pas au bord.

## Pourquoi c'était voué à ne rien dire

**Le chemin de l'argent, mesuré sur deux règlements réels** (un témoin, un de grappe) : l'acheteur
**n'apparaît jamais** comme expéditeur. C'est un contrat, le **PaymentManager** de la plateforme,
qui verse à l'agent — avec une commission constante de 20 % prélevée au passage.

**Compter les expéditeurs d'un portefeuille d'agent revient à compter les guichets de la banque,
pas les clients.**

Et les deux autres signaux tombent avec :

- **Le nonce à zéro** n'est pas suspect : ces portefeuilles ne sont pas des comptes ordinaires,
  ce sont des **comptes intelligents** dont les opérations passent par un point d'entrée commun.
  Tous les témoins affichent zéro aussi.
- **Le solde USDC nul** est l'état normal : les agents balayent leur solde. Un témoin hors grappe
  à 47 600 $ de revenu est à zéro lui aussi.
- **Les « poussières de CBBTC »** que j'avais relevées viennent d'un contrat nommé **AgentTax** —
  la redistribution de la taxe de trading sur les jetons d'agents. Elles arrosent tous les agents
  mesurés, témoins compris.

## Et les nombres 201 et ~1000 ont une cause mécanique

**Le motif « N agents partagent exactement le même compte d'acheteurs » est courant sur cette
place en mars 2026, et n'implique aucune coordination.** La valeur **300** est portée par
**18 agents, dont 17 créés le même jour par 17 propriétaires tous différents**.

**Le ~1000 vient du job, pas du propriétaire.** Les quatre agents de la grappe B vendent tous le
même job — un « contrôle de santé » à **un centime**. Sur les agents relevés, cinq seulement
vendent ce job : les quatre de la grappe **et un cinquième sans aucun lien avec eux**. Les cinq
ont ~1000 acheteurs.

**Et la pièce la plus directe** : un agent de la grappe A porte comme description publique, en
coréen, *« évaluation de test aGDP v0.0.2 »*. **Il se déclare lui-même agent de test du programme
d'incitation de la plateforme** — un programme qui versait, RAPPORTÉ, jusqu'à un million de
dollars par mois et qui s'est terminé en mars 2026, exactement la fenêtre de création des deux
grappes.

**Pas de financeur commun** non plus : quatorze mois séparent le plus ancien propriétaire du plus
récent.

---

# ⚠️ Ce que l'enquête a trouvé à la place, et qui est bien plus grave

**Le champ « revenu » de cette plateforme ne mesure pas que des ventes.**

Mesuré : sur un agent de la grappe B, une seule transaction verse **1 803,81 USDC** depuis un
contrat de distribution à preuve Merkle, réclamée par le propriétaire lui-même. À comparer aux
**8 dollars** que rapporte un job réel chez le même agent. Le même contrat de distribution apparaît
chez des agents témoins.

**Donc le « revenu » agrège des ventes réglées et des récompenses d'un programme de subvention
réclamées par l'opérateur.** Il n'y a aucun moyen, depuis l'API, de séparer les deux.

## Conséquence pour nos propres publications — correction due

Le chiffre de **3 923 557 $** que porte [[2026-08-01-marche-acp-taille-et-vitalite]], et que nous
avons **publié publiquement le 2026-08-01**, n'est donc pas « ce que les agents ont vendu ». C'est
**ventes + subventions réclamées**, dans une proportion inconnue.

Ça ne détruit pas les mesures qui en dérivent — la concentration, la répartition par acheteurs, la
part spéculative — mais **ça change ce que le total veut dire**, et il faut le dire là où on l'a
écrit. Correction publiée le 2026-08-03.

Cette découverte renforce d'ailleurs [[2026-08-03-quelle-part-est-un-vrai-service]] : si une part
du revenu est de la subvention, alors le vrai service pèse **encore moins** que le million de
dollars estimé.

---

# Ce qui reste vrai, et qui est publiable

Rien de tout ceci n'est une anomalie de chaîne. C'est une observation sur **la qualité économique
de la place** :

- Un propriétaire détient cinq agents affichant chacun exactement 201 acheteurs ; un autre en
  détient quatre créés le même jour, sans aucune description.
- Un job décrit comme « une simple mission de validation » se vend 30 $ ; un « contrôle de santé »
  se vend un centime. **La structure de prix suit la logique du programme d'incitation, pas celle
  d'un marché de services.**
- Et le point central : **le revenu affiché mélange vente et subvention**, sans distinction
  possible.

---

# La leçon de méthode, et c'est la vraie valeur de cette fiche

**Le test témoin a coûté une heure et il a détruit une hypothèse spectaculaire.** Sans lui, nous
aurions publié qu'un groupe d'agents pesant 11,4 % du marché présentait une signature on-chain
douteuse — ce qui est faux, et diffamatoire.

La version précédente de cette fiche disait : *« le test le moins cher, et il doit être fait en
premier »*. Il l'a été, il a donné tort à l'intuition, et **c'est le meilleur résultat qu'une
enquête puisse produire**.

Règle à retenir : **avant de publier une régularité, mesurer la même chose sur un témoin qui n'a
aucune raison de la présenter.** Sans témoin, une régularité n'est qu'une chose qu'on n'a pas
l'habitude de voir.

---

## Version initiale du 2026-08-03, conservée

Elle relevait : quinze portefeuilles à nonce nul et zéro USDC ; huit expéditeurs distincts sur
cinquante transferts chez le plus gros de la grappe B ; deux adresses concentrant 41 transferts ;
un destinataire sortant identifié comme le propriétaire. Elle nommait trois lectures possibles et
**donnait la première — « le règlement passe par le contrat, donc ça ne prouve rien » — comme la
plus probable**. C'était la bonne, et c'est celle que le test a confirmée.

Elle refusait déjà explicitement de parler de blanchiment. Cette prudence-là était la bonne
décision ; l'erreur était d'avoir publié la régularité avant d'avoir le témoin.

Voisin : [[les-201-acheteurs]] · [[2026-08-01-marche-acp-taille-et-vitalite]] ·
[[volume-brut-nest-pas-revenu]] · [[controle-du-filtre]]
