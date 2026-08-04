---
title: Le séquestre ACP, mois par mois — de 1,16 million de dollars à neuf dollars
type: mesure
statut: MESURÉ on-chain (Base), avec témoin de migration
updated: 2026-08-04
---

# Le marché du commerce entre agents n'a pas échoué à démarrer. Il a démarré, puis s'est arrêté.

Mesuré le **2026-08-04** en indexant **tous** les transferts USDC du séquestre de Virtuals ACP sur
Base, depuis sa première transaction. 1,38 million de transferts lus, aucune tranche perdue.

C'est la mesure la plus lourde produite par ce dépôt à ce jour, et elle contredit la façon dont nous
décrivions le marché depuis le 1er août.

## 1. Les adresses

| rôle | adresse |
|---|---|
| contrat ACP appelé par les agents | `0xa6C9BA866992cfD7fd6460ba912bfa405adA9df0` |
| **coffre qui détient les USDC** | `0xef4364fe4487353df46eb7c811d4fac78b856c7f` |
| second contrat ACP (minoritaire, voir §4) | `0x6a1fe26d54ab0d3e1e3168f2e0c0cda5cc0a0a4a` |

Nous n'avons trouvé ces adresses publiées nulle part. Elles se déduisent d'une transaction
quelconque d'un agent ACP.

## 2. Le cumul

| | valeur |
|---|---|
| dépôts entrants | **1 377 726 transferts, 3 565 277 $** |
| versements sortants | 1 331 835 transferts, 1 567 958 $ |
| déposants distincts | **23 840** |
| bénéficiaires distincts | **8 183** |
| dépôt médian | **0,50 $** |
| p90 / p99 / max | 3 $ / 40 $ / **97 000 $** |
| première transaction | bloc 36 806 122 (≈ 2025-10) |

**Le total corrobore, indépendamment et pour la première fois, le chiffre de ~3,9 M$ annoncé par la
plateforme.** Nous l'avions repris comme une déclaration ([[virtuals-acp]]) ; il est désormais
vérifiable. C'est un point à porter au crédit d'ACP, et il faut le dire aussi clairement que le
reste.

## 3. La série mensuelle — et c'est là que tout se joue

| mois | dépôts | USDC entrés | versements | USDC sortis |
|---|---:|---:|---:|---:|
| 2025-10 | 7 073 | 373,78 | 12 975 | 369,81 |
| 2025-11 | 186 245 | 240 934,33 | 337 443 | 238 585,97 |
| 2025-12 | 296 750 | 952 560,23 | 204 895 | 339 302,39 |
| 2026-01 | 173 151 | 136 550,97 | 149 670 | 85 401,73 |
| **2026-02** | 304 846 | **1 161 072,58** | 286 787 | 371 059,27 |
| **2026-03** | 368 828 | **1 039 223,30** | 279 025 | 498 984,11 |
| 2026-04 | 37 715 | **34 050,15** | 59 248 | 33 994,82 |
| 2026-05 | 2 105 | **473,70** | 1 701 | 248,16 |
| 2026-06 | 569 | **28,56** | 84 | 11,11 |
| 2026-07 | 428 | **9,56** | 7 | 0,28 |
| 2026-08 (4 j.) | 16 | 0,16 | 0 | 0,00 |

**De mars à juillet 2026, le volume déposé chute d'un facteur 109 000.** Ce n'est pas un
ralentissement, c'est un arrêt. En juillet, sept versements sont sortis du séquestre, pour
vingt-huit centimes.

Découpage par date : bloc → horodatage par ancrage sur le bloc 49 532 447 (2026-08-04T14:07Z) et
blocs de 2 secondes. Les frontières de mois sont donc précises à quelques heures — sans effet sur
des écarts de cet ordre.

## 4. Le témoin — la migration de contrat, testée et écartée

L'explication concurrente évidente : le trafic serait passé à un nouveau contrat, et nous
mesurerions un déménagement, pas une mort. **Testé.**

Sur les 60 agents ACP les plus récemment actifs, **7 pointent vers un second contrat**
`0x6a1fe26d…0a4a`. Mesuré depuis mars 2026, aucune tranche perdue :

| mois | dépôts | USDC entrés |
|---|---:|---:|
| 2026-03 | 191 | 23,67 |
| 2026-04 | 20 | 5,09 |
| 2026-05 | 3 | 1,00 |
| 2026-06 | 7 | 0,02 |
| 2026-07 | 4 | 0,00 |

**29,78 $ en tout, et il s'effondre selon la même courbe.** Le second contrat n'absorbe pas la
chute : il la reproduit. La migration est écartée.

## 5. Ce que ça corrige dans nos propres publications

Nous écrivons depuis le 1er août que **« le marché est minuscule »**, en citant 3,9 M$ cumulés et
1 438 agents ayant gagné un centime ([[2026-08-01-marche-acp-taille-et-vitalite]]).

**C'est exact et trompeur.** Exact sur le cumul ; trompeur parce qu'un cumul additionne un marché
qui a existé et un marché qui n'existe plus. La formulation juste est :

> Le commerce entre agents sur ACP a représenté **plus d'un million de dollars par mois en février
> et mars 2026**. En juillet 2026, il représente **9,56 $ par mois**.

Ce n'est pas un marché naissant qu'on regarde. C'est un marché qui a eu lieu.

**Ce que ça ne change pas** : le cadrage de Samy tient, et se déplace. Arriver tôt sur un marché
naissant et arriver après un premier cycle ne sont pas la même thèse — mais dans les deux cas la
position est bon marché et l'information n'appartient à personne. Ce qui change, c'est qu'il faut
cesser d'expliquer les petits chiffres par la jeunesse du marché : **ils s'expliquent par un
retrait**, et la question utile devient *pourquoi les 23 840 déposants sont partis*.

## 6. Ce que ça ouvre

- **Pourquoi mars ?** La rupture est nette entre mars (1,04 M$) et avril (34 k$). Chercher
  l'événement : fin d'un programme d'incitation, changement de règles, ou tarissement d'une
  subvention. C'est la question ouverte la plus riche du dépôt.
- **La part de subvention.** [[deux-grappes-anormales-verification-on-chain]] soupçonnait que le
  revenu affiché mélange ventes et subventions. Une chute de cette forme — verticale, synchrone,
  totale — est la signature d'un robinet qu'on ferme, pas d'une demande qui faiblit. **À instruire
  avant tout usage public du total de 3,57 M$.**
- **Le contraste avec ERC-8004** : 60 567 identités enregistrées sur Base, dont la dernière
  aujourd'hui, pendant que le séquestre est à l'arrêt
  ([[2026-08-04-erc-8004-sur-base-la-liste-des-validateurs-est-vide]]). On s'inscrit toujours ; on
  ne commerce plus.

## Refaire la mesure

```
eth_getLogs sur Base, address = USDC 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
topics = [Transfer, null, pad(coffre)]   → dépôts
topics = [Transfer, pad(coffre), null]   → versements
tranches de 10 000 blocs depuis le bloc 35 000 000
```
Script de session : `vault-lifetime.mjs`. **Le nœud public perd des tranches en silence sous
limite de débit** — relancer chaque appel jusqu'à succès et compter les échecs, sinon on publie un
sous-total en croyant publier un total.
