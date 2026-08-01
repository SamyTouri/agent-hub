---
title: Hors cryptomonnaie, existe-t-il un marché où un agent vend à un agent ?
type: mesure
statut: MESURÉ (lecture de spécifications) + RAPPORTÉ
date: 2026-08-01
updated: 2026-08-01
---

# Hors crypto, un agent peut dépenser. Il ne peut pas encaisser.

**La réponse courte : non.** Aucun rail non-crypto examiné ne permet à un agent de **vendre** un
service et d'**encaisser en son nom propre**. Tous permettent à un agent de **dépenser** l'argent
d'un humain. Voir [[agent-paie-agent-vs-humain-achete-agent]] pour la distinction.

## Ce qui a été lu, et ce que ça dit

### Le protocole de paiement d'OpenAI — la phrase la plus tranchante

Spécification de paiement délégué, lue le 2026-08-01. L'acheteur y est un humain qui « règle avec
son moyen de paiement préféré et l'enregistre dans ChatGPT ». Le vendeur doit être un **marchand
conforme PCI DSS niveau 1** ou passer par un prestataire de paiement.

Et la conclusion de la lecture, sans ambiguïté : **il n'y a aucune disposition permettant à un
agent de détenir son propre moyen de paiement ni de recevoir des fonds en tant que vendeur.**

### Le protocole de Google et des réseaux de cartes (AP2)

Porté avec une soixantaine de partenaires dont Mastercard et PayPal. Lu le 2026-08-01 : il est
construit autour de la question « comment vérifier qu'un utilisateur a donné à un agent
l'autorité pour un achat précis ? ». Il repose sur une **chaîne de mandats** où l'humain autorise
d'abord, et son principe directeur est que « l'utilisateur doit toujours garder le contrôle ».

Il couvre le cas où l'agent agit **sans présence humaine**, mais cela signifie sans présence *au
moment de l'exécution* : l'autorisation humaine préalable reste obligatoire.

**C'est donc un agent qui dépense chez un marchand pour le compte d'un humain.** Pas un agent qui
vend à un agent.

### Stripe — RAPPORTÉ, non revérifié

Sa suite pour agents fournit des **cartes virtuelles**, de la facturation à l'usage et l'exécution
de paiements. Cartes virtuelles = instruments de **dépense** adossés à un compte humain.

### Le registre MCP officiel — MESURÉ

Parcouru le 2026-08-01 : **au moins 8 000 serveurs listés** (le parcours a été arrêté à 80 pages,
le vrai total est plus élevé).

**Aucune couche de paiement.** C'est un annuaire : il dit qu'un outil existe et où le joindre,
jamais qu'on peut l'acheter. Un annuaire téléphonique, pas une place de marché.

## La raison structurelle

Encaisser sur les rails classiques exige un **compte marchand**, donc une identité juridique
vérifiée, de la conformité et une banque. **Un logiciel n'est pas une personne juridique.** Il
peut recevoir une carte déléguée pour dépenser ; il ne peut pas ouvrir de compte pour encaisser.

Sur une chaîne publique, une adresse reçoit sans autorisation de personne.

**Le marché « agent vend à agent » est crypto par contrainte d'accès au compte, pas par idéologie.**

## Les chiffres du « marché des agents » qui circulent — RAPPORTÉ, à ne pas confondre

Environ 7,6 Md$ en 2025, 11 à 12 Md$ en 2026, des projections à 183 Md$ pour 2033. **Ce sont les
chiffres du marché A** : des entreprises qui achètent des logiciels agents. Une recherche ciblée
n'a trouvé **aucune statistique** isolant le commerce entre agents hors crypto — ce qui est
cohérent avec le fait qu'il n'existe pas de rail pour ça.

## Conclusion sur la représentativité de [[virtuals-acp]]

**Elle n'est pas représentative du « marché des agents » au sens large** — celui-là est mille fois
plus gros et n'a rien à voir.

**Elle est représentative de ce qui existe du commerce entre agents**, parce que c'est
aujourd'hui le seul type d'endroit où il peut exister. Sa coloration crypto n'est pas un biais
d'échantillonnage à corriger : c'est une propriété du seul rail disponible.

**Ce qui reste à faire** pour solidifier : mesurer les autres places crypto — Olas, NEAR AI,
Fetch/ASI, Bittensor — afin de savoir si ACP est la plus grosse ou une parmi plusieurs. Non fait.
Quatre recherches déléguées ont calé sur ce sujet ; les conclusions ci-dessus reposent sur des
lectures de spécifications faites à la main, ce qui est plus solide mais moins large.

Voir aussi : [[agent-paie-agent-vs-humain-achete-agent]] · [[volume-brut-nest-pas-revenu]]
