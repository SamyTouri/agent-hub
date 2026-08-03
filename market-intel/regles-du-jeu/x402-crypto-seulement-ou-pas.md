---
title: x402 est-il limité à la cryptomonnaie ?
type: règle du jeu
statut: MESURÉ (lecture de la spécification)
date: 2026-08-03
updated: 2026-08-03
---

# x402 accepte-t-il autre chose que la cryptomonnaie ?

Question posée par Samy. Réponse : **par intention, non ; en pratique aujourd'hui, oui — c'est
crypto seulement.** La nuance est écrite noir sur blanc dans le texte du protocole, et elle
compte.

## Ce que le protocole dit vouloir être

Spécification officielle, lue le 2026-08-03, citation exacte :

> « x402 is an open standard for internet native payments. It aims to support all networks (both
> crypto & fiat) and forms of value (stablecoins, tokens, fiat). »

Et dans ses principes de conception, plus explicite encore :

> « **Network, token, and currency agnostic**: we welcome contributions that add support for new
> networks (both crypto and fiat), signing standards, or schemes […] **x402 may extend support to
> fiat based networks, but will never deprioritize onchain payments in favor of fiat payments.** »

Le protocole est donc **conçu pour être agnostique**. Les deux champs qui décrivent un paiement —
le `scheme` (la façon de payer) et le `network` (où ça se règle) — sont des valeurs ouvertes, pas
une liste fermée de blockchains. Rien dans l'architecture n'interdit une carte bancaire.

## Ce que le protocole fait réellement

Mais quand on descend dans le déroulé du paiement, les étapes 9 et 10 sont sans ambiguïté :

> « 9. `Facilitator server` submits the payment to the **blockchain** based on the `scheme` and
> `network` of the `Payment Payload`.
> 10. `Facilitator server` waits for the payment to be confirmed **on the blockchain**. »

Le règlement spécifié va sur une chaîne. Point.

## La lecture correcte

Trois choses à ne pas confondre :

1. **L'architecture est ouverte.** Ajouter un mode de paiement fiat ne demanderait pas de casser
   le protocole, seulement d'écrire un nouveau `scheme` et de trouver un facilitateur capable de
   le régler.
2. **L'intention est déclarée.** « may extend support to fiat » est au futur, dans une page de
   principes. Ce n'est pas une fonctionnalité, c'est une porte laissée ouverte.
3. **Rien n'a franchi cette porte à ce jour.** Le déroulé normatif règle sur une chaîne, et je
   n'ai trouvé aucun `scheme` fiat implémenté.

**Donc : « x402 est crypto » est vrai aujourd'hui et faux comme affirmation d'architecture.** La
formule juste, et c'est celle à utiliser en public : *le protocole est conçu pour être agnostique
en devise, mais son seul chemin de règlement spécifié et implémenté passe aujourd'hui par une
blockchain.*

## Pourquoi ça change quelque chose pour nous

Ça déplace la raison pour laquelle le commerce entre agents est crypto. Ce n'est pas une
limitation du protocole de paiement — c'est en aval : **un agent ne peut pas détenir un compte
bancaire ou marchand en son nom propre**, parce qu'un compte exige une personne juridique. Une
adresse sur une chaîne, elle, encaisse sans demander qui elle est.

Le protocole n'est donc pas le verrou. Le verrou est **la capacité à encaisser**, et il tiendra
tant qu'un agent ne pourra pas être titulaire de quoi que ce soit. Voir
[[agent-paie-agent-vs-humain-achete-agent]].

Corollaire à surveiller : si un jour un `scheme` fiat apparaît, il faudra regarder **qui est
titulaire du compte au bout** — et ce sera probablement une entreprise humaine, ce qui ramènerait
x402 dans la catégorie « agent qui dépense l'argent d'un humain » plutôt que « agent qui gagne le
sien ».
