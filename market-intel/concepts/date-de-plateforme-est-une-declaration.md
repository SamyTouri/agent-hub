---
title: Une date de plateforme est une déclaration, pas une observation
type: concept
updated: 2026-08-01
---

# Une date de plateforme est une déclaration, pas une observation

## L'idée

Quand une plateforme affiche « dernière activité : 8 avril », ce n'est pas un fait observé sur le
monde. C'est **une valeur que la plateforme a écrite dans sa propre base**, selon des règles
qu'elle ne publie pas. Elle ressemble à une donnée technique neutre, et c'est ce qui la rend
dangereuse : personne ne pense à la mettre en doute.

## Ce qui l'a fait naître — deux fois dans la même journée

**Le 2026-08-01, matin.** Cent soixante agents portent une date de dernière activité au **31
décembre 2999**. Un calcul d'ancienneté naïf les compte comme actifs à l'instant même. Première
ventilation publiée en interne : fausse d'un facteur quinze.

**Le 2026-08-01, après-midi.** Pire : pour **69,5 % des agents**, la « dernière activité » est
identique à la date de publication **à la seconde près**, et les deux champs bougent ensemble. Le
champ ne distingue donc pas « l'agent a travaillé » de « la fiche a été touchée ». Une conclusion
entière — « le marché est un cimetière, 36 agents vivants » — a dû être retirée.

Détail : [[2026-08-01-marche-acp-taille-et-vitalite]]

## La règle qui en sort

**Ne jamais tirer une conclusion sur le monde à partir d'un champ que quelqu'un d'autre remplit,
sans avoir d'abord testé ce que ce champ vaut.** Le test coûte peu : comparer le champ à un autre
champ qui devrait en différer, et regarder combien de fois ils coïncident.

## Ce qu'il faut faire à la place

**Sonder.** Interroger en lecture seule le point d'accès que l'acteur publie lui-même, et
enregistrer ce qui répond. Une connexion refusée est une observation ; une date dans une base ne
l'est pas.

Premier cas où la sonde a tranché : le serveur d'[[agentpulse]] ne répond plus du tout, ce qui
concorde avec sa date ancienne. **Une concordance n'est pas une validation** — il en faudrait des
dizaines pour rendre le champ utilisable.

## Où ça s'applique ailleurs

Partout où on lit une plateforme plutôt que le monde : compteurs d'agents, montants de revenus,
taux de succès, notes. Voisin direct : [[volume-brut-nest-pas-revenu]]. Méthode sœur :
[[controle-du-filtre]].
