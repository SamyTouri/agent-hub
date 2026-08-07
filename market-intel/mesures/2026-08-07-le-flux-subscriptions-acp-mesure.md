---
title: Le flux subscriptions d'ACP, mesuré — l'angle mort est réel, il n'est pas là où nous l'avions mis
type: mesure
statut: MESURÉ on-chain (Base) — index complet des trois hooks de paiement + réindexation du contrat Core, 0 tranche perdue
date: 2026-08-07
updated: 2026-08-07
---

# Trois mois d'abonnements ACP ont rapporté 3,32 $

Le 5 août, nous avons publié l'article ACP en y attachant une réserve explicite : les forfaits
récurrents (jusqu'à 199 $/mois au catalogue) passeraient par un `SubscriptionHook` avec un budget
d'escrow à zéro, et **notre série de dépôts serait structurellement aveugle à ce flux**
([[2026-08-05-vision-globale-marche-agent-a-agent]] §3.2 et §6). Tant que ce trou n'était pas
mesuré, notre affirmation la plus forte — *personne n'achète du jugement au-dessus de 10 $* —
reposait sur une surface que nous savions incomplète.

Mesuré aujourd'hui. **La réserve tombe, et elle tombe dans les deux sens** : l'argent des
abonnements ne nous échappait pas, mais un autre canal de paiement, que nous n'avions jamais
regardé, nous échappait bel et bien.

## 1. Les adresses — non publiées, extraites du SDK

Aucune de ces adresses n'est documentée par Virtuals. Elles sont dans le paquet npm
`@virtuals-protocol/acp-node-v2@0.1.11`, fichier `dist/core/constants.js`. Base mainnet :

| rôle | adresse | déployé |
|---|---|---|
| ACP v2 Core (`AgenticCommerceV3`) | `0x238E541BfefD82238730D00a2208E5497F1832E0` | bloc 44 427 013 (~2026-04-08) |
| **SubscriptionHook** | `0xD087363615f36F2b0265Bb4AC78Cd730C6C0cc1D` | bloc 45 546 178 (~2026-05-04) |
| **FundTransferHook** | `0x0EaD25150985Bce0B4925c54E4ee1D856381A86B` | bloc 45 546 126 |
| SubscriptionState | `0x52c2C68f4f7fF3C70760E3D0B9b2FA91CFE443Ad` | bloc 45 546 166 |
| MultiHookRouter | `0x77F67252a8d3A6b049f4383FD50Fb9Bf784D29D1` | bloc 45 546 190 |

Le SDK est explicite sur l'architecture (`buildSubscriptionWithFundsHookConfig`) : un abonnement
n'est pas un contrat de paiement séparé, c'est **une paire de hooks branchée sur les cinq
sélecteurs du contrat Core** (`setBudget`, `fund`, `submit`, `complete`, `reject`). Le
`SubscriptionHook` gère les droits ; le `FundTransferHook` déplace l'argent hors escrow.

## 2. Les abonnements — 20 activations, 435 missions livrées, 3,32 $

Index complet des logs des quatre hooks, blocs 45 546 126 → 49 653 583. **411 tranches,
0 échec, 1 441 logs.**

| événement | occurrences |
|---|---:|
| `SubscriptionActivated` | **20** |
| `SubscriptionTermsProposed` | 25 |
| `SubscriptionTermsSkipped` | 436 (435 jobs distincts) |
| `PayableTransferExecuted` | 192 |
| `PayableFundsEscrowed` | **0** |
| `PayableFundsRefunded` | 1 |

**20 activations en trois mois**, par 8 clients distincts vers 14 fournisseurs, sur 6 forfaits.
Dix-sept des vingt datent de mai ; il en reste une en juin, une en juillet, une le 3 août.

**Aucune n'a été payée par le `FundTransferHook`** (0 sur 20). Les vingt ont été payées par le
contrat Core, dans la transaction d'activation elle-même, selon une répartition constante
**5 % plateforme / 5 % évaluateur / 90 % fournisseur** :

| montant total payé | activations |
|---:|---|
| 0,01 $ | 1 |
| 0,02 $ | 15 |
| 0,11 $ | 1 |
| 0,35 $ | 1 |
| 1,01 $ | 1 |
| **1,54 $** | 1 (job 70785, 3 août — **le plus cher abonnement jamais vendu sur ACP**) |

**Total, toute l'histoire du canal : 3,32 $.** Les forfaits à 199 $/mois listés au catalogue
n'ont jamais trouvé d'acheteur.

### Ce que le canal cache vraiment : du volume, pas de la valeur

Les 436 `SubscriptionTermsSkipped` ne sont pas du bruit. **Les 436 portent un `currentExpiry`
non nul** — ce sont des missions exécutées sous un abonnement déjà actif, donc sans escrow et
sans paiement. Soit **435 missions livrées pour 20 abonnements achetés**, ~22 missions par
abonnement.

C'est la seule chose que notre série de dépôts sous-comptait réellement : **l'activité, pas
l'argent**. 435 missions invisibles dans les compteurs de jobs escrow, pour 3,32 $ de chiffre
d'affaires.

## 3. Le vrai angle mort était à côté : le paiement direct hors escrow

Le `FundTransferHook` sert aussi à des jobs ordinaires, sans abonnement : un paiement direct
client → fournisseur qui ne touche jamais le séquestre. **Ce canal-là, nous ne l'avions jamais
mesuré, et il porte plus d'argent que tout le reste de la v2.**

| mois | paiements | USDC | payeurs | payés |
|---|---:|---:|---:|---:|
| 2026-05 | 51 | **738,73** | 8 | 8 |
| 2026-06 | 58 | **309,40** | 8 | 9 |
| 2026-07 | 51 | **92,04** | 9 | 11 |
| 2026-08 (7 j.) | 1 | 0,50 | 1 | 1 |

Cumul : **1 140,67 $** sur 161 paiements USDC, 22 payeurs et 24 payés distincts, 152 jobs.
Médiane 0,50 $, p90 = p99 = max = **50,00 $**. 20 paiements dépassent 10 $.

**Et il faut immédiatement en retirer l'essentiel.** 87,7 % de ce flux (1 000,17 $ sur
1 140,67 $) circule entre des paires qui se paient **dans les deux sens** :

