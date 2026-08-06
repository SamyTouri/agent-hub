---
title: Le marché des évaluateurs — qui en emploie, à quelles règles, et où sont les listes
type: regle
statut: MESURÉ + RAPPORTÉ (étiqueté ligne à ligne)
updated: 2026-08-04
---

# Les évaluateurs, protocole par protocole

Demandé par Samy le 2026-08-04 : *« je veux être certain de bien comprendre le marché actuel des
évaluateurs plutôt que de dire que pour l'instant personne ne les paye. »* La demande était fondée —
**elle a produit une correction de notre propre mesure du 1er août** (§6).

Complète [[erc-8183-escrow-et-evaluateur]], [[2026-08-01-siege-evaluateur-vide]], [[evallayer]].

## 1. Tableau d'ensemble

| Protocole / plateforme | Rôle de jugement ? | Qui le désigne | Payé comment | Liste publique |
|---|---|---|---|---|
| **ERC-8183 / Virtuals ACP** | **oui**, `EVALUATOR` | le **client**, à la création, non modifiable | **seulement s'il approuve**, taux global de la plateforme (5 %), prélevé sur le net du prestataire | **oui — 75 agents**, filtrable par API |
| **ERC-8004** (Validation Registry) | **oui**, `validator` | **l'agent évalué lui-même** | **non défini** — hors périmètre de la norme | **non** — aucun registre de validateurs |
| **x402** (Coinbase) | **non** | — | le *facilitator* vérifie **la signature de paiement**, jamais la livraison | sans objet |
| **Olas / Mech Marketplace** | **non** — pas d'humain ni d'agent juge | — | vérification **automatique par correspondance de hash** (CID Filecoin) | sans objet |
| **PactEscrow** (praxisagent) | arbitre **optionnel** | le créateur du contrat | non documenté publiquement ; expiration au **bénéfice du destinataire** (anti-griefing) | non |
| **LexProtocol** | arbitre **centralisé** | l'opérateur | commission de 1 %, auto-approbation à 48 h | non ([[lexprotocol]]) |
| **EvalLayer** | marketplace annoncée | — | 0,01 $ par verdict sur ACP (arrêté) ; aujourd'hui abonnement | **oui — et elle contient 1 membre** |
| **Kleros** | jurés humains | tirage au sort pondéré par mise | **payé si on vote avec la majorité**, pénalisé sinon | oui, mais hors périmètre agent |
| **OKX.AI** *(ajout 05/08)* | **oui**, Evaluator staké (≥ 5 par litige) | sélection pondérée par le **stake** (≥ 100 OKB = **~8 596 $** au 06/08) | la **majorité** se partage le dépôt de contestation de 5 % + les pénalités des minoritaires ; vote minoritaire −1 % du stake, absence −0,3 % | **non trouvée** — aucun tableau agrégé public ([[../acteurs/okx-ai]]) |

## 2. ERC-8183 / ACP — le seul où « évaluateur » est un rôle enregistré et rémunéré

Détail dans [[erc-8183-escrow-et-evaluateur]]. Les trois asymétries : payé seulement sur
approbation, ne fixe pas son tarif, et sa commission sort de la poche de celui qu'il juge.

**MESURÉ le 2026-08-04** sur `acpx.virtuals.io/api/agents`, registre public sans clé :

| rôle déclaré | nombre |
|---|---|
| `HYBRID` | 42 176 (95,7 %) |
| `PROVIDER` | 1 001 |
| `EVALUATOR` | **75** |
| `CLIENT` | 0 |
| **total** | 44 051 |

**Le rôle est donc quasi toujours laissé au défaut** (`HYBRID`). Les 75 évaluateurs sont une
déclaration volontaire, pas une accréditation.

## 3. ERC-8004 — un rôle de validateur, mais l'inverse d'ACP sur deux points décisifs

**MESURÉ** par lecture du texte normatif (`e8004.md`, dépôt local).

Le *Validation Registry* enregistre des demandes de vérification et les réponses de validateurs
(re-exécution sécurisée par mise, vérificateurs zkML, oracles TEE, « juges de confiance »).

**Deux différences structurelles avec ERC-8183, et elles comptent :**

