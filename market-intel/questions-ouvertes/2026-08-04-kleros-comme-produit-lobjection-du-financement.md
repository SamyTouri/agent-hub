---
title: Un agrégateur d'évaluateurs à la Kleros dans ERC-8183 — l'objection du financement, traitée
type: question-ouverte
statut: OBJECTION TRANCHÉE (défavorable au montage tel quel) · ARBITRAGE DOCTRINAL EN ATTENTE
updated: 2026-08-04
---

# « Payé si l'on vote avec la majorité » — pourquoi ça ne se branche pas sur ERC-8183

Chantier B du point de reprise [[devenir-evaluateur-chantiers-ouverts]]. Idée de Samy, 2026-08-04 :

> *« Nous pourrions devenir un agrégateur d'évaluateurs qui fonctionne de la même façon que Kleros
> (payé si du même avis que la majorité) et nous proposerions cette solution d'évaluation au sein
> d'ERC-8183. »*

Consigne : **traiter l'objection du financement en premier**, puis remonter l'arbitrage doctrinal.
Voici les deux, dans cet ordre.

## 1. D'où vient l'argent chez Kleros — RAPPORTÉ, docs officielles relues le 2026-08-04

| élément | règle |
|---|---|
| qui paie | **les parties au litige**, pas le protocole ni la transaction |
| quand | **à l'ouverture du litige**, dans un délai imparti |
| si une seule partie paie | **elle gagne automatiquement** ; l'autre est forclose |
| ce que touche le juré | sa part des **frais d'arbitrage** + le PNK **confisqué aux jurés minoritaires** |
| ce que risque le juré | son PNK bloqué (`minStake × alpha / 10000`), redistribué s'il vote à contre-courant |
| tirage | probabilité **proportionnelle à la mise** dans la sous-cour |
| appel | c'est **l'appelant qui paie** le nouveau jury, à un coût qui monte fortement à chaque tour |
| issue du perdant | ses frais sont **perdus** ; ceux du gagnant lui sont **remboursés** |
| **pas de majorité claire** | **frais et pénalités vont au gouverneur du protocole — les jurés ne touchent rien** |

Le mécanisme est cohérent parce qu'il repose sur **un budget de litige, séparé de la transaction, et
payé parce qu'il y a litige**.

## 2. L'objection, et pourquoi elle est fatale au montage tel quel

ERC-8183 **ne lève aucun frais de litige**. Relu dans la norme ([[erc-8183-escrow-et-evaluateur]]) :
la seule somme disponible pour l'évaluateur est **un pourcentage de la transaction** (5 % sur ACP),
**prélevé sur le net du prestataire**, et **versé seulement s'il approuve**.

Trois conséquences, dans l'ordre de gravité :

**a) La source de financement de Kleros n'existe pas dans 8183.** Ce n'est pas « moins d'argent »,
c'est **un poste budgétaire absent**. On ne peut pas répartir entre N votants une caisse qui n'est
alimentée par personne.

**b) Payer la cohérence est incompatible avec être payé sur l'approbation.** Le principe Kleros est
que dire « non » peut rapporter — c'est exactement ce qui corrige l'asymétrie. Mais dans 8183, une
majorité qui vote « non » déclenche le remboursement du client et **l'agrégateur ne touche rien**.
Il devrait donc payer ses votants majoritaires **avec de l'argent qu'il ne recevra jamais dans ce
cas de figure**. Le seul verdict qui finance le vote est le « oui » : on retombe précisément sur
l'asymétrie qu'on prétendait corriger, avec une couche d'intermédiation en plus.

**c) L'ordre de grandeur — MESURÉ le 2026-08-04, on-chain.** Deux mesures directes du séquestre ACP
(`0xef4364fe4487353df46eb7c811d4fac78b856c7f`, Base) :

| mesure, 30 derniers jours | valeur |
|---|---|
| dépôts entrants dans le séquestre | **385** |
| volume total déposé | **9,13 $** |
| mission médiane | **0,01 $** |
| mission moyenne | 0,024 $ |
| p90 / max | 0,05 $ / 2,00 $ |
| **commission d'évaluateur à 5 %, sur la médiane** | **0,0005 $** |
| **la totalité du gisement à 5 %, plateforme entière, sur 30 jours** | **0,46 $** |

Un agrégateur qui ferait voter trois évaluateurs se partagerait, **au mieux et en captant 100 % du
marché**, quarante-six centimes par mois — avant la première inférence, qui coûte à elle seule
davantage. Le rapport entre la recette d'un verdict médian (0,0005 $) et le coût d'un appel de
modèle est de l'ordre de **trois ordres de grandeur**, dans le mauvais sens.

Pour situer : chez Kleros, un juré cohérent d'une affaire documentée a touché **0,03 ETH**. Les deux
mécanismes ne sont pas au même endroit de l'échelle ; ils ne sont même pas dans la même unité.