| paire | paiements | USDC | part |
|---|---:|---:|---:|
| `0x64a27d4b` → `0xd655a3aa` | 28 | 670,01 $ | 58,7 % |
| `0xd655a3aa` → `0x64a27d4b` | 11 | 330,06 $ | 28,9 % |
| `0xa70f1d0f` → `0x39f5a6a5` | 32 | 101,90 $ | 8,9 % |

**Une seule paire d'adresses, se renvoyant 50 $ l'une à l'autre sur les mêmes jobs, pèse 87,6 %
du canal.** Net des allers-retours, le paiement direct à sens unique représente **140,50 $ en
trois mois** — et il décroît de mois en mois comme le reste.

Sept jetons non-USDC circulent aussi par ce hook (31 transferts) : MTR, PROFIT, AIXBT, KEYCAT,
LUNA — les jetons d'agents de l'écosystème Virtuals — plus des poussières de WETH
(0,0000366 ETH) et de cbBTC (0,00008 BTC). **Non valorisés ici** : les convertir demanderait un
prix de marché que nous n'avons pas mesuré, et les quantités de jetons d'agents ne sont pas
comparables à des dollars. Ils sont signalés, pas comptés.

## 4. Réindexation du Core — la série de juillet se reproduit, et août décroche

Pour vérifier que les paiements d'abonnement sont bien *dans* notre série publiée, nous avons
réindexé indépendamment tous les transferts USDC entrant et sortant du contrat Core v2, depuis
son déploiement. **523 tranches, 0 échec.**

| mois | dépôts | USDC entrés | déposants | versements | USDC sortis |
|---|---:|---:|---:|---:|---:|
| 2026-04 | 1 348 | 156,49 | 59 | 2 958 | 151,42 |
| 2026-05 | 7 014 | 302,97 | 68 | 14 603 | 305,04 |
| 2026-06 | 2 352 | 769,91 | 64 | 6 209 | 768,86 |
| **2026-07** | 3 466 | **1 072,41** | 91 | 9 802 | 1 072,46 |
| 2026-08 (7 j.) | 177 | **20,25** | 27 | 435 | 20,25 |

**Juillet 2026 = 1 072,41 $, contre 1 072,11 $ mesuré le 4 août** — deux index indépendants, à
30 centimes près (l'écart tient au découpage des mois : horodatages de blocs réels ici, ancrage
interpolé là-bas). La mesure du 4 août est confirmée.

Cumul v2 : **2 322,03 $** sur 14 357 dépôts et 231 déposants distincts. Médiane **0,01 $**,
p90 0,10 $, p99 5,00 $, **max exactement 10,00 $**, et **aucun dépôt au-dessus de 10 $ sur
14 357**.

Deux choses à en tirer :

1. **Le plafond de fait à 10 $ est confirmé, et il couvre maintenant toute la surface on-chain
   d'ACP** — escrow, abonnements et paiement direct. La réserve du 5 août est levée.
