---
title: Le billet du 1er août n'a pas été ignoré — il n'a jamais été distribué
type: mesure
chantier: C
updated: 2026-08-03
---

# Un billet non vérifié est invisible, pas impopulaire

**La question posée au chantier C** ([[CHANTIERS]]) était : notre billet du 2026-08-01 est resté à
zéro, **panne technique de distribution ou désintérêt** ? Les deux lectures tenaient et rien ne les
départageait.

C'est tranché, et dans le sens technique. **Le billet est absent de toutes les surfaces publiques de
la plateforme.** Personne ne l'a ignoré : personne n'a eu l'occasion de le voir. Le zéro ne mesure
pas l'accueil du contenu, il mesure notre propre échec de publication.

## Ce qui a été mesuré

**MESURÉ le 2026-08-03**, via le connecteur Moltbook en lecture seule, sur le compte
`agentreputation`.

### 1. L'état de nos trois billets

| Billet | Forum | `verification_status` | Score | Commentaires |
|---|---|---|---|---|
| 2026-07-17 « profile can no longer be overwritten » | `general` | **verified** | 2 | 20 |
| 2026-07-26 « we paid an external agent 0.05 USDC » | `agents` | **verified** | 5 | 7 |
| **2026-08-01 « I counted who actually earns »** | `agentfinance` | **pending** | **0** | 2 |

Les deux commentaires du billet du 1er août sont notre propre correction du 2 août et un message
sans contenu. Aucun lecteur n'a réagi au fond.

### 2. Il est absent du fil de son forum

Le fil `agentfinance` trié par nouveauté couvre une fenêtre qui **contient strictement** l'heure de
publication : du 2026-08-01T06:22 au 2026-08-03T12:34, 25 billets. Le nôtre est daté du
2026-08-01T10:07. Ses deux voisins immédiats — `alkhwarizmi` à 09:30 et `kenweaprotocol` à 10:52 —
sont tous les deux présents. **Le nôtre n'y est pas.** Il est également absent des tris `hot`,
`rising` et `top`.

### 3. Le témoin : le forum n'est pas mort

C'est le contrôle qu'impose la règle du projet — mesurer la même chose sur quelqu'un qui n'a aucune
raison de la présenter. Sur ces 25 billets voisins : **scores de 2 à 15, commentaires de 5 à 27,
aucun à zéro**. L'hypothèse « ce forum ne lit personne » est réfutée. Notre zéro est le seul.

### 4. L'explication rivale est réfutée

L'API pourrait simplement masquer nos propres billets à notre propre compte. Test : une recherche
sémantique ciblée sur une formule distinctive de chacun de nos trois billets.

- billet du 17/07 → **1 résultat, le nôtre**
- billet du 26/07 → **1 résultat, le nôtre**
- **billet du 01/08 → 0 résultat**

La plateforme indexe donc bien nos billets, et pas celui-là. Il reste une variable qui sépare les
deux groupes : le statut de vérification.

## Le mécanisme

Chaque création de contenu renvoie un défi arithmétique valable **cinq minutes**, dont le code
n'existe **que** dans la réponse de création — il est introuvable en relisant le billet ensuite
(`OUTREACH-ROUTINE.md`, recette du 17/07). Sans réponse dans la fenêtre, le contenu reste `pending`.

Le 1er août, ce défi n'a pas été résolu. La fenêtre est perdue définitivement : **ce billet ne peut
plus être vérifié, donc plus jamais être distribué.**

⚠️ Le lien « pending → invisible » est une **inférence**, pas une mesure directe du code de la
plateforme : trois billets, deux vérifiés et visibles, un en attente et absent de quatre surfaces
indépendantes. C'est la seule variable connue qui les sépare, mais nous n'avons pas l'implémentation.
Ce qui est mesuré sans réserve, c'est **l'invisibilité**.

*Signal externe, non vérifié, à traiter comme une piste* : un autre agent a publié le 2026-08-03 dans
`agents` un billet intitulé « Pending is a quarantine state ». Il décrit le même mécanisme. Donnée
externe non contrôlée — elle oriente, elle ne prouve pas.

## Ce que cette mesure invalide

**1. Notre propre procédure affirme le contraire, et elle a tort.**
`OUTREACH-ROUTINE.md` conclut sa recette de vérification par : « Un contenu non vérifié reste
`pending` (visible et fonctionnel, badge de crédibilité en moins). » C'est **faux**. Ce n'est pas un
badge en moins, c'est la diffusion en entier. Cette phrase a fait traiter comme cosmétique une étape
qui conditionne tout. Une correction datée a été posée à l'endroit exact.

**2. La prémisse « un billet soigné a produit zéro » ne tient plus.**
[[CHANTIERS]] oriente le chantier B sur ce constat : trois messages ciblés ont produit trois
corrections, un billet soigné a produit zéro. La deuxième moitié n'est pas une observation sur la
publication — c'est une panne. **Le test n'a jamais eu lieu.** Le seul billet réellement distribué et
argumenté, celui du 26 juillet, a rapporté 5 points et sept commentaires, dont trois critiques de
fond qui ont fait changer le dossier Case-002. C'est un résultat de publication, pas un zéro.

## Ce que cette mesure ne prouve pas

**Elle ne dit rien de la qualité du billet du 1er août ni de l'intérêt du marché pour nos mesures.**
On ne peut pas conclure que le format marche : on constate qu'il n'a pas été essayé. La question du
contenu reste entière et demande une publication réellement distribuée pour être tranchée.

## Remède, et ce qui le contraint

Le billet est irrécupérable en l'état. Le remettre en circulation suppose de le republier — **acte
public, donc décision de Samy**, et rien n'a été publié dans cette séance. Deux contraintes à
connaître avant :

- notre connecteur **bloque la republication d'un texte identique** (empreinte déjà enregistrée) :
  il faudra une version réécrite, ce qui est de toute façon souhaitable puisque le billet a reçu une
  correction le 2 août ;
- **un seul billet public par jour** de projet.

Pour que ça ne se reproduise pas, le contrôle qui manque est un **relevé après coup** : relire le
`verification_status` du billet quelques minutes après publication, au lieu de faire confiance à la
réponse de création. Le fichier d'état local ne peut pas jouer ce rôle — il enregistre le statut **au
moment de la création** et ne le rafraîchit jamais, ce qui explique qu'il affiche encore « pending »
pour les trois billets, y compris les deux qui sont vérifiés depuis.

## Refaire la mesure

Sans clé en clair, via le connecteur local :

1. `moltbook_get_thread` sur chacun des trois identifiants → lire `verification_status` et `score`.
2. `moltbook_feed` sur `submolt: agentfinance`, tris `new` / `hot` / `rising` / `top` → vérifier la
   présence de l'identifiant, et relever la fenêtre de dates couverte pour prouver que la nôtre y est
   contenue.
3. `moltbook_search` sur une formule distinctive de chaque billet → présence ou absence.

Identifiants : `5084c27b-a08b-4c88-8def-8bc1c9c6f408` (17/07),
`26d313bd-2bd2-4943-8798-5a4febe51888` (26/07), `e7d42bb8-4b14-457e-8e8a-c897f74e689a` (01/08).

## En passant — pour le chantier B

Le relevé du compte signale **13 notifications non lues**, dont une réponse de `markus_dropspace` du
2026-08-01 à 14:16 sur le fil « an agent paid $7.70 into my x402 endpoint then went silent »
(`3756332c-1754-4184-beb6-18792893572a`). Conversation ouverte, laissée sans réponse depuis deux
jours. Ce n'est pas le chantier C qui la traite — c'est signalé, pas touché.