1. **C'est l'agent évalué qui demande sa propre validation.** `validationRequest(...)` **MUST be
   called by the owner or operator of agentId** — l'agent choisit son validateur et le paie
   implicitement. Là où ACP fait désigner l'arbitre par le client, 8004 le fait désigner par le
   jugé. C'est un dispositif de **preuve volontaire**, pas d'arbitrage entre deux parties.
2. **Le paiement n'existe pas dans la norme.** Citation exacte : *« Incentives and slashing related
   to validation are managed by the specific validation protocol and are outside the scope of this
   registry. »* Il n'y a donc **aucune règle de rémunération ERC-8004** — chaque protocole de
   validation invente la sienne.

**Aucune liste de validateurs n'existe.** Il n'y a pas de registre des validateurs : on ne peut
interroger `getValidatorRequests(address)` **que si l'on connaît déjà l'adresse**. Une liste est
reconstructible a posteriori en indexant les événements `ValidationRequest` / `ValidationResponse`,
mais elle n'est pas fournie. **C'est un angle mort exploitable** — voir §7.

## 4. x402 et Olas — deux façons de se passer d'évaluateur

**x402 n'a pas de rôle de jugement du tout.** Son *facilitator* vérifie la **signature du
paiement** et le règle sur la chaîne ; il ne regarde jamais ce qui a été livré. C'est exactement le
trou que notre doctrine désigne, et il est structurel, pas accidentel.

**Olas** résout le problème sans payer personne : **vérification automatique par correspondance de
hash CID Filecoin**. Si l'empreinte du livrable correspond à l'attendu, c'est livré. Modèle
déterministe, sans jugement — donc sans marché d'évaluateurs, et sans capacité à traiter un
livrable qui est *formellement conforme mais substantiellement mauvais*.

**RAPPORTÉ, à revérifier** : ~9,94 M de requêtes pour ~9,20 M de livraisons, soit **~735 000
requêtes payées non livrées (7,4 %)**. Notre fiche
[[2026-08-01-autres-places-agent-a-agent]] retient 1,4 million et 12,4 % — **les deux chiffres ne
concordent pas** et l'écart n'est pas expliqué. À trancher avant tout usage public.

## 5. Kleros — le contre-modèle de rémunération, et le seul qui résout l'asymétrie

Le juré est **payé s'il vote avec la majorité finale**, pénalisé s'il vote à contre-courant. La
rémunération ne dépend donc **pas du sens du verdict** mais de sa justesse présumée.

C'est précisément le correctif à l'asymétrie d'ERC-8183 : chez Kleros, dire « non » peut rapporter.
Modèle mûr (jurés humains, jeton PNK), pas conçu pour des agents, et Kleros ne fait qu'explorer
l'intégration d'agents en 2026. **Aucun pont opérationnel constaté avec le marché agent.**

## 6. CORRECTION à notre mesure du 2026-08-01

**Ce que nous avons publié trois fois** (à markus_dropspace, dans le billet du 01/08, et encore
dans le billet republié le 04/08 au matin) : *« 75 agents ont enregistré ce rôle. Aucun n'a de
revenu. »*

**Mesuré le 04/08, c'est incomplet et il faut le dire.** Le registre porte **deux champs** :

- `revenue` → **null pour les 75**. Notre affirmation était exacte sur ce champ.
- `grossAgenticAmount` → **5 des 75 sont > 0**, pour **25,05 $ cumulés**.

Nous avons lu un champ et conclu sur l'autre. C'est le piège que notre propre fiche
[[volume-brut-nest-pas-revenu]] décrit, appliqué à nous.

**Les cinq évaluateurs qui ont réellement travaillé :**

| agent | jobs réussis | brut | $/verdict | dernière activité |
|---|---|---|---|---|
| Inspector by AURAA | 403 | 21,95 $ | 0,0545 | 2026-05-27 |
| Veri Agent | 53 | 0,53 $ | 0,0100 | sentinelle `2999` |
| Cournot AI | 37 | 0,47 $ | 0,0127 | 2026-04-29 |
| May | 20 | 0,20 $ | 0,0100 | sentinelle `2999` |
| Minos | 19 | 1,90 $ | 0,1000 | 2026-03-21 |
| **total** | **532** | **25,05 $** | **0,047 moyen** | — |

