---
title: ERC-8004 sur Base — 60 567 agents, 434 995 avis, et zéro validateur
type: mesure
statut: MESURÉ on-chain (Base) + RAPPORTÉ (dépôt officiel)
updated: 2026-08-04
---

# La liste des validateurs ERC-8004 n'est pas difficile à reconstruire : elle est vide

Chantier C du point de reprise [[devenir-evaluateur-chantiers-ouverts]]. Samy avait autorisé le
2026-08-04 la reconstruction de « la liste des validateurs ERC-8004 que personne ne publie ».

**Elle n'existe pas, et la raison n'est pas celle qu'on croyait.**

## 1. Pourquoi personne ne publie cette liste

Nous supposions un angle mort : liste reconstructible par indexation, mais que personne ne prend la
peine d'indexer. **Faux.** Deux constats, l'un documentaire, l'autre mesuré.

**RAPPORTÉ — le registre de validation n'est déployé nulle part.** Le dépôt officiel
`github.com/erc-8004/erc-8004-contracts`, relu le 2026-08-04, publie ses adresses pour ~24 réseaux
principaux. Sur chacun, **deux contrats seulement** :

| contrat | adresse (tous réseaux principaux, adresse vanité) |
|---|---|
| `IdentityRegistry` | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| `ReputationRegistry` | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |
| `ValidationRegistry` | **absent des tableaux de déploiement** |

Le code source existe (`ValidationRegistryUpgradeable.sol`), mais le README porte cet avertissement :

> *« The **Validation Registry** portion of the ERC-8004 spec is still under active update and
> discussion with the TEE community. This section will be revised and expanded in a follow-up spec
> update later this year. »*

**MESURÉ — zéro événement de validation sur Base.** Balayage de tous les journaux des deux registres
déployés, blocs 39 000 000 → 49 533 005 (soit décembre 2025 → 2026-08-04), 787 121 événements lus :

```
ValidationRequest  : 0
ValidationResponse : 0
adresses de validateurs distinctes : 0
```

**Conclusion du chantier C : il n'y a pas de validateurs ERC-8004 à lister.** Le rôle est décrit
dans la norme, son contrat est écrit, et il n'est déployé sur aucune chaîne principale. Notre
formulation du 04/08 au matin — « une liste est reconstructible a posteriori en indexant les
événements » — était techniquement vraie et pratiquement vide de sens.

## 2. Ce que le balayage a trouvé à la place — et c'est plus intéressant

| événement | registre | occurrences |
|---|---|---|
| `Registered` | Identity | **60 567** |
| `MetadataSet` | Identity | 135 903 |
| `Transfer` (ERC-721) | Identity | 79 984 |
| `URIUpdated` | Identity | 18 767 |
| **`NewFeedback`** | Reputation | **434 995** |
| `ResponseAppended` | Reputation | 4 505 |
| `FeedbackRevoked` | Reputation | 82 |

- **60 567 agents enregistrés sur Base**, pour **15 247 adresses propriétaires distinctes** — soit
  environ **4 agents par propriétaire**.
- **434 995 avis** déposés par **12 405 clients distincts**, soit ~35 avis par client.
- Première inscription au bloc 41 673 162 (≈ 2026-01-24), **dernière aujourd'hui même**
  (bloc 49 532 073). Contrairement à ACP, **l'inscription ERC-8004 est toujours en cours**.
