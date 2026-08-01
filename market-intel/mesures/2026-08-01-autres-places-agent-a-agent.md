---
title: Les autres places où un agent paie un agent — et l'écart de livraison d'Olas
type: mesure
statut: MESURÉ + RAPPORTÉ (distingués ligne par ligne)
date: 2026-08-01
updated: 2026-08-01
---

# ACP est-elle la plus grosse ? Et le chiffre que personne n'a soustrait

Complète [[2026-08-01-hors-crypto-existe-t-il-un-marche]], qui établit que hors cryptomonnaie un
agent peut dépenser mais pas encaisser. Reste à savoir, **dans** la crypto, si
[[virtuals-acp]] est la plus grosse ou une parmi plusieurs.

## La trouvaille : 1,4 million de requêtes payées et jamais livrées

**MESURÉ** le 2026-08-01, en lisant la page publique du tableau de bord d'Olas Mech — la place
agent-à-agent la plus active en volume de requêtes.

| Indicateur affiché | Valeur |
|---|---|
| Requêtes totales | **11 381 199** |
| **Livraisons totales** | **9 969 465** |
| Paiements de tâches cumulés | 107 667,03 $ |
| Réclamés / non réclamés | 100 619,82 $ / 7 047,20 $ |
| Frais collectés | 463,37 $ |
| **Agents actifs par jour** | **8** |

**La soustraction que la page ne fait pas : 1 411 734 requêtes payées n'ont jamais produit de
livraison. Soit 12,4 %.**

Les deux nombres sont affichés côte à côte, publiquement, depuis le lancement. **Personne n'a
publié l'écart.** La page qualifie par ailleurs cette économie de « in demand as ever » tout en
affichant huit agents actifs par jour.

C'est exactement le sujet d'Agent Reputation, mesuré sur le tableau de bord de quelqu'un d'autre,
et il suffisait d'une soustraction. Réserve honnête : « requête » et « livraison » peuvent ne pas
avoir la même fenêtre de comptage, et un écart de 12,4 % peut inclure des requêtes en cours. **Il
faut le vérifier avant de le publier** — mais l'ordre de grandeur ne s'explique pas par un
décalage temporel sur un cumul de plusieurs années.

## La comparaison des places

**MESURÉ** le 2026-08-01 sur un agrégateur public recalculant depuis la chaîne
(`agenteconomy.to/data.json`, horodaté du jour) :

| Place | Ce qui est compté | Valeur |
|---|---|---|
| x402 | transactions cumulées | **160 025 654** |
| x402 | volume cumulé | **41 149 489 $** → panier moyen **0,257 $** |
| Olas | transactions d'agents, toutes chaînes | 18 544 684 |
| Virtuals ACP | mémos | 12 331 612 |
| Base « agentic » | transactions | 1 465 733 |
| ERC-8004 | **agents inscrits** | **417 181** sur 24 chaînes |
| Tempo MPP | payeurs uniques | 1 841 |
| Tempo MPP | **bénéficiaires uniques** | **90** |
| Tempo MPP | événements « Settled » | **384** sur 44 534 événements |

## Comment lire ces nombres sans se tromper

**Les gros chiffres ne sont pas ce qu'ils paraissent.**

- **x402 : le payeur est indéterminable.** Le protocole ne distingue pas un agent autonome d'un
  script lancé par un humain. RAPPORTÉ, non revérifié : la croissance vers cent millions de
  transactions serait largement portée par du minage de jeton spéculatif, et la tranche des
  tickets sous le dollar — celle qui signerait du vrai trafic machine — serait passée de 46 % à
  4 % du volume entre début 2025 et début 2026. **x402 grossirait donc en devenant *moins*
  machine-à-machine.**
- **ERC-8004 : 417 181 est un compteur d'inscriptions**, pas d'activité. S'inscrire coûte du gaz
  et rien d'autre. Voisin direct de [[volume-brut-nest-pas-revenu]].
- **Tempo MPP dit tout en deux nombres** : 1 841 payeurs pour **90 bénéficiaires**, et 384
  règlements sur 44 534 événements. L'offre qui encaisse réellement se compte en dizaines.

**Et les places qui affichent le plus ne font pas payer des agents.** RAPPORTÉ, non revérifié :
sur Recall, un humain immobilise du jeton pour financer l'entrée en compétition de ses agents ;
sur Bittensor, le gros du flux est de l'émission captée par du staking ; le mécanisme économique
chiffré de Fetch/Agentverse est une courbe de lancement de jeton, c'est-à-dire un humain qui
achète un jeton. **Aucun de ces trois n'est un agent qui paie un agent** — ce sont des marchés de
capitaux avec un agent comme récit.

## Le cas d'école : une place parfaitement fonctionnelle à zéro dollar

RAPPORTÉ par deux analyses tierces convergentes, **non revérifié en direct** (le site refuse la
lecture automatisée) : une place de marché réservée aux agents, avec séquestre, réputation et
primes, afficherait **24 agents dont 13 vérifiés et 0,00 $ réglés**. Des agents y listent des
services que d'autres agents n'achètent jamais.

Si ça se confirme, c'est le meilleur cas d'école de tout ce corpus : **la mécanique complète
existe, et il ne se passe rien.** À vérifier avant tout usage public.

## Réponse à la question posée

**ACP n'est pas la plus grosse en volume** — x402 la dépasse d'un ordre de grandeur en
transactions, Olas aussi. Mais x402 est un rail, pas une place, et son payeur est
indéterminable ; Olas est un circuit largement fermé où 98 % du trafic viendrait des agents de la
maison, pour 107 667 $ cumulés et huit agents actifs par jour.

**ACP reste la meilleure fenêtre sur le commerce entre agents** parce que c'est la seule où l'on
peut lire, par agent, ce qui a été vendu, à combien d'acheteurs distincts et pour quel montant.
Les autres publient des totaux ; elle publie une structure.

**L'écart le plus parlant du corpus** : entre le nombre d'agents inscrits quelque part — 417 181
sur un registre, des millions annoncés ailleurs — et le nombre d'agents qui encaissent réellement
— 90 bénéficiaires uniques sur un rail, 8 agents actifs par jour sur un autre, 1 438 avec le
moindre revenu sur ACP. **Quatre à cinq ordres de grandeur.**

Voir aussi : [[agent-paie-agent-vs-humain-achete-agent]] · [[2026-08-01-marche-acp-taille-et-vitalite]]
