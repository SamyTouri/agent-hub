---
title: Les deux grappes anormales — ce que la chaîne montre, et ce qu'elle ne montre pas
type: question ouverte
statut: MESURÉ (registre + chaîne) — aucune conclusion
date: 2026-08-03
updated: 2026-08-03
---

# Deux grappes, 11,4 % du marché, et une vérification on-chain

**De quel marché s'agit-il ?** Question de Samy, et la réponse est nette : **Virtuals ACP**, la
place de marché où des agents se vendent des services, avec règlement en USDC et VIRTUAL sur
**Base**. Ce n'est pas x402 — x402 est un rail de paiement HTTP distinct, avec son propre
catalogue. Les deux coexistent, et tous les chiffres de cette fiche viennent d'ACP.

## Ce que le registre déclare

**Grappe A — onze agents, exactement 201 acheteurs chacun.** Domaines sans rapport, créés en
treize jours en mars 2026, **224 857 $**. Sept propriétaires différents, dont un qui en détient
cinq. Détail : [[les-201-acheteurs]].

**Grappe B — quatre agents, un seul propriétaire.** Tous créés le **4 mars 2026**, aucune
description, nombres d'acheteurs entre 999 et 1 017 — un intervalle de 2 %. **220 850 $**.

Total : **445 707 $, soit 11,4 % de tout le revenu déclaré du marché.** Les quinze agents
appartiennent au même groupe interne de la plateforme, `OPENCLAW`.

## Ce que la chaîne montre — MESURÉ le 2026-08-03

J'ai relevé les quinze portefeuilles d'agents et je suis allé voir sur Base.

**Premier constat : les quinze portefeuilles ont un nonce à zéro et zéro USDC en solde.** Un nonce
à zéro signifie qu'aucune transaction n'a été *émise* par cette adresse. Ça ne dit rien des
réceptions, et un solde nul est normal si les fonds sont reversés. **Ces deux faits ne prouvent
donc rien à eux seuls** — je les note pour qu'on ne les surinterprète pas plus tard.

**Second constat, et c'est celui qui compte.** Sur le plus gros de la grappe B — revenu déclaré
**56 515 $** pour **1 004 acheteurs distincts** — j'ai relevé ses cinquante derniers transferts de
jetons :

| | |
|---|---|
| Transferts examinés | 50 |
| **Expéditeurs distincts** | **8** |
| dont deux adresses | **41 des 50 transferts** |
| Jeton dominant | **CBBTC**, 31 transferts, valeurs à quatre décimales de zéro |
| Transferts en USDC | 15 |
| Destinataire sortant identifié | **l'adresse propriétaire des quatre agents** |

**La plateforme annonce un millier d'acheteurs distincts. La page de transferts en montre huit.**

## Ce que ça peut vouloir dire — et pourquoi je ne tranche pas

Trois lectures tiennent, et **rien dans ce que j'ai mesuré ne permet de choisir** :

1. **Le règlement ne passe pas par le portefeuille de l'agent.** C'est l'explication la plus
   probable et la plus banale : sur ACP, les fonds transitent par le contrat d'escrow. Les
   « acheteurs » n'envoient pas directement à l'agent — ils alimentent le contrat, qui verse le
   net. Dans ce cas, ne voir que huit expéditeurs est **attendu**, et ne prouve rien du tout.
2. **Une flotte servie par un petit nombre de comptes.** Le compteur d'acheteurs de la plateforme
   compterait alors des identités de plateforme, pas des payeurs distincts sur la chaîne.
3. **Une circulation organisée.** C'est l'hypothèse que Samy a nommée. Elle est **possible et non
   démontrée**, et le motif des poussières de CBBTC répétées depuis deux adresses mérite d'être
   compris avant d'écrire quoi que ce soit.

## Ce qu'il faudrait mesurer pour trancher

C'est la partie utile de cette fiche.

- **Lire le contrat d'escrow ACP**, pas les portefeuilles : identifier l'adresse du contrat, et
  compter les payeurs distincts *à l'entrée* du contrat pour ces agents. Tant que ce n'est pas
  fait, aucune affirmation sur le nombre réel d'acheteurs n'est défendable.
- **Remonter les deux adresses dominantes** : qui les finance, à quoi elles servent ailleurs.
- **Comparer à un agent témoin hors grappe**, de revenu comparable. Si un agent ordinaire montre
  aussi huit expéditeurs, alors la lecture 1 est la bonne et la grappe n'a rien d'anormal côté
  chaîne. **C'est le test le moins cher et il doit être fait en premier.**
- **Établir la chronologie des flux sortants** vers l'adresse propriétaire.

## Avertissement, à respecter avant toute publication

Une régularité statistique n'est pas une preuve d'intention. Un compteur de plateforme qui ne
concorde pas avec la chaîne est d'abord un **défaut de compteur** — c'est le sujet de
[[date-de-plateforme-est-une-declaration]], et ce registre en a déjà fourni trois exemples.

**Publier une accusation de blanchiment ou de manipulation sur la base de ce qui est ici serait
exactement la faute que ce projet existe pour dénoncer** : présenter un calcul comme une
connaissance. Ce qui est publiable aujourd'hui, et qui est déjà beaucoup :

> Sur cette place, onze agents sans rapport entre eux partagent exactement le même nombre
> d'acheteurs, et quatre autres, créés le même jour par le même propriétaire et sans aucune
> description, affichent des nombres d'acheteurs à 2 % près. Ensemble ils portent 11,4 % du revenu
> déclaré du marché. Voici la méthode, refaites-la. Nous avons demandé publiquement une
> explication et nous publierons la réponse sans la modifier.

Le reste attend les mesures ci-dessus.

Voisin : [[les-201-acheteurs]] · [[2026-08-03-quelle-part-est-un-vrai-service]] ·
[[virtuals-acp]] · [[volume-brut-nest-pas-revenu]]
