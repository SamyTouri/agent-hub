---
title: A2A mesuré là où les agents gagnent vraiment de l'argent — 10 %, pas 0,29 %
type: mesure
statut: MESURÉ (sonde de première main)
date: 2026-08-03
updated: 2026-08-03
---

# A2A : dix pour cent chez les agents qui encaissent, et une correction à faire

## Pourquoi cette mesure existe

Une étude tierce, citée dans [[2026-08-01-annuaires-le-meme-objet-compte-neuf-fois]], établissait
que sur 20 185 hôtes d'API qui répondent, **65 seulement publient une carte d'agent A2A, soit
0,29 %**, dont 41 non conformes.

Samy a posé la bonne objection : cet échantillon est un catalogue de **fournisseurs d'API**, pas
d'agents. Mesurons chez les agents.

## La méthode

J'ai extrait **tous les hôtes publiés par les 1 438 agents qui ont encaissé quelque chose** sur la
place de marché mesurée — 143 hôtes distincts — et j'ai demandé à chacun sa carte d'agent, aux
deux emplacements normalisés (l'actuel `/.well-known/agent-card.json` et l'ancien
`/.well-known/agent.json`). Lecture seule, cinq secondes de délai, une tentative.

## Le résultat

| | |
|---|---|
| Hôtes sondés | **143** |
| **Servent une carte à l'emplacement courant** | **14 — soit 9,8 %** |
| Servent aussi l'ancien emplacement | 12 |
| Agents distincts concernés | 13 |
| Hôtes qui ne répondent pas du tout | 46 (33 %) |
| Hôtes qui répondent mais sans carte | 62 en page introuvable |

**Rapporté aux seuls hôtes qui répondent** (environ 91), le taux monte à **15 %**.

## La correction à faire, et elle est nette

**Dix pour cent, ce n'est pas 0,29 %.** L'adoption d'A2A est **trente-quatre fois plus forte chez
les agents qui commercent réellement** que dans la population générale des fournisseurs d'API.

C'est logique et il faut le dire ainsi : A2A n'est pas un protocole ignoré, **c'est un protocole
concentré**. Il est adopté là où des agents ont effectivement besoin de se parler, et invisible
partout ailleurs. Toute phrase du type « personne n'utilise A2A » est fausse ; la phrase juste est
**« A2A est adopté par une minorité, et cette minorité est exactement là où l'argent se trouve »**.

## Une réserve qui compte autant que le chiffre

Les treize agents qui publient une carte cumulent **597 368 $** de revenu — mais **572 787 $
viennent d'un seul d'entre eux**, le deuxième plus gros gagnant de tout le marché. Les douze
autres totalisent environ **24 600 $**.

Donc : *un poids lourd publie une carte, et une longue traîne de très petits aussi.* Il ne faut
pas en conclure que « les agents qui gagnent publient une carte » — un seul cas domine la
statistique de revenu. Le chiffre solide est celui des **hôtes** (10 %), pas celui du revenu.

## Alors, comment communiquent-ils vraiment ?

C'est la question de Samy, et la réponse est claire une fois qu'on a la mesure.

**Ils ne se découvrent pas entre eux : ils se rencontrent dans une place de marché.** Les 90 % qui
ne publient aucune carte ne sont pas muets — ils travaillent, encaissent et livrent. Ce qui les
relie n'est pas un protocole de découverte pair-à-pair, c'est **l'intermédiaire** :

- **Le protocole de mission de la plateforme** fait le travail qu'A2A prétend faire. Créer une
  mission, fixer un budget, échanger des messages, soumettre un livrable, libérer les fonds — tout
  passe par le contrat d'escrow et le canal de la place ([[erc-8183-escrow-et-evaluateur]]). La
  découverte se fait par la fonction de recherche de la plateforme, pas par une carte publiée.
- **x402** couvre l'autre moitié : un point d'accès HTTP qui exige un paiement avant de répondre.
  Là non plus, aucune carte n'est nécessaire — l'agent appelle une URL, reçoit un défi de
  paiement, paie, obtient la ressource ([[x402-crypto-seulement-ou-pas]]).
- **MCP** sert à exposer des outils, avec ses propres annuaires, distincts et bien plus fournis.

**Autrement dit : la communication entre agents existe, mais elle est courtière, pas pair-à-pair.**
A2A décrit un monde où chaque agent publie sa carte de visite et où n'importe qui l'appelle
directement. Ce monde-là est à 10 %. Le monde réel passe par une place qui garde l'argent, tient
le fil de discussion et connaît les deux parties.

**Conséquence pour nous, et elle est structurante** : tant que l'intermédiaire est le passage
obligé, c'est lui qui détient la preuve de ce qui s'est passé — et c'est aussi lui qui n'en
conserve presque rien ([[2026-08-01-marche-acp-taille-et-vitalite]]). Le jour où A2A deviendrait
majoritaire, la preuve se disperserait chez les parties elles-mêmes, et notre rôle changerait de
forme. Ce basculement se surveille avec exactement cette mesure, répétée.

## À refaire

Ce relevé est un point. **Le répéter tous les mois donnerait la courbe d'adoption d'A2A chez les
agents qui commercent** — une série que personne ne publie, et qui est directement la matière
d'une note d'analyse.

Voisin : [[2026-08-03-sonde-endpoints-segment-confiance]] ·
[[agent-paie-agent-vs-humain-achete-agent]] · [[2026-08-01-annuaires-le-meme-objet-compte-neuf-fois]]
