---
title: La hiérarchie des identifiants — comment on relie une transaction à un agent
type: concept
statut: RÈGLE OPÉRATIONNELLE — formalise une pratique implicite dans la doctrine, écrite le 2026-08-07
updated: 2026-08-07
---

# Quel identifiant porte le lien, et lequel ment

La doctrine pose que **le fait s'attache à la transaction, jamais à l'agent** — parce qu'une
identité ERC-8004 est transférable, qu'ERC-7857 rend le contenu même d'un agent vendable et
clonable, et qu'un dossier impeccable peut donc s'acheter. Reste la question pratique : **si
l'agent n'est pas le support, comment relie-t-on une transaction à celui qui l'a faite ?**

Cette fiche répond. C'est la **règle de jointure** du produit, et elle commande la façon dont on
stocke et dont on répond à une requête.

## La hiérarchie

| Identifiant | Force | Pourquoi |
|---|---|---|
| **Adresse de paiement** | **la plus forte** | elle est **dans** la transaction ; personne ne la déclare, le réseau l'a validée |
| **Signature** | preuve de contrôle | démontre qu'à cet instant quelqu'un détenait la clé de cette adresse |
| **Identité on-chain** (ERC-8004 `agentId`) | moyenne | stable comme numéro, mais **transférable** : le numéro reste, l'opérateur change |
| **Identifiant de tâche** (jobId de plateforme) | moyenne | lie acheteur, vendeur, prix et service — mais c'est la plateforme qui l'écrit |
| **URL de manifeste / endpoint** | **la plus faible** | bouge sans prévenir, domaines partagés, contenu mutable à URL constante |

**Le critère qui ordonne la table** : un identifiant vaut par le fait d'être *dans* la transaction
plutôt que raconté à côté. Une adresse est vérifiable par n'importe qui sans faire confiance à
personne. Un nom, une URL ou une fiche de registre exigent de croire celui qui les a écrits.

**Conséquence directe** : la réponse à un acheteur est meilleure quand il part d'une **adresse**
que d'un nom ou d'une URL. Plus l'identifiant est proche de l'argent, plus le lien est solide.

## Pourquoi la signature, et pas le hash de transaction

La chaîne est publique : n'importe qui peut copier un hash et prétendre en être partie. **Signer
prouve le contrôle d'une des deux extrémités.** C'est la raison de la règle d'admissibilité du
Bureau des plaintes (`docs/DOCTRINE.md`, couche B) — une exigence de preuve, pas une formalité.

## Trois nuances mesurées, à ne jamais oublier

1. **Une signature prouve un contrôle, pas une identité.** Elle établit que quelqu'un détenait la
   clé à cet instant — ni qui, ni si elle a été vendue ou volée.
2. **Le contrôle a des degrés.** Notre propre portefeuille OKX (07/08) : la clé vit dans un
   environnement d'exécution sécurisé **chez OKX**, l'accès passe par un login Google. Nous
   contrôlons cette adresse, mais **via un intermédiaire** — ce n'est pas une clé détenue seul.
   → [[../questions-ouvertes/experience-okx-en-cours]]
3. **Une adresse peut être pilotée par du code.** Les agents OKX mesurés utilisent **EIP-7702** :
   l'adresse délègue à un contrat, donc **le contrôleur peut changer sans que l'adresse change**.
   C'est ce qui a invalidé le nonce comme indicateur d'activité le 06/08.
   → [[../mesures/2026-08-06-okx-ai-mesure-on-chain-independante]]

## Les limites de l'ancrage par adresse — dites, pas cachées

- une même adresse peut servir **plusieurs agents d'un même opérateur** ;
- un opérateur peut en détenir des centaines — mesuré : 211 propriétaires détiennent 47,9 % du
  registre ACP en flottes de ~100 ([[../mesures/2026-08-01-marche-acp-taille-et-vitalite]]) ;
- une clé peut se vendre, comme le reste.

L'adresse est donc **le meilleur ancrage disponible, pas un ancrage parfait**. C'est précisément
pourquoi chaque observation est datée et pourquoi les ruptures restent visibles.

## Ce que ça donne en pratique

On ne prétend pas répondre « voici l'agent ». **Ce marché n'a pas d'identité stable — c'est un
fait mesuré, pas une lacune du produit.** On répond par un graphe de **liens datés entre
observations**, avec leur niveau de confiance :

> Vous me donnez l'adresse `0xABC`. Voici les 7 transactions où elle apparaît, avec dates, montants
> et livrables. Elle a été déclarée par l'identité #10579 entre le 3 mai et le 12 juin.
> **Le 12 juin, cette identité a changé de propriétaire** — les transactions d'avant et d'après ne
> sont pas du même opérateur, bien que le numéro n'ait pas bougé. Voici comment le vérifier.

Un score aurait écrasé cela en un chiffre, et **la rupture du 12 juin — l'information la plus
utile du dossier — aurait disparu**. C'est la raison pour laquelle la doctrine interdit de stocker
un score.

## Corollaire : un lien se retire, une fusion ne se défait pas

On regroupe — sinon le dossier est inexploitable. Mais **par liens, jamais par fusion** : un
mauvais regroupement se corrige en retirant un lien, les observations restant intactes. Une fusion
obligerait à réécrire l'histoire.

C'est l'argument que nous avons porté publiquement le 07/08 sur l'issue #3 du GlobalA2ARegistry :
ne pas résoudre silencieusement les changements d'URL mais **les enregistrer**, et rendre toute
fusion **datée et réversible** — faute de quoi une fiche hérite d'une confiance qu'elle n'a pas
gagnée. Fil et texte publié : mémoire projet `agent-hub-interlocuteurs.md`.

Voisin : [[agent-paie-agent-vs-humain-achete-agent]] · [[date-de-plateforme-est-une-declaration]] ·
[[couches-assurance-agentique]] · `docs/DOCTRINE.md` § *Naming a seller*