**Verdict : l'agrégateur à la Kleros *branché sur la commission d'évaluateur ERC-8183* ne peut pas
se financer.** Ce n'est pas une question de maturité du marché, c'est une impossibilité de
plomberie — et elle resterait vraie si le volume ACP était multiplié par mille.

## 3. Ce qui survit de l'idée, et qui est la partie intéressante

L'idée de Samy contient deux choses distinctes, et seule la première meurt.

**Ce qui meurt** : la commission de 8183 comme source de rémunération d'un jury.

**Ce qui tient** : le principe Kleros lui-même — *rémunérer la justesse et non le sens du verdict* —
reste le seul correctif connu à l'asymétrie. Il exige juste sa source de financement propre : **un
budget de litige payé par une partie qui a un intérêt à ce que la question soit tranchée.**

Or c'est exactement notre montage existant : dans le bureau des plaintes, **on paie l'analyse, pas
la conclusion**. C'est la même séparation que Kleros, et elle est déjà dans notre doctrine. La
différence est qu'on la facture à côté de la transaction au lieu d'en prélever un pourcentage —
c'est-à-dire, précisément, comme Kleros.

**Reformulation de la piste, à valider par Samy** : ne pas proposer un agrégateur *rémunéré par*
ERC-8183, mais un mécanisme de décision *utilisable par* ERC-8183, dont le coût est porté par qui
demande la décision. L'adresse unique d'évaluateur inscrite dans le contrat reste la bonne réponse
au problème de découverte ; ce qui change, c'est qui paie derrière.

## 4. Compatibilité contractuelle — favorable, et c'est le seul point facile

ERC-8183 désigne **une adresse** d'évaluateur, fixée à la création, non modifiable. La norme ne dit
nulle part que cette adresse doit être un compte externe. **Un contrat y entre naturellement** :
l'agrégateur s'inscrit comme adresse unique, orchestre le vote hors chaîne ou sur chaîne, puis
appelle `complete` / `reject` selon le résultat. Aucun adaptateur n'est nécessaire.

Ce point était le seul risque technique ; il tombe. Le blocage est entièrement économique.

## 5. Le prix d'occuper le siège, maintenant qu'on l'a mesuré

Fait mesuré le 2026-08-04
([[2026-08-04-inspector-by-auraa-largent-va-dans-lautre-sens]]) : **le siège d'évaluateur d'ACP a
versé 0,42 $ dans toute son histoire**, à un seul agent, en une journée de février 2026.

Lu avec le cadrage de Samy (marché minuscule = raison d'y être), ça change la question. Occuper le
siège ne peut pas être un plan de revenus — mais **ça ne coûte presque rien non plus** : une
inscription et quelques centimes de gaz. Ce n'est pas un investissement à instruire, c'est une
option à prendre pendant qu'elle est gratuite.

**Recommandation** : dissocier les deux décisions. S'inscrire comme évaluateur ERC-8183 est bon
marché et sans regret. Construire l'agrégateur est une décision distincte, qui doit attendre une
source de financement qui existe.

## 6. ARBITRAGE DOCTRINAL — à rendre par Samy

Notre position publique est que **nous ne sommes pas un adjudicateur** : pas de verdict, pas
d'arbitrage, on conserve des faits et le lecteur conclut (`docs/DOCTRINE.md`). Or être évaluateur
ERC-8183, même bon marché, **c'est rendre des verdicts** : la norme ne donne que deux gestes,
`complete` et `reject`, et ils déplacent l'argent.

Le 2026-08-01, une question voisine a déjà été tranchée une fois ([[agent-hub-role-evaluateur]] en
mémoire projet) : prendre le rôle rémunéré **et** continuer à conseiller, en incluant nos propres
solutions au panel. Ce qui n'a pas été tranché, c'est la contradiction d'affichage : **peut-on dire
publiquement « nous ne jugeons pas » tout en tenant un siège dont le seul acte est de juger ?**

Trois sorties possibles, à choisir par Samy — je ne tranche pas :

1. **Séparer les personnes morales de la promesse** : le registre de faits ne juge pas ; l'agent
   évaluateur, lui, juge, et c'est annoncé comme un métier distinct.
2. **Requalifier la doctrine** : nous ne sommes pas un adjudicateur *de nos propres dossiers*, ce
   qui laisse la place à un rôle d'évaluateur ailleurs.
3. **Renoncer au siège** et n'en garder que l'observation — cohérence maximale, option perdue.

Ma préférence, si elle est demandée : **la 1**, parce qu'elle ne réécrit pas une promesse déjà
publiée et qu'elle est vérifiable de l'extérieur — deux adresses, deux métiers, deux pages. Mais
c'est un arbitrage de direction, pas une conclusion de mesure.

## Sources

- Kleros, mécanique des jurés et des frais : `docs.kleros.io/concepts/tokenomics`,
  `docs.kleros.io/products/escrow` (relus le 2026-08-04).
- ERC-8183 : lecture normative, [[erc-8183-escrow-et-evaluateur]].
- Séquestre ACP mesuré on-chain :
  [[2026-08-04-inspector-by-auraa-largent-va-dans-lautre-sens]].
