---
title: Le 22 mars 2026 — anatomie d'une bulle subventionnée, du programme au dernier job
type: mesure
statut: MESURÉ on-chain (Base) + RAPPORTÉ (annonces Virtuals), étiqueté ligne à ligne
updated: 2026-08-05
---

# Ce qui s'est passé le 22 mars 2026, transaction par transaction

Enquête menée les 4 et 5 août 2026 sur demande de Samy. Travail à deux : les mesures du coffre et du
registre sont de Claude, l'identification du distributeur et la flotte-témoin sont de Codex
(`.exchange/codex/2026-08-05-trace-merkle-et-boucle-farming-acp.md`), chacun ayant corrigé l'autre.

Complète [[2026-08-04-le-sequestre-acp-de-1-16-million-a-neuf-dollars]] et
[[2026-08-04-inspector-by-auraa-largent-va-dans-lautre-sens]].

## 1. La chronologie établie

| date | fait | statut |
|---|---|---|
| **2026-02-12** | Virtuals annonce le **Revenue Network / aGDP** à Consensus Hong Kong : jusqu'à **1 M$/mois** aux agents qui vendent via ACP | RAPPORTÉ (communiqué) |
| 2026-02-13 → | Les dépôts au coffre passent de 4–16 k$/jour à 20 k, 46 k, 80 k, 108 k, puis 415 k le 23/02 | **MESURÉ** |
| février | **211 propriétaires créent des flottes de ~100 agents** ; 590 des 600 agents échantillonnés sont créés ce mois-là | **MESURÉ** |
| **mardi 3 mars** | 1ʳᵉ alimentation du distributeur Merkle : **96 054,64 $** | **MESURÉ** |
| **mardi 10 mars** | 2ᵉ alimentation : **60 914,64 $** | **MESURÉ** |
| **mardi 17 mars** | 3ᵉ alimentation : **68 670,37 $** | **MESURÉ** |
| **dimanche 22 mars, 08:10:58 → 08:16:40** | Un opérateur crée **20 agents en 5 min 42 s** | MESURÉ (Codex, API ACP) |
| 22 mars, journée | Ces agents produisent **956 jobs**, presque tous à **60 USDC** | MESURÉ (Codex) |
| 22 mars ~13:26 | Le propriétaire finance **six relais payeurs de 60 $** qui redéposent au coffre en 86 à 270 s | MESURÉ (Codex) |
| **22 mars ~14:32 UTC** | **La falaise.** Les gros dépôts cessent | **MESURÉ** |
| **mardi 24 mars, 11:30** | Racine finale + **4ᵉ alimentation : 47 138,51 $** | **MESURÉ** |
| 24 mars, 11:32:57 → 11:33:41 | Le même opérateur réclame **19 récompenses en 44 secondes**, **9 385,03 $** | MESURÉ (Codex) |
| — | Virtuals annonce que **l'Epoch 5 est la dernière** du programme aGDP | RAPPORTÉ (archive tierce d'une publication `@virtuals_io`) |

## 2. Le distributeur de récompenses

**`0xD4D1e8F000BCE71b2fe89d59989FcD2Cd5128275`** — contrat vérifié `CumulativeMerkleDrop` sur Base.
Propriétaire, poseur de racine et financeur sont une seule adresse : `0xd2903bd69321496c9af3f72bd812ab8d3688209f`.