**Le marché des évaluateurs enregistrés d'ACP existe donc, et il vaut 25 dollars cumulés pour 532
verdicts.** Un seul des 75 a une date d'activité postérieure à juillet 2026.

**Ce que la correction ne change pas** : la conclusion. Un marché à 25 $ et 0,047 $ le verdict
confirme, avec un chiffre au lieu d'un zéro, que le siège ne fait pas vivre son occupant. La
formulation « aucun revenu » devient **« 25,05 $ cumulés, à cinq centimes le verdict »**, ce qui est
plus fort parce que c'est vérifiable et daté.

**Prix affichés** par les 30 évaluateurs qui publient une offre : médiane **0,01 $**, min 0,01 $,
max 1 000 $. Le prix de marché du verdict d'escrow est donc **de l'ordre du centime**, ce qui
concorde exactement avec les 0,01 $/verdict d'[[evallayer]].

## 7. Ce que ça donne comme information exploitable

1. **EvalLayer est enregistré `PROVIDER`, pas `EVALUATOR`** — mesuré le 04/08 (agent 29588,
   `role: PROVIDER`, `grossAgenticAmount: 1.41`, 165 jobs, **2 acheteurs uniques**). La
   contradiction du matin est tranchée par la donnée : notre requête ne pouvait pas le voir. Et il
   vend l'évaluation **comme prestation ordinaire**, ce qui est exactement notre thèse.
2. **La vraie mesure du marché du jugement n'est pas le rôle `EVALUATOR`** — 25 $ — mais les agents
   qui vendent du contrôle sans le rôle : 463 agents, 679 310 $ ([[2026-08-01-metiers-de-la-confiance]]).
   Rapport de **27 000 pour 1** entre les deux façons de vendre le même travail.
3. **Angle mort ERC-8004** : il n'existe aucune liste de validateurs, alors qu'elle est
   reconstructible par indexation des événements. Personne ne publie cette liste. C'est le genre de
   chose que nous savons faire et que le marché n'a pas.
4. **Le modèle Kleros** (payé sur la justesse, pas sur le sens du verdict) est le seul correctif
   connu à l'asymétrie qui vide le siège. À citer quand on explique pourquoi ACP ne marche pas.

## Ajout du 2026-08-05 — OKX.AI : le modèle Kleros arrive dans le marché agent

L'audit Codex du 05/08 ([[../acteurs/okx-ai]]) documente le premier arbitrage agent-à-agent
institutionnel à règles publiées : ≥ 5 évaluateurs par litige, stake ≥ 100 OKB, commit/reveal,
rémunération **sur l'alignement avec la majorité quel que soit le sens du verdict**. C'est
précisément le « correctif Kleros » du point 4 ci-dessous, implémenté à l'échelle — OKX corrige
donc l'asymétrie payé-si-approbation qui vide le siège ACP, mais **le remplace par une barrière au
capital** : 100 OKB ≈ **8 596 $** immobilisés (mesuré le 06/08) pour toucher quelques centimes par
litige. Le siège n'est plus vide parce qu'il ne rapporte rien, il est **réservé à ceux qui peuvent
immobiliser neuf mille dollars**. Et il **hérite du défaut de Kleros** :
le mécanisme récompense le consensus, pas la vérité (comportement de Schelling, erreurs corrélées
si les évaluateurs partagent le même modèle, avantage au gros stake). Et l'activité réelle est
inconnue : aucun agrégat public de litiges, d'évaluateurs actifs ou de montants distribués. Le
« marché des évaluateurs » y est construit, pas démontré.

## Refaire la mesure

```
GET https://acpx.virtuals.io/api/agents?filters[role][$eq]=EVALUATOR&pagination[pageSize]=25
```
Paginer sur `meta.pagination.pageCount`, puis lire `revenue` **et** `grossAgenticAmount`,
`successfulJobCount`, `uniqueBuyerCount`, `offerings[].priceUsd`. Sans clé.
Script de la session : `acp-evaluators.mjs`.
