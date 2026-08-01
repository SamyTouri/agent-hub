---
title: Le contrôle du filtre — un zéro ne vaut rien tant qu'on n'a pas prouvé que le filtre filtre
type: concept
updated: 2026-08-01
---

# Le contrôle du filtre

## L'idée en une phrase

Quand on demande à un service « donne-moi les X qui sont aussi Y » et qu'il répond « aucun », il y
a deux explications : soit c'est vrai, soit **le service ignore silencieusement la condition Y** et
répondrait « aucun » à n'importe quelle question. **Un zéro non contrôlé n'est pas une mesure.**

## Le contrôle, qui prend dix secondes

Reposer la même question **sans** la condition, et vérifier qu'elle renvoie autre chose. Si oui,
le filtre discrimine et le zéro est réel. Si elle renvoie zéro aussi, on n'a rien mesuré.

## D'où ça vient

**2026-07-30.** Un catalogue de découverte annonçait des filtres par bénéficiaire, réseau et type.
Une première version de notre outil a parcouru mille entrées en croyant lire un catalogue filtré
et a conclu « nous ne sommes pas référencés ». C'était un **faux négatif silencieux** — le service
ignorait ses propres filtres — sur un outil dont l'unique travail était de détecter des échecs
silencieux.

**2026-08-01.** Appliqué en réflexe : « 75 agents inscrits comme évaluateurs, aucun avec du
revenu ». Le contrôle — même filtre de revenu sans la contrainte de rôle — renvoie 1 438. Le
filtre discrimine, **le zéro est réel**. Sans ce contrôle, la mesure la plus importante de la
journée n'aurait rien valu. Voir [[2026-08-01-siege-evaluateur-vide]].

## La formulation générale

**Quand un service filtre pour nous, il faut vérifier qu'il filtre vraiment avant de traiter son
silence comme une réponse.**

## Portée

Ça dépasse les API. La même erreur se commet en lisant une recherche qui ne renvoie rien, un
journal qui ne contient pas de ligne d'erreur, une base sans résultat. **Une absence est le
résultat le plus facile à fabriquer par accident.**

Voisin : [[date-de-plateforme-est-une-declaration]] — même famille, ne pas croire un système sur
parole.