**MESURÉ** (blocs 41 000 000 → 47 000 000, chaque tranche relancée jusqu'à succès) :

| | valeur |
|---|---:|
| financé | **272 778,162180 $** en 4 transferts |
| distribué | **257 339,152677 $** en 315 transferts |
| bénéficiaires distincts | **264** |
| reliquat | 15 439,01 $ |

**Les quatre alimentations tombent quatre mardis consécutifs** — 3, 10, 17 et 24 mars. C'est la
cadence hebdomadaire du programme, lisible sur la chaîne sans aucune annonce. **La dernière arrive
deux jours après la falaise : c'est le solde de la campagne close.**

> ⚠️ **Borne dure à ne pas franchir.** Ce contrat n'a reçu que **272 778 $**, très loin du « plus de
> 1 M$ d'incitations » annoncé par Virtuals. Soit le programme passait par d'autres rails, d'autres
> actifs ou d'autres contrats, soit le chiffre annoncé n'est pas un montant en dollars.
> **Ne jamais traiter le million annoncé comme une somme démontrée.**

## 3. La signature du job à 60 dollars

Codex documente une flotte produisant des jobs à **60 USDC** réglés **48 USDC**. Testé
indépendamment contre l'intégralité du coffre, sans connaissance de cette flotte :

| dénomination | sur **toute la vie** du coffre | dont le **22 mars** |
|---|---:|---:|
| dépôts de **60 $** | 1 143 | **1 043 (91,3 %)** |
| règlements de **48 $** | 1 019 | **1 017 (99,8 %)** |

- Ratio 48/60 = **80 %** → **friction de plateforme de 20 %**, confirmée de bout en bout.
- **1 043 × 60 = 62 580 $ sur une journée qui pèse 79 836 $ : une flotte créée à 08:10 ce matin-là
  représente 78 % du volume du dernier jour du programme.**
- Premier dépôt de 60 $ : 2026-02-27. Dernier : **2026-03-22**. Après la falaise, la dénomination
  **disparaît totalement** — les montants dominants de la tranche 10–100 $ deviennent 10, 100, 50, 20.

## 4. La forme de la chute

| jour | dépôts | USDC |
|---|---:|---:|
| 2026-03-21 | 21 289 | 42 405 |
| **2026-03-22** | 8 313 | **79 836** |
| **2026-03-23** | 3 683 | **2 401** |

**La valeur chute de 97 % en une nuit ; le nombre de dépôts ne fait que se diviser par deux.** Ce ne
sont pas les agents qui s'arrêtent — **c'est une classe de montants qui disparaît** :

| tranche | 1–22 mars | 23 mars–30 avril |
|---|---:|---:|
| **10–100 $** | **32 326 dépôts · 635 246 $ · 64 % de la valeur** | 1 123 · 17 730 $ |

À l'heure : les gros dépôts cessent vers **14:32 UTC** le dimanche 22 mars (horodatage recalé sur des
timestamps de blocs réels ; l'extrapolation naïve dérivait de 30 minutes).

**116 propriétaires distincts** portaient les dépôts ≥ 10 $ de la dernière semaine, top 3 = 15,9 %.
**Ils se sont arrêtés dans la même heure.** Ce n'est pas un acteur qui s'en va, c'est une échéance
partagée.

## 5. La composition du registre

**MESURÉ** sur les 44 051 agents ACP :

| taille de flotte | propriétaires | agents détenus |
|---|---:|---:|
| 1 agent | 5 254 | 5 254 (11,9 %) |
| 2–20 | 3 184 | 13 495 (30,6 %) |
| 21–99 | 76 | 4 194 (9,5 %) |
| **100 et plus** | **211** | **21 108 (47,9 %)** |

Les tailles ne sont pas quelconques : 104, 101, 101, 101, 101, 100, 100, 100… **C'est une cible, pas
une croissance.** Sur six flottes échantillonnées, **590 des 600 agents ont été créés en février
2026**, et la plupart n'ont jamais exécuté un seul job.

**Conséquence : le chiffre « 44 051 agents » — que nous avons publié — est à moitié composé de
flottes créées en un mois pour un programme d'incitation. Ne plus le citer nu.**

## 6. Ce qui a été cherché et NON trouvé

- **Le lavage simple entre agents d'un même propriétaire est écarté** : en mappant chaque déposant et
  chaque bénéficiaire du coffre vers son propriétaire ACP, l'argent revenant au même propriétaire ne
  fait que **2,7 %** du volume de la période subventionnée.
- **Mais ce test est structurellement aveugle** à ce qui se passe **hors du coffre**. Cas mesuré :
  l'anneau `0x0e59260d…` (6 agents d'un même propriétaire) a fait circuler **174 938 $ en 75
  transferts directs entre ses propres portefeuilles**, sans jamais passer par le séquestre — donc
  invisibles au test. Il a par ailleurs extrait **143 290 $** du coffre en 9 007 versements sans y
  déposer un centime.
