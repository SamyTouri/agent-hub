---
title: LexProtocol / lexescrow — la promesse la plus visible du terrain, mesurée à zéro
type: acteur
updated: 2026-08-04
---

# LexProtocol — 520 commentaires par jour, zéro contrat en cours

Le dossier modèle numéro deux, après [[agentpulse]] : une déclaration publique massive confrontée
à ses propres compteurs publics. Mesuré le **2026-08-04**.

## Ce qui est DÉCLARÉ

Signature répétée à la fin de chaque commentaire du compte `lexescrow`, et reprise dans sa bio :

> *« Agents hire agents with LEX in escrow. 1% fee. 48h auto-approve. Dispute resolution built in —
> evidence in, arbiter rules, LEX settles. Part of LexProtocol — the legal system for AI agents.
> Fulfilled by Inhouselegal.co. »*

**MESURÉ** sur le profil Moltbook : compte créé le 2026-06-25, **20 838 commentaires** et 1 331
billets au 04/08, soit **~520 commentaires par jour** sur 40 jours. Dix billets pour la seule
journée du 4 août. Karma 11 567.

## Ce que la mesure dit

Le service expose une spec OpenAPI publique (`/openapi.json`) et **plusieurs compteurs sans
authentification**. Relevé du 2026-08-04 :

| endpoint | résultat |
|---|---|
| `/v1/escrow/locked` | **`escrow_locked_lex: 0.0`** — aucun contrat d'escrow actif |
| `/v1/marketplace/stats` | 3 730 entrées publiées, 3 670 actives, **`total_reads: 2`**, 33 auteurs |
| `/v1/leaderboard` | sur les 10 premiers, **un seul agent a des parrainages : 99. Tous les autres : 0** |
| `/v1/platform-stats`, `/v1/stats`, `/v1/escrow/open` | en panne : *« connection pool is closed »* |
| `/v1/disputes/open` | 404, alors qu'il figure dans la spec |

**Le produit vendu 520 fois par jour n'a aucun contrat en cours.** Et le marché de contexte
adjacent affiche 3 730 entrées publiées pour **deux lectures** — l'écart production/usage sous sa
forme la plus pure.

## L'ordre de grandeur, une fois converti

**MESURÉ** via `/v1/purchase` : **1 USDC achète 1 000 LEX**, et 1 LEX paie une attestation. Donc
**1 LEX = 0,001 $**. Ce qui recalibre tout ce qui précède :

- les 37 301 LEX « gagnés » par les 33 auteurs du marché de contexte valent **37,30 $** en tout ;
- les 4 950 LEX du seul parrain actif valent **4,95 $** ;
- les 500 LEX offerts aux inscrits venus de Moltbook valent **0,50 $** ;
- le revenu de la plateforme sur ce marché est de 20,2 LEX, soit **2 centimes de dollar**.

Contrat LEX annoncé sur Base : `0x8d8f6953433538dCD8906c42B521504D89144428`.

## Ce n'est pas un concurrent d'ERC-8183, c'est autre chose

Question posée par Samy : son produit passe-t-il par la norme, et serait-il meilleur ? **Non aux
deux, et la seconde question ne se pose pas dans ces termes.**

- **Le produit principal n'est pas l'escrow.** Le titre de l'API est *« LexProtocol Compliance
  API »* et sa description annonce de l'**attestation de conformité au règlement européen sur
  l'IA**. L'escrow est un module à côté du produit, pas le produit.
- **L'escrow n'est pas on-chain.** C'est une API FastAPI adossée à une base de données : les
  contrats, les livrables et les litiges vivent chez l'opérateur. Là où ERC-8183 et PactEscrow
  font tenir les fonds par un contrat que n'importe qui peut lire, ici **c'est l'opérateur qui
  détient tout**. L'endpoint `POST /v1/admin/treasury-sweep` le dit sans détour : *« Sweep agent
  LEX earnings → USDC → treasury wallet. »*
- **Le règlement se fait dans un jeton maison distribué gratuitement**, pas en USDC. La commission
  de 1 % est prélevée sur une unité que l'opérateur émet.

Donc la comparaison honnête n'est pas « meilleur ou moins bon que la norme » : c'est un **escrow
centralisé libellé dans son propre jeton**, quand la norme définit un escrow sans tiers de
confiance. Ce sont deux produits différents vendus avec le même mot.

## Ce que les 520 commentaires par jour sont réellement

`POST /v1/beta/register` porte le résumé *« Free beta registration for **Moltbook users** (500 LEX,
free through Aug 2) »*. Le volume de commentaires est donc une **campagne d'acquisition datée**,
avec offre d'appel et système de parrainage — chaque code de parrainage étant, dit la description
de l'API, *« embarqué dans chaque citation d'attestation que vous recevez »*.

Sa visibilité mesure sa dépense d'acquisition. Elle ne mesure rien d'autre.

## Ce qu'il faut lui reconnaître

Contrairement à [[agentpulse]], **le service existe et répond**, la spec est publique, et
**les compteurs qui l'accablent sont exposés par lui-même sans authentification**. C'est
davantage de transparence que la moyenne du terrain, et ça se dit.

Les huit opinions juridiques du catalogue sont signées *« Inhouselegal.co, an Olisian Brand »* —
donc une marque juridique réelle derrière, pas un pseudonyme. Compte X de l'opérateur :
`Leverage_CG` (« Leverage Creative Group »).

## Identité — trouvée le 2026-08-04

**MESURÉ** via le compte X du produit (`@Leverage_CG`) : la marque « Leverage Brands »
(`leveragebrands.co`) affiche une équipe nommée — **David Loy, CEO** (`David@LeverageBrands.co`,
`615-486-4050`) et **Chase Neely, Président**. Le site se présente comme une agence de marketing
digital généraliste (*« Leverage Brands is here to help your business build trust with its
customers and generate more revenue »*), sans rapport apparent avec l'IA ou la blockchain.

**Lecture retenue** : LexProtocol n'est pas porté par une équipe crypto qui construit un
protocole — c'est une **agence de marketing qui exploite un compte de promotion automatisée** pour
un produit (le sien ou celui d'un client, Inhouselegal.co apparaissant comme la marque juridique
associée aux avis publiés). Ça recadre le volume de 520 commentaires par jour : c'est le métier
même de l'opérateur, pas un excès.

**Réserve** : identité d'équipe trouvée sur le site de la marque commerciale, pas confirmée comme
les opérateurs directs du compte Moltbook — plausible mais non vérifié par recoupement supplémentaire.

## Réserve de méthode

Un relevé unique, un jour donné, sur un service dont plusieurs endpoints étaient en panne au
moment de la mesure. `escrow_locked` à zéro dit **l'encours instantané**, pas l'historique : un
service qui aurait réglé cent contrats et n'en aurait aucun en cours afficherait le même zéro.
Pour conclure sur l'historique il faudrait `/v1/platform-stats`, qui ne répondait pas.

**À re-mesurer avant tout usage public**, et à publier avec cette réserve.
