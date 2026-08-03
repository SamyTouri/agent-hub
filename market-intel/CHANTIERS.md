---
title: Chantiers ouverts — qui travaille sur quoi, en parallèle
type: coordination
updated: 2026-08-03
---

# Chantiers ouverts

Ouvert le 2026-08-03, quand Samy a décidé de **découper le travail en plusieurs conversations
parallèles** plutôt que d'accumuler dans une seule. Cette page est le point de rendez-vous : chaque
conversation lit ici ce qu'elle possède et ce que les autres ont trouvé.

## ⚠️ Protocole obligatoire — à lire avant d'écrire quoi que ce soit

Les quatre conversations partagent **une seule copie de travail** (`C:\Dev\AgHub`, branche
`main`). Les fichiers sont donc visibles par toutes **en temps réel** — c'est voulu — mais rien
n'empêche techniquement deux conversations d'écrire au même endroit. Ces trois règles
l'empêchent par construction.

**1. Commence chaque séance en lisant les quatre journaux.**

| Chantier | Journal — lecture par tous, écriture par un seul |
|---|---|
| A — Marché | `journal/A-marche.md` |
| B — Terrain | `journal/B-terrain.md` |
| C — Communication | `journal/C-communication.md` |
| D — Produit | `journal/D-produit.md` |

C'est là que chaque conversation dépose ce qu'elle vient de trouver, en deux à cinq lignes, avec
le lien vers la fiche qui porte le détail. **Relis-les aussi en cours de séance si elle est
longue** : les autres écrivent pendant que tu travailles.

**2. N'écris que dans ton propre journal et dans les dossiers de ton chantier.**
Aucun fichier n'est jamais écrit par deux conversations — c'est ce qui rend la collision
impossible, plutôt que simplement improbable. **Cette page-ci n'est pas modifiée par les
conversations** : elle est fixée par Samy ou par une séance de coordination.

**3. Pour toucher la fiche d'un autre chantier**, ajoute une section « Correction datée du … » en
bas plutôt que de réécrire — convention déjà en vigueur ([[README]]) — et signale-le dans ton
journal.

**Côté git** : ne jamais faire `git add -A`. Ajoute explicitement tes chemins. Si un commit échoue
sur un verrou d'index, c'est qu'une autre conversation commit au même instant : attends et
recommence, rien n'est perdu.

---

## A — Marché : mesurer, et refaire les mesures dans le temps

**Possède** : `mesures/`, `acteurs/`, `regles-du-jeu/`.

Ce qui est fait est dans [[index]]. Ce qui reste, par ordre d'utilité :

- **Refaire les mesures existantes pour créer des séries.** Une mesure prise une fois n'est pas une
  tendance. Les deux qui comptent le plus : l'adoption A2A
  ([[2026-08-03-a2a-adoption-mesuree-chez-les-agents-qui-gagnent]], ligne de base 9,8 %) et la
  sonde des points d'accès ([[2026-08-03-sonde-endpoints-segment-confiance]], 67 % muets).
- **Séparer vente et subvention** dans le revenu déclaré — la question laissée ouverte par
  [[deux-grappes-anormales-verification-on-chain]], et la seule qui rendrait le total citable.
- **Revérifier l'écart de livraison d'Olas** avant tout usage public.
- Les acteurs d'arbitrage annoncés pour fin 2026.

## B — Terrain : parler aux gens

**Possède** : `acteurs/` pour les fiches d'interlocuteurs, et la mémoire projet pour les échanges.

**Le constat qui oriente ce chantier** : nos deux seules vraies avancées relationnelles sont venues
de **réponses à des personnes précises**, jamais d'une publication. Trois messages ciblés ont
produit trois corrections de produit ; un billet soigné a produit zéro.

- **Qui a tué AgentPulse** — question envoyée le 2026-08-03 à `@episkop_eth`, réponse attendue.
  Contexte complet : [[agentpulse]].
- **Tester le co-paiement** : proposer à un vendeur de co-payer un rapport sur lui-même. C'est le
  mécanisme adopté le 2026-08-01 et **jamais proposé à personne**. Candidat naturel :
  [[markus-dropspace]], qui nous a déjà corrigés trois fois.
- **Continuer à répondre** dans les fils ouverts plutôt qu'à publier.

## C — Communication : comprendre pourquoi ça ne porte pas

**Possède** : les fiches de diagnostic de diffusion, à créer.

- **Notre billet du 2026-08-01 est resté à zéro** : score 0, une réponse sans contenu, statut
  toujours « en attente de vérification » à deux jours, et absent du fil du forum. Notre billet du
  26 juillet, lui, est vérifié avec un score de 5.
- **À trancher avant toute conclusion sur le contenu : est-ce un problème technique de
  distribution, ou du désintérêt ?** Les deux lectures tiennent et rien ne les départage
  aujourd'hui. Tant que ce n'est pas tranché, ne pas conclure que le format ne marche pas.

## D — Produit : la proposition de valeur

**Possède** : `syntheses/`.

- [[2026-08-03-ce-que-les-mesures-disent-de-notre-offre]] pose **l'arbitrage laissé ouvert par
  Samy le 2026-08-03** : le marché où l'argent se trouve est « un humain achète un service
  d'agent », celui que la doctrine vise est « un agent achète à un agent ». Trois postures sont
  décrites, aucune n'est choisie. **Il faut plus d'information avant de trancher** — c'est la
  raison d'être des chantiers A et B.
- Le site : **pas de refonte** (brief suspendu, `docs/2026-08-03-brief-refonte-site.md`). Au plus,
  un changement de couleurs et une page propre pour un premier article.

---

## Ce qui ne bouge pas, quel que soit le chantier

- La doctrine (`docs/DOCTRINE.md`) fait autorité et ne se modifie que sur arbitrage de Samy.
- Aucun chiffre ne se publie sans sa source, sa date et sa méthode — y compris les nôtres.
- Une mesure fausse se corrige **en public et de façon datée**, jamais en silence.
- Avant de publier une régularité : **mesurer la même chose sur un témoin** qui n'a aucune raison
  de la présenter ([[deux-grappes-anormales-verification-on-chain]] explique ce que ça a évité).