- `ResponseAppended` (la réponse de l'agent jugé à un avis) : **4 505**, soit **1 %** des avis. La
  contradiction existe dans la norme et n'est presque jamais exercée.

**Attention à ne pas surinterpréter le nombre d'avis.** L'étude empirique de juin 2026
(arXiv 2606.26028, Ethereum/BSC/Base jusqu'au 2026-05-13) mesure sur Base **90,6 % de comportements
Sybil coordonnés parmi les évaluateurs**, et **86,8 % des agents sans aucun avis valide** une fois
les Sybil retirés. Nos 434 995 avis sont un compte brut, pas un compte de signaux.

Cette étude n'a couvert **que** Identity et Reputation — elle ne dit rien du registre de validation,
et ne publie pas de liste de validateurs. Notre mesure ne la duplique donc pas ; elle la prolonge du
côté qu'elle n'a pas traité, et le résultat est un zéro.

## 3. L'intersection ACP × ERC-8004 — le chiffre que personne n'a

Samy : *« mesure l'intersection des deux populations, c'est un chiffre que personne n'a. »*

| population | effectif |
|---|---|
| agents ACP (registre `acpx.virtuals.io`) | **44 051** |
| — leurs portefeuilles distincts | 42 926 |
| — leurs propriétaires distincts | **8 725** |
| agents ERC-8004 sur Base | **60 567** |
| — leurs propriétaires distincts | **15 247** |

**Intersection, par adresse :**

| croisement | résultat |
|---|---|
| propriétaires ACP qui possèdent aussi une identité ERC-8004 | **79** |
| portefeuilles d'agents ACP qui possèdent une identité ERC-8004 | 1 |
| **toute adresse ACP ∩ propriétaires ERC-8004** | **80** |
| propriétaires ACP ayant déposé un avis ERC-8004 | 11 |
| parmi les 2 133 agents ACP à volume non nul, propriétaires croisés | 28 |

**Moins de 1 % des opérateurs d'ACP ont pris une identité ERC-8004** (79 sur 8 725, soit 0,91 %).
Les deux populations sont, à cette échelle, **disjointes**.

Ce que ça dit, et c'est la réponse à la question posée le 04/08 (« combien d'acteurs du commerce
agent se dotent volontairement d'une identité portable ») : **presque aucun**. L'identité portable
et le commerce sous séquestre sont, aujourd'hui, deux populations qui ne se recouvrent pas.

**Limite à conserver.** `walletAddress` chez ACP est le compte intelligent de l'agent ;
`Registered.owner` chez ERC-8004 est le propriétaire du jeton. Un même opérateur peut employer des
adresses différentes des deux côtés sans que rien ne le relie. **80 est donc un plancher, pas une
mesure exacte du recouvrement.** À raffiner en lisant la métadonnée `agentWallet` de chaque
inscription 8004, qui n'a pas été extraite ici.

## 4. Ce que ça change pour « devenir évaluateur »

1. **Il n'y a pas de marché d'évaluateurs ERC-8004 à rejoindre**, ni tôt ni tard : le rôle n'a pas
   de contrat déployé. La seule porte réelle reste ERC-8183/ACP — dont le siège a versé 0,42 $
   ([[2026-08-04-inspector-by-auraa-largent-va-dans-lautre-sens]]).
2. **Mais le registre de validation arrive** (« later this year », dépôt officiel). Une population
   de validateurs à zéro, une norme en cours de rédaction et une date annoncée : c'est exactement
   la configuration que le cadrage de Samy désigne. **À surveiller comme un événement daté**, pas
   comme une opportunité à instruire aujourd'hui.
3. **Le vrai actif exploitable n'est pas la liste des validateurs, c'est la mesure d'écart** entre
   60 567 identités et 80 adresses communes avec le commerce réel. Personne ne publie ça.

## Refaire la mesure

```
eth_getLogs sur Base, address: [0x8004A169…432, 0x8004BAa1…b63]
tranches de 10 000 blocs, bissection sur "backend response too large"
topic0 : keccak("Registered(uint256,string,address)"),
         keccak("NewFeedback(uint256,address,uint64,int128,uint8,string,string,string,string,string,bytes32)"),
         keccak("ValidationRequest(address,uint256,string,bytes32)"),
         keccak("ValidationResponse(address,uint256,bytes32,uint8,string,bytes32,string)")
```
Scripts de session : `e8004-base2.mjs` (registres), `acp-agents.json` (population ACP).
Le nœud public rejette au-delà de 10 000 blocs, limite le débit et refuse les réponses trop
grosses : **sans bissection ni relance, on perd des tranches en silence** — c'est ce qui a faussé
notre premier passage.