- **Un incident Base est écarté** : l'historique officiel ne montre aucun arrêt les 22–23 mars ; le
  problème le plus proche démarre le 24 mars et n'affecte pas la production de blocs (RAPPORTÉ, Codex).
- **La migration de contrat est écartée** : le second contrat v1 fait 29,78 $ et s'effondre pareil ;
  ACP n'est déployé ni sur Arbitrum, ni BNB, ni Optimism, ni Polygon.

## 7. Ce qui reste inconnu

1. **La part de toute l'activité ACP** relevant de ce mécanisme. La mesure de Codex (35 financements
   par 3 propriétaires récompensés) est **une borne basse, pas un recensement**.
2. **Si les livrables avaient un contenu utile.** La structure est artificielle ; le contenu hors
   chaîne n'est pas consultable.
3. **La rentabilité réelle du farming.** Sur la flotte mesurée, récompense + règlement = **96,4 % du
   brut** — un opérateur qui aurait financé lui-même tout son volume aurait **perdu** de l'argent.
   ⚠️ **Le calcul « 1 M$ / 3,57 M$ = 28 centimes par dollar, donc rentable » est une borne grossière,
   pas une rentabilité démontrée.** Ne pas le republier tel quel.
4. **Le préavis donné aux participants**, et le mécanisme successeur annoncé.
5. **L'attribution du plus gros déposant** (77 920 $ déposés pour 11 569 $ récupérés).

## 8. Deux erreurs de méthode payées cette semaine

Elles valent plus que les chiffres, parce qu'elles se reproduiront.

**a) Chercher la contre-preuve dans ses propres données avant de lire la documentation de l'éditeur.**
J'ai publié « le marché s'est arrêté, 9,56 $ en juillet » après avoir testé la migration contre
quatre chaînes et un second contrat — mais pas contre **ACP v2**, annoncé dans le changelog public de
Virtuals. Chiffre faux d'un **facteur 113**.

**b) Une heuristique plausible peut sélectionner exactement les mauvais candidats.** J'avais posé
qu'« un distributeur paie des milliers de bénéficiaires ». Le vrai distributeur en payait **264**, et
il figurait **en tête de ma propre liste de financeurs** — écarté par mon propre critère. Les
contrats qui paient des dizaines de milliers d'adresses sont justement ceux qui ne sont **pas** des
programmes : ce sont des pools d'échange.
Corollaire : **dans un Merkle drop, le rythme hebdomadaire est dans les alimentations, pas dans les
réclamations** — chacun réclame quand il veut.

## Refaire la mesure

```
Base, nœud public mainnet.base.org, sans clé, tranches de 10 000 blocs.
USDC          0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913, événement Transfer
coffre ACP v1 0xef4364fe4487353df46eb7c811d4fac78b856c7f
ACP v2 Core   0x238E541BfefD82238730D00a2208E5497F1832E0
distributeur  0xD4D1e8F000BCE71b2fe89d59989FcD2Cd5128275  (CumulativeMerkleDrop)
```

**Trois pièges qui corrompent silencieusement le résultat** : les tranches perdues sous limite de
débit (relancer et **compter les échecs**), les réponses trop grosses (**bissecter**, ne pas sauter),
et l'horodatage extrapolé depuis un seul ancrage (**dérive de 30 min sur six mois** — recaler sur des
timestamps réels avant toute affirmation horaire).
