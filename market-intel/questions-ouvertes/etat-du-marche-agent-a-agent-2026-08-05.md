---
title: État du marché agent-à-agent au 2026-08-05 — point de reprise pour la conversation de conclusion
type: question-ouverte
statut: POINT DE REPRISE — à ouvrir en premier
updated: 2026-08-05
---

# Ce qu'on sait du marché agent-à-agent, au 5 août 2026

Écrit à la demande de Samy, qui ouvre une conversation dédiée pour **conclure ce qu'on peut observer
aujourd'hui du marché agent-à-agent**. Ce fichier est le point d'entrée : il rassemble les
conclusions et renvoie aux fiches, il ne les répète pas.

Mission du projet, à garder au centre : **créer de la valeur économique grâce à la création de
confiance.**

## 1. Les six faits mesurés qui structurent tout

1. **Le marché a été gonflé, il a éclaté, il repousse.** Séquestre ACP : 1,16 M$ (fév.) → 778 $
   (mai, plancher) → **1 082 $ (juillet), en hausse depuis trois mois**, entièrement sur le contrat
   v2. → [[2026-08-04-le-sequestre-acp-de-1-16-million-a-neuf-dollars]]
2. **La cause est datée et documentée transaction par transaction** : programme aGDP annoncé le
   12 février (jusqu'à 1 M$/mois), distributeur Merkle alimenté quatre mardis de suite, dernier jour
   le 22 mars, et une flotte créée ce matin-là pèse **78 % du volume du dernier jour**.
   → [[2026-08-05-le-22-mars-anatomie-dune-bulle-subventionnee]]
3. **Le registre est à moitié fictif** : 211 propriétaires détiennent **47,9 %** des 44 051 agents,
   en flottes calibrées à ~100, créées en février. **Ne plus citer « 44 051 agents » nu.**
4. **Le siège d'arbitre payé n'a versé que 0,42 $** dans toute son existence, et quatre des cinq
   « évaluateurs actifs » **payaient** au lieu d'être payés.
   → [[2026-08-04-inspector-by-auraa-largent-va-dans-lautre-sens]]
5. **Le validateur ERC-8004 n'existe pas** : registre non déployé, zéro événement sur 787 121 lus.
   Mais **60 567 identités** enregistrées sur Base, et ça continue.
   → [[2026-08-04-erc-8004-sur-base-la-liste-des-validateurs-est-vide]]
6. **Les deux mondes ne se recouvrent pas** : 79 propriétaires ACP sur 8 725 (**0,91 %**) ont une
   identité ERC-8004.

## 2. La lecture stratégique, telle qu'elle tient aujourd'hui

**Il n'y a pas eu de choix du marché contre la confiance** — c'était ma formulation, invalidée par
Samy le 04/08. Il y a **deux marchés qui n'ont pas le même problème.**

Payer pour de la vérification exige **deux** conditions :

1. **assez de valeur en jeu** — le coût de l'erreur doit dépasser le coût du contrôle ;
2. **un livrable non autoévident** — s'il suffit de regarder pour savoir si c'est fait, il n'y a rien
   à vérifier.

| | valeur en jeu | livrable autoévident ? | besoin de confiance |
|---|---|---|---|
| **x402** — API, inférence, données | 1–10 centimes | **oui** (la réponse arrive ou non) | **structurellement nul** |
| **ACP** — travail commandé, livré plus tard | 0,05 $ médian, **plafond 10 $** | **non** | **réel, mais trop petit pour se financer** |

> **Notre marché apparaît quand se rencontrent une valeur unitaire suffisante ET un livrable dont la
> qualité n'est pas évidente à la livraison. L'indicateur est la valeur médiane par transaction sur
> les places où le livrable est jugeable — pas le volume.**

**Premier relevé de cet indicateur, encourageant** : la médiane v2 est passée de **0,01 $ (avr-mai) à
0,05 $ (juin-juil)**, ×5 tenu deux mois, moyenne ×7. Mais toujours 15× sous la médiane du pic
subventionné, et **aucun dépôt ne dépasse jamais 10,00 $**.

## 3. Les trois questions qui commandent la suite

1. ⭐ **Où, aujourd'hui, un agent paie-t-il plus de dix dollars pour quelque chose qui peut être mal
   fait sans que ça se voie ?** C'est la question de marché n°1. Piste : chercher sur x402 les
   services au livrable **jugeable** (audit, recherche, rédaction, analyse) et mesurer leur valeur
   unitaire. **Personne ne publie cette décomposition.**
2. **Le plafond de 10,00 $ sur ACP v2 est-il une configuration ou une limite de protocole ?** Tant
   qu'il tient, aucune mission de valeur ne peut passer par cette place et notre seuil ne peut pas y
   être franchi. **Question technique n°1.**
3. **Mesurer x402 nous-mêmes.** Tous nos chiffres x402 sont **RAPPORTÉS**, et l'une des sources
   (BlockRun) est partie prenante du marché qu'elle décrit. Rien d'engageant ne doit s'appuyer
   dessus avant que nous l'ayons compté.

## 4. Ce qui est en cours

- **Article public** : rédigé par Codex à partir de
  `.exchange/codex/brief-article-marche-agent-2026-08-05.md`. Le brouillon antérieur
  `docs/article-evaluator-market-2026-08-04.md` est **périmé et banni** (chiffre de juillet faux d'un
  facteur 113).
- **Billet Moltbook** : `.exchange/codex/mb-payload-post-collapse.json` est prêt mais **antérieur à
  la découverte du distributeur** — à réécrire avant publication. Limite : **un billet public par
  jour**.
- **Arbitrage doctrinal rendu par Samy le 04/08** : séparer les métiers (le registre de faits ne
  juge pas, un agent évaluateur distinct juge et c'est annoncé). Inscrit dans `docs/DOCTRINE.md`.

## 5. Conversations ouvertes, non traitées

- **`credodictum`** — évaluateur à tarif fixe, argumente sérieusement, cherche du travail payé.
  Meilleur candidat pour une conversation d'évaluateur à évaluateur. Nous lui devons une réponse à
  sa question ; il a répondu à la nôtre.
- **`botarena-gg`** — a construit un argument sur notre chiffre erroné, corrigé publiquement ;
  question posée en retour, sans réponse à ce jour.
- **`praxisagent`** — décrit notre couche comme celle au-dessus de la sienne, jamais contacté.
- **`markus_dropspace`**, **`rushabdev`** — à jour ([[markus-dropspace]]).

## 6. Ce qu'il ne faut plus écrire

- ⛔ « le marché s'est arrêté », « 9,56 $ en juillet » — **faux d'un facteur 113**.
- ⛔ « Virtuals a distribué plus d'1 M$ » comme fait mesuré — le contrat observé a reçu **272 778 $**.
- ⛔ « le farming était rentable » / « 28 centimes par dollar » — **borne grossière**, et sur la flotte
  mesurée récompense + règlement = 96,4 % du brut, donc **perdant** en autofinancement.
- ⛔ « x402 est onze fois plus gros que le marché agent-à-agent » — **comparaison faussée**, x402 est
  un compteur de consommation d'API.
- ⛔ « 44 051 agents » sans dire que **47,9 % sont des flottes**.
- ⛔ « les évaluateurs ont gagné 25,05 $ » — c'est de l'argent **sorti** ; ils ont encaissé **0,42 $**.
