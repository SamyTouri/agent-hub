---
title: Les annuaires — le même objet compté par cinq sources donne un facteur neuf
type: mesure
statut: MESURÉ (deux compteurs) + RAPPORTÉ (le reste)
date: 2026-08-01
updated: 2026-08-01
---

# « Il y a N serveurs MCP » est une phrase indéfendable

## Le fait

Cinq annuaires comptent le même objet — un serveur MCP — et donnent des nombres qui vont de
**7 570 à 66 743**. Facteur **8,8**.

| Source | Serveurs | Statut |
|---|---|---|
| Smithery | **7 570** | **MESURÉ** — API publique, champ `totalCount`, lu le 2026-08-01 |
| Registre MCP officiel | **≥ 8 000** | **MESURÉ** — pagination arrêtée à 80 pages, total non exposé par l'API |
| mcp.so | 18 067 | RAPPORTÉ |
| PulseMCP | 22 103 | RAPPORTÉ |
| Glama | **66 743** | RAPPORTÉ |

## Ce n'est pas une erreur de mesure, ce sont cinq définitions

- **Smithery** compte ce qui est déployable et hébergé chez lui.
- **Le registre officiel** exige une publication déclarative authentifiée : on n'y est que si on
  s'y est inscrit. Il n'expose **aucun total** — ni champ dédié, ni point d'accès de statistiques —
  donc le chiffre exact n'existe que par énumération complète.
- **Glama** moissonne les dépôts publics : il compte du code qui existe, pas un service qui répond.
- **PulseMCP** cure éditorialement.
- **mcp.so** agrège les autres.

**Chacun a raison dans son périmètre, et aucun ne le publie à côté de son chiffre.**

## Le piège concret rencontré

La page d'accueil de mcp.so affiche « 53 000+ servers » et « 13 000+ agents ». **Ce ne sont pas
ses compteurs** : ce sont les accroches de fiches tierces qu'elle référence. Son vrai chiffre est
18 067. Un lecteur pressé recopie le mauvais nombre sans faire de faute de raisonnement — juste en
lisant la page.

## La même chose sur les agents, en pire

- **Un réseau social d'agents** : 206 839 agents vérifiés par un humain contre **2 895 874
  déclarés**. Facteur 14. Et une divulgation de sécurité rapporte 1,5 million d'agents pour
  17 000 propriétaires humains, soit **environ 88 agents par humain réel**. RAPPORTÉ.
- **Le registre d'identité on-chain** : j'ai mesuré **417 181** agents chez un agrégateur ; un
  autre annonce **384 662** le même jour. Deux sources qui recomptent la même chaîne divergent de
  **32 519 agents, soit 8 %**. Aucune ne publie sa méthode.

## Ce que 13 annuaires sur 14 ne font pas

**Ils référencent, ils ne transactent pas.** Sur les quatorze annuaires examinés, un seul fait
payer un agent par un agent. Partout ailleurs où de l'argent circule, c'est **un humain qui paie
la plateforme** — hébergement, passerelle, sponsoring de référencement — jamais machine à machine.
Cohérent avec [[agent-paie-agent-vs-humain-achete-agent]].

## La ligne qui résume notre position

RAPPORTÉ, non revérifié, et c'est notre thèse en une phrase : sur 65 adopteurs d'un protocole
d'interopérabilité entre agents, **41 publient une fiche d'identité qu'un client conforme ne peut
pas consommer**. Six sur dix des déclarations sont inexploitables par la machine qui devrait les
lire.

**Personne n'observe l'exécution.** Les annuaires indexent des métadonnées auto-déclarées ; le
seul qui touche à de l'argent réel publie du volume agrégé sans le rattacher à un prestataire
nommé. **La déclaration ne vaut pas preuve** — et c'est exactement l'espace que ce projet occupe.

## La règle qui en sort

**Aucune phrase de la forme « il y a N agents » ou « il y a N serveurs » ne peut être écrite sans
nommer la source, son périmètre et sa date.** Y compris les nôtres.

Voisin : [[volume-brut-nest-pas-revenu]] · [[date-de-plateforme-est-une-declaration]] ·
[[controle-du-filtre]]
