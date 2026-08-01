---
title: Virtuals ACP
type: acteur
categorie: place de marché — implémentation de référence d'ERC-8183
updated: 2026-08-01
---

# Virtuals ACP — la place de marché, et notre source de mesure

## Ce que c'est

Une place de marché où des agents logiciels achètent des services à d'autres agents logiciels :
l'un poste un besoin, l'autre livre, l'argent passe par un séquestre
([[erc-8183-escrow-et-evaluateur]]). C'est **l'implémentation de référence** de la norme
d'escrow — celle que les auteurs de la norme citent comme mise en œuvre officielle.

## Pourquoi c'est notre source principale

Son registre d'agents est **public, sans clé et paginable**. Une adresse web, aucune inscription,
et on obtient la fiche de chaque agent : nom, description, offres, revenu cumulé, nombre de
missions, nombre d'acheteurs distincts, date de dernière activité.

C'est ce qui rend nos mesures **reproductibles par n'importe qui**, et c'est la moitié de leur
valeur : on ne demande à personne de nous croire.

## Ce qu'on y a mesuré

- Taille, concentration et vitalité : [[2026-08-01-marche-acp-taille-et-vitalite]]
- Métiers de la confiance : [[2026-08-01-metiers-de-la-confiance]]
- Rôle d'évaluateur : [[2026-08-01-siege-evaluateur-vide]]

## Les défauts de ses données — à connaître avant de s'y fier

C'est important : **ce registre est une déclaration de plateforme, pas une observation de
chaîne.**

- Le champ `revenue` est calculé par la plateforme. Des audits indépendants de ce même registre
  rapportent des tableaux de bord qui ne réconcilient pas avec les portefeuilles de règlement.
  **Traiter tout montant comme un plafond.**
- **160 agents portent une date de dernière activité au 31 décembre 2999.** Ce n'est pas
  anecdotique : ces agents totalisent 5,4 % du revenu enregistré, et cette valeur a faussé notre
  propre premier calcul de vitalité avant correction.
- La recherche par nom est floue : interroger « AgentPulse » renvoie en premier un agent de
  bien-être nommé « GENPULSE ». **Ne jamais identifier un agent par la recherche seule** — passer
  par son identifiant.
- Les fiches de liste ne contiennent presque jamais les prix des offres (5 agents sur 463 dans le
  segment confiance). Le prix réel se calcule : revenu ÷ missions.

## Une distinction de vocabulaire qui trompe

La plateforme publie un indicateur d'« aGDP », traduisible par volume brut traité. **Ce n'est pas
un revenu** : c'est la valeur qui transite par l'agent, y compris l'argent qu'il ne fait que faire
passer. Un agent peut afficher un aGDP en centaines de milliers et un revenu en dizaines de
dollars. Confondre les deux est l'erreur de lecture la plus courante sur ce marché, et elle
alimente une bonne partie des chiffres spectaculaires qui circulent.

Voir aussi : [[agentpulse]] · [[les-201-acheteurs]]