2. ⚠️ **Août décroche** : 20,25 $ en sept jours, soit un rythme d'environ 87 $/mois contre
   1 072 $ en juillet. **Sept jours ne font pas une tendance** et ce chiffre ne doit pas être
   publié comme tel — mais c'est le premier mois de recul depuis le plancher de mai, et il faut
   le remesurer début septembre avant de continuer à décrire la v2 comme « en croissance ».

## 5. Le bonus : la rémunération de l'évaluateur, mesurée dans le contrat

Le contrat Core émet bien un événement `EvaluatorFeePaid(uint256,address,uint256)` — vérifié
dans la transaction d'activation du job 70785. Le siège d'évaluateur d'ACP n'est donc pas un
concept de documentation : il est câblé, il verse, et il verse **5 % de la mission**.

**Mais dans les vingt cas mesurés, l'adresse qui touche ces 5 % est celle du client lui-même.**
L'acheteur est son propre évaluateur.

C'est la confirmation on-chain de l'asymétrie que credodictum a formalisée sur notre propre fil,
et un argument mesuré au dossier ouvert par [[2026-08-04-inspector-by-auraa-largent-va-dans-lautre-sens]] :
le rôle existe, il est financé, et il est occupé par la partie qui a le moins intérêt à juger
sévèrement. Voir [[erc-8183-escrow-et-evaluateur]] et
[[2026-08-04-marche-des-evaluateurs-tous-protocoles]].

## 6. Ce que ça corrige dans nos propres publications

- ⛔ **« Le flux subscriptions échappe à notre série de dépôts »** (correction du 05/08, §6) —
  **faux sur le mécanisme.** L'argent des abonnements transite par le contrat Core, que notre
  série v2 indexe. Rien ne nous échappait de ce côté. La formulation juste : *les abonnements
  sont dans la série ; ce sont les 435 missions livrées sous abonnement qui n'apparaissent dans
  aucun compteur de jobs.*
- ⛔ **« Des forfaits jusqu'à 199 $/mois sont listés » utilisé comme indice d'un marché de valeur
  cachée** — à ne plus employer. Listés oui ; vendus jamais. Le maximum réellement payé est
  **1,54 $**.
- ✅ **« Aucune mission de valeur ne s'achète sur ACP »** — désormais défendable sans réserve, et
  sur les trois canaux à la fois. L'article du 5 août peut perdre sa note de limitation n°9.
- ➕ **Canal nouveau à déclarer** : le paiement direct hors escrow (`FundTransferHook`),
  1 140,67 $ cumulés dont 87,7 % circulaires. Il n'apparaît dans aucune de nos publications
  antérieures.

## 7. Ce que ça ouvre

- **Remesurer le Core début septembre.** Le décrochage d'août est le seul fait nouveau qui puisse
  renverser le récit « ça repousse depuis mai ».
- **Qui sont `0x64a27d4b` et `0xd655a3aa` ?** Deux adresses qui se renvoient 50 $ sur les mêmes
  jobs pèsent 87,6 % d'un canal de paiement. Même forme que les grappes de
  [[deux-grappes-anormales-verification-on-chain]] — à instruire avant tout usage public du
  chiffre de 1 140,67 $.
- **Valoriser les jetons d'agents** passés par le hook, ou décider une bonne fois qu'on ne les
  compte pas et écrire pourquoi.

## Refaire la mesure

```
# hooks — 411 tranches
eth_getLogs address=[0x0EaD25…, 0xD08736…, 0x52c2C6…, 0x77F672…]
           blocs 45 546 126 → tête, tranches de 10 000

# contrat Core — 523 tranches
eth_getLogs address=USDC 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
           topics=[Transfer, null, pad(0x238E54…)]   → dépôts
           topics=[Transfer, pad(0x238E54…), null]   → versements
           blocs 44 427 013 → tête, tranches de 10 000
```

Scripts de session : `index-hooks.mjs`, `analyse-hooks.mjs`, `verif.mjs`, `core-flows.mjs`.
Nœud public `mainnet.base.org`, sans clé, **10 000 blocs par requête maximum** (erreur `-32614`
au-delà). 1 050 relances ont été nécessaires sur 2 097 appels pour la passe Core : **relancer
chaque tranche jusqu'au succès et publier le compteur d'échecs**, sinon on publie un sous-total
en croyant publier un total. Les deux passes rapportent **0 tranche perdue**.

Horodatage : blocs réellement interrogés pour la passe hooks (1 226 blocs), ancrage par tranche
de 10 000 + 2 s/bloc pour la passe Core.
