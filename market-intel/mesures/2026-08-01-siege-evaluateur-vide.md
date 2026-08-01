---
title: Le siège d'évaluateur d'escrow, mesuré à zéro
type: mesure
statut: MESURÉ
date: 2026-08-01
updated: 2026-08-01
---

# Le rôle d'arbitre payé que la norme a créé n'a jamais rapporté un centime

**Statut : MESURÉ** le 2026-08-01 sur le registre public de [[virtuals-acp]].

## Le chiffre

| Mesure | Valeur |
|---|---|
| Agents inscrits avec le rôle `EVALUATOR` | **75** |
| Parmi eux, ceux ayant le moindre revenu | **0** |
| Parmi eux, ceux ne publiant aucune offre | 45 |
| **Contrôle** : agents avec revenu, sans contrainte de rôle | **1 438** |

Le contrôle est la partie qui rend le zéro utilisable : le même filtre sans la contrainte de rôle
renvoie 1 438 agents, donc **le filtre discrimine et le zéro est une mesure, pas une panne**.

Les trente qui publient une offre ne vendent rien non plus : ils essaient, personne n'achète.

## Pourquoi personne n'en veut

Trois raisons lues dans le texte de la norme, détaillées dans
[[erc-8183-escrow-et-evaluateur]] :

1. **L'arbitre n'est payé que s'il approuve.** Refuser ne rapporte rien, laisser expirer non plus.
2. **Il ne fixe pas son tarif** : c'est un réglage global de la plateforme.
3. **Sa commission sort de la poche du prestataire**, celui-là même qu'il juge.

Et surtout, l'outil de développement officiel documente trois modes de fonctionnement, dont
**celui qu'il recommande en premier est « l'acheteur s'évalue lui-même »**. Un troisième mode
supprime l'arbitre : la livraison est validée automatiquement.

## Le contraste qui donne la conclusion

Le métier de juger le travail d'autrui, lui, se vend : 17,3 % du revenu du marché
([[2026-08-01-metiers-de-la-confiance]]). Simplement, **il ne se vend pas depuis le siège
d'arbitre** — il se vend comme une prestation ordinaire.

Le siège n'est donc pas vide faute d'annuaire pour trouver un arbitre — cet annuaire n'existe pas,
mais ce n'est pas la cause. **Il est vide parce que c'est un moins bon marché que l'alternative.**

## Le piège qu'un lecteur pressé se tend ici

Quatre agents portant le nom de la norme dans leur nom affichent environ 28 000 $ chacun. Un
observateur rapide conclut donc que l'évaluation d'escrow rapporte.

Ces quatre-là **ne sont pas enregistrés comme évaluateurs**, ils appartiennent au groupe décrit
dans [[les-201-acheteurs]], et un de leurs voisins décrit le nom de la norme comme un argument de
lancement de jetons plutôt que comme une catégorie de service. **Ce ne sont pas des preuves d'un
marché d'arbitrage.**

Voir aussi : [[erc-8183-escrow-et-evaluateur]] · [[les-201-acheteurs]]
