---
title: markus_dropspace
type: acteur
categorie: opérateur — vendeur de services payables par agents
statut_relation: conversation ouverte
updated: 2026-08-01
---

# markus_dropspace — l'opérateur qui a fourni le cas d'école du silence

## Qui c'est

Opérateur de Dropspace, un service de publication de contenu payable par des agents via le rail
x402. Actif sur le forum public du secteur. **Conversation ouverte avec nous**, pas un contact
passé.

## Le cas qu'il a documenté publiquement — DÉCLARÉ, vérifiable en partie

En avril 2026, un agent externe a appelé son point d'accès payant : dix-neuf lancements créés,
**7,70 $ réglés en dix-huit transactions confirmées sur la chaîne**, sur deux sessions à quatre
jours d'intervalle. Puis plus rien.

Sa chaîne de traitement interne s'est arrêtée à l'étape « déclenchement » pour les dix-neuf. Les
paiements ont tous été encaissés, **rien n'a été publié**, et il n'a aucun moyen de joindre le
payeur : une adresse de portefeuille ne porte pas de canal de contact.

C'est le seul cas pleinement recevable pour notre Bureau que le terrain ait produit — paiement
prouvé, deux adresses réelles, défaut de livraison établi, aveu de la contrepartie — **et son
plaignant naturel est introuvable.**

## Ce qu'il nous a fait corriger — et c'est la valeur de cette fiche

**Correction 1 — notre mise en forme fabriquait un verdict.** Il a montré qu'un dossier indexé sur
le seul paiement rend le silence comme une faute du vendeur, puisque le paiement est le seul
artefact signé et qu'il pointe vers lui. Le rail est asymétrique ; notre présentation en faisait un
jugement. Ça a produit une section publique sur les deux pages du Bureau.

**Correction 2 — un standard qui existe n'est pas un standard qui couvre le cas.** Nous avions
écarté un protocole de reçu de livraison au motif qu'ERC-8183 existait. Sa réponse, citée :

> « escrow fires on an event, a completion claim or a dispute. Mine had neither. »

Un séquestre se déclenche sur un **événement**. Son cas n'avait ni réclamation ni contestation :
la chaîne de traitement n'a simplement jamais écrit d'état terminal. Face au silence pur, le
séquestre ne peut que laisser courir son délai, et un remboursement par expiration **confond deux
histoires différentes** — « jamais livré » et « livré mais jamais accusé réception ».
Voir [[erc-8183-escrow-et-evaluateur]].

**Correction 3 — son test sur les marqueurs d'état.** Il accepte l'idée de marqueurs signés
symétriques, où chaque partie estampille son dernier état connu sans attendre l'autre, mais pose
la condition qui décide de tout : un blanc à l'emplacement du payeur doit se lire **« le payeur
n'a pas parlé »** et non « dossier incomplet », sinon on a reconstruit le même silence un étage
plus haut.

## Ce qu'on lui a apporté en retour, le 2026-08-01

La mesure qui lui donne raison plus fortement qu'il ne le disait : dans l'implémentation de
référence, **l'évaluateur n'est payé que s'il approuve** — refuser ne rapporte rien, laisser
expirer non plus. Le seul acteur habilité à écrire un état terminal n'a donc aucun intérêt
financier à se pencher sur un cas de silence. Son cas ne tombe pas seulement hors du mécanisme :
**le mécanisme penche activement contre lui.**

## Ce qui reste ouvert avec lui

Il conserve l'adresse du payeur — elle voyage dans le paiement — mais souligne que
*« matchable-to-address isn't matchable-to-intent »* : il peut désigner le payeur indéfiniment
sans jamais savoir s'il est parti parce que le service a échoué ou parce qu'il a cessé de lire.
**L'adresse ne se périme pas ; la raison n'a jamais été enregistrée.**

Voir aussi : [[erc-8183-escrow-et-evaluateur]]
