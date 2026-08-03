---
title: Quelle part de ce marché est un vrai service rendu par un agent à un agent
type: mesure
statut: MESURÉ (classification par mots-clés — magnitude, pas recensement)
date: 2026-08-03
updated: 2026-08-03
---

# La moitié est spéculative, un cinquième ne dit pas ce qu'il fait

Question de Samy, formulée comme une hypothèse à tester : *le marché entre agents est
probablement quasi inexistant hors systèmes spéculatifs ; les vrais services rendus par un agent
et achetés par un agent sont sans doute marginaux.*

**L'hypothèse tient.** Voici la mesure, sur les 1 438 agents qui ont encaissé quelque chose et les
3 923 557 $ qu'ils ont encaissés depuis l'origine. Corpus : instantané du 2026-08-01.

## La ventilation

| Nature de l'activité | Agents | Revenu | Part | $/mission |
|---|---|---|---|---|
| **Spéculation** — trading, signaux, jetons, rendement | 511 | **1 989 599 $** | **50,7 %** | 1,20 $ |
| Contenu — texte, image, vidéo, son | 146 | 456 670 $ | 11,6 % | 2,29 $ |
| **Ne déclarent rien du tout** | **533** | **699 894 $** | **17,8 %** | — |
| Données — recherche, veille, extraction | 117 | 171 265 $ | 4,4 % | 1,44 $ |
| Confiance — vérification, audit, risque | 48 | 174 740 $ | 4,5 % | 3,21 $ |
| Social — communauté, marketing | 16 | 143 891 $ | 3,7 % | 9,19 $ |
| Technique — code, infrastructure | 16 | 85 071 $ | 2,2 % | 44,66 $ |
| Autres, avec description | ~51 | ~202 000 $ | 5,1 % | — |

## Les trois faits qui répondent à la question

**1. La moitié de l'argent est spéculative.** Cinq cent onze agents sur mille quatre cent
trente-huit vendent du signal de trading, de l'alpha, du suivi de jeton, du rendement. Ils
concentrent **50,7 %** du revenu. Ce n'est pas un service rendu à un agent qui en avait besoin
pour son travail : c'est le marché crypto ordinaire avec des agents comme guichets.

**2. Un cinquième du marché refuse de dire ce qu'il fait.** **533 agents** ne publient **ni
description, ni offre** — rien. Et ils ont encaissé **699 894 $**, soit **17,8 %** de tout
l'argent. Il ne s'agit pas de petits comptes : les huit plus gros de ce groupe encaissent entre
41 000 et 92 000 dollars chacun.

Un marché où près d'un cinquième des recettes va à des vendeurs qui ne déclarent rien n'est pas un
marché de services. C'est autre chose, et personne ne dit quoi.

**3. Ce qui ressemble à un vrai service plafonne à un quart.** En additionnant tout ce qui est
plausiblement une prestation livrée — contenu, données, confiance, technique, social — on obtient
**26,4 %**, soit **environ 1,03 million de dollars**. Sur toute l'histoire de la plus grande place
de marché agent-à-agent qui existe.

**Un million de dollars, jamais dépassé, tous services confondus, depuis l'origine.** C'est le
chiffre à retenir, et c'est un **plafond** : la classification se fonde sur ce que les agents
écrivent eux-mêmes, et [[2026-08-03-sonde-endpoints-segment-confiance]] a montré que deux tiers
des points d'accès de ces mêmes vendeurs ne répondent pas.

## Un second groupe anormal, de la même forme que le premier

[[les-201-acheteurs]] documentait onze agents partageant exactement 201 acheteurs. En cherchant
qui gagne sans rien déclarer, un deuxième groupe apparaît, plus serré encore :

| Agent | Revenu | Missions | Acheteurs | Taux de succès |
|---|---|---|---|---|
| Synapse Robotics Network | 56 515 $ | 2 804 | **1 004** | 98,73 % |
| AutoForge AI | 55 555 $ | 2 756 | **1 007** | 97,73 % |
| RoboSphere Network | 54 905 $ | 2 935 | **1 017** | 99,09 % |
| MechaMind Protocol | 53 875 $ | 2 787 | **999** | 98,72 % |

**Un seul propriétaire** (`0x476fff09a555…`), **tous créés le même jour** — le 4 mars 2026 —,
**aucune description**, et des nombres d'acheteurs qui tiennent dans un intervalle de **2 %**.
Total : **220 850 $**.

Les deux groupes réunis pèsent **445 707 $, soit 11,4 % de tout le marché.**

Comme pour le premier, **c'est une observation, pas une conclusion**. Une flotte servie par un
même jeu d'acheteurs produirait exactement cette signature, et c'est une explication banale. Ce
qui mérite d'être noté, c'est qu'une régularité pareille n'apparaît nulle part ailleurs dans le
corpus, et qu'elle concerne à chaque fois des agents qui ne disent pas ce qu'ils font.

## Ce que ça change pour notre positionnement

**L'hypothèse de Samy est confirmée**, et elle vaut mieux qu'une intuition : elle est chiffrée et
rejouable. Le commerce de services entre agents existe, il est réel, et il pèse **de l'ordre du
million de dollars cumulé** — pas les centaines de millions annoncées.

Trois conséquences directes :

- **Se positionner maintenant, c'est arriver avant le marché, pas dedans.** C'est cohérent avec la
  décision de Samy du 28/07 : une opportunité n'est disqualifiée que si un acteur mieux placé la
  couvre déjà.
- **Le sujet le plus vendeur n'est pas la taille, c'est l'écart.** Entre ce qui est annoncé et ce
  qui est encaissé ; entre ce qui est déclaré et ce qui répond ; entre ce qui se présente comme un
  service et ce qui est un instrument spéculatif.
- **La mesure doit devenir une série.** Ce relevé est un point. Sa valeur véritable naîtra du
  deuxième et du troisième — c'est ce qui permettra de dire si le quart « vrai service » grandit
  ou stagne, et personne d'autre ne le publiera.

## Réserves

- **C'est une classification par mots-clés sur des textes auto-écrits.** Elle donne une magnitude
  fiable, pas un recensement. Un agent qui vend du vrai service sans employer le vocabulaire
  attendu tombe dans « non classé ».
- Les catégories sont attribuées **par ordre de priorité** : un agent qui parle de trading *et* de
  contenu est compté en spéculation. C'est un choix, et il gonfle volontairement la catégorie
  spéculative — le chiffre de 50,7 % est donc un **plafond**, comme celui des services est un
  plafond dans l'autre sens.
- Le champ de revenu est déclaré par la plateforme ([[volume-brut-nest-pas-revenu]]).

Voisin : [[2026-08-01-marche-acp-taille-et-vitalite]] · [[les-201-acheteurs]] ·
[[agent-paie-agent-vs-humain-achete-agent]]
