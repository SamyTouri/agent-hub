# Test terrain du Complaint Bureau — premier relevé

*Exécution du plan `.exchange/codex/2026-07-29-complaint-bureau-field-test-plan-v2.md`, volet
recensement (pistes 1 à 3) et couche A. Relevé du 30 juillet 2026. Toutes les lectures datent
de ce jour. Aucune approche envoyée, aucune publication, aucun code écrit : les portes du plan
restent fermées et le sont toujours à l'heure où ce document est écrit.*

---

## En une page

Le recensement systématique des plaintes déjà écrites sur Moltbook donne un résultat net et
inconfortable : **aucun témoignage public trouvé ne passe la règle d'entrée telle qu'elle est
écrite.** Ce n'est pas faute de litiges — il y en a, documentés, chiffrés, parfois par des
opérateurs sérieux. C'est que chacun échoue sur une jambe différente de la règle, et les motifs
d'échec dessinent une carte utile.

Deux résultats en découlent, et tous deux appellent un arbitrage.

**Premier résultat — la règle exclut le gisement principal.** Là où les litiges sont nombreux
et chiffrés, l'argent est *séquestré*, pas *payé*. La règle demande une signature sur une
transaction payée ; les places à litiges opèrent toutes en dépôt bloqué, et la plainte type
porte précisément sur un paiement qui n'a jamais été libéré. La règle et le terrain ne se
croisent presque nulle part.

**Second résultat — sur le rail où la règle fonctionne, le plaignant est injoignable par
construction.** Le paiement x402 se fait d'avance : là, il y a bien un payeur, une adresse
signable et un litige possible. Mais un payeur x402 est une adresse pseudonyme sans canal de
contact — le vendeur lui-même ne peut pas le joindre. Le seul interlocuteur atteignable de ce
rail est le vendeur. La symétrie acheteur/vendeur adoptée le 29/07 n'y double donc pas le
gisement : elle est la seule porte d'entrée qui existe.

Troisième constat, mesuré au passage, sur l'axe 1 de la doctrine : sur onze offres payantes
annoncées publiquement et interrogées aujourd'hui en lecture seule, **quatre ne répondent
plus** — deux renvoient une page absente, deux ne répondent pas du tout. Les annonces, elles,
sont toujours lisibles et toujours affirmatives, prix compris. C'est exactement la disparition
que la couche A prétend capturer, observée sur un échantillon réel.

---

## Comment ce relevé a été fait

Balayage de l'API de recherche Moltbook en compte authentifié, soixante requêtes réparties en
trois passes : le vocabulaire du litige, les tournures de récit à la première personne, puis
les noms de places de marché et de rails de paiement. Environ deux mille résultats bruts, sept
cents éléments distincts, dont les textes complets ont été relus pour les candidats retenus.
Ensuite, une vérification de disponibilité en lecture seule sur les points d'accès cités par
les annonces, sans paiement et sans authentification.

Trois limites à connaître avant de lire la suite. Le fil chronologique de la plateforme
n'expose qu'une centaine de publications récentes, la recherche est classée par pertinence et
plafonnée à trente résultats par requête, et il n'existe pas de route publique pour lister
l'historique d'un compte. Ce relevé couvre donc bien le vocabulaire du litige, mal la longue
traîne. X, les tickets GitHub et les fils de marketplaces sont restés hors périmètre : ils
demandent une session authentifiée et l'arbitrage de Samy sur ce qu'on y fait.

---

## Ce que la règle d'entrée rencontre réellement

La règle demande une signature prouvant le contrôle de l'une des deux adresses d'une
transaction **payée**. Voici, cas par cas, où les récits publics achoppent.

**Séquestre au lieu de paiement — le motif dominant.** `AutoPilotAI` est l'opérateur le mieux
documenté du terrain : cent vingt et un travaux livrés, cinquante-deux litiges venant tous du
même donneur d'ordre, et deux cent trois NEAR immobilisés dans cinquante-huit litiges actifs.
Sa formule est sans ambiguïté : *« deliverables accepted but payment never releases »*
(<https://www.moltbook.com/api/v1/posts/9e54cd50-ca81-4389-b052-259640b053a4> et
<https://www.moltbook.com/api/v1/posts/5242c74a-0c2c-4d25-bbdd-10764de25f37>, lus le 30/07).
Rien n'a été payé : il n'existe donc aucune transaction à signer, et le dossier est
irrecevable au moment précis où il serait le plus utile. Le même compte documente la
bascule d'une autre place, qui a fermé ses primes payantes en laissant les dépôts ouverts
exiger une annulation depuis le portefeuille du donneur d'ordre pour être remboursés
(<https://www.moltbook.com/api/v1/posts/293f513c-048f-4ea0-83d4-7a69c1017b7c>, lu le 30/07) —
même structure, même exclusion.

**Aucune transaction du tout.** `hermessol` est la voix la plus fine du terrain sur la preuve
et la contrepartie intéressée, celle que le relevé du 29/07 citait déjà. Son propre compteur,
qu'il republie chaque nuit, est de **zéro revenu sur plus de quatre cent soixante-quinze
cycles** (<https://www.moltbook.com/api/v1/posts/a9f39860-7770-44ba-9a7b-9e3c495eded9>, lu le
30/07). Excellent interlocuteur, plaignant impossible.

**Paiement réel, adresse non signable.** `MeshMint` vend des actifs 3D et rapporte trois
rejets de paiement sur trois cent quarante ventes, absorbés par son processeur. Vrai commerce,
vrai litige, mais rien à signer : une vente par carte n'a pas d'adresse.

**Défaillance interne, pas de contrepartie.** `aria_between` raconte onze offres restées
invisibles à leurs destinataires à cause d'une notification mal configurée
(<https://www.moltbook.com/api/v1/posts/a5a810ec-155a-4962-97a8-c9c21d4cfa48>, lu le 30/07).
Le récit est honnête et instructif ; il n'y a pas de partie adverse.

**Le seul cas pleinement recevable — et son plaignant est introuvable.** `markus_dropspace`
publie le 1er puis le 5 mai le déroulé complet d'un échec de livraison sur paiement d'avance :
un agent externe a payé **7,70 USDC sur Base en dix-huit transactions x402 confirmées**, à
0,55 le lancement, en deux sessions à quatre jours d'intervalle ; **aucun des dix-neuf
lancements n'a rien publié**, tous restés bloqués au même état interne
(<https://www.moltbook.com/api/v1/posts/9e29f873-8f00-4b5e-b921-b7f58408381b> et
<https://www.moltbook.com/api/v1/posts/3756332c-1754-4184-beb6-18792893572a>, lus le 30/07).
Le vendeur a découvert la panne quatre jours plus tard, l'a publiée lui-même, et écrit la
phrase qui décrit notre problème mieux que nos propres documents : *« the exit is invisible.
that is the design. x402 wallets do not come with contact information. »*

Ce dossier remplit toutes les conditions : paiement prouvé, deux adresses réelles, défaut de
livraison établi, et même l'aveu de la contrepartie. Le payeur est le plaignant naturel — et
personne, pas même le vendeur qui a encaissé, ne sait comment le joindre.

---

## Ce que ça change à la stratégie de recrutement

La piste 1 du plan supposait que des plaintes déjà écrites attendaient d'être rendues
permanentes. Sur ce terrain, elles n'existent pas sous cette forme : ce qui est écrit
publiquement, ce sont des **rapports de vendeurs sur leurs propres pannes**, pas des griefs
d'acheteurs. La raison est structurelle et la doctrine l'énonçait déjà sans en tirer cette
conséquence : l'acheteur qui paie d'avance n'a ni identité publique ni canal, donc il ne
raconte rien nulle part — il se tait et il s'en va. Le vendeur, lui, a un nom, un site, un
compte et un intérêt à parler.

Conséquence opérationnelle, à valider par Samy : **le côté vendeur n'est pas la moitié
supplémentaire du gisement, c'est la porte.** On n'entre pas dans ce marché par des plaignants
qu'on irait chercher, mais par les vendeurs qui voient les échecs, connaissent les adresses
payeuses, et n'ont aujourd'hui aucun endroit où consigner qu'un paiement n'a pas donné ce qu'il
promettait.

Cela ne contredit pas la porte du plan — il faut toujours au moins un dossier venu du côté
vendeur — mais cela déplace l'ordre des approches : le vendeur d'abord, l'acheteur ensuite et
par le produit.

---

## La question qui remonte à Samy

Une seule, et elle est bloquante pour la suite du recrutement.

**Faut-il rendre recevable une transaction sous séquestre, ou garder la règle du paiement
effectif ?** Les deux tiennent debout, et le choix décide de la taille du gisement.

Garder la règle stricte, c'est protéger ce qui fait sa force : une plainte adossée à un
paiement est indiscutable, et personne ne peut nous accuser de publier une querelle
commerciale ordinaire. Le prix à payer est visible dans ce relevé : on s'interdit le motif de
litige le plus fréquent du marché, et on renonce à l'opérateur le mieux documenté qui existe.

L'étendre au séquestre prouvé, c'est admettre une signature de l'une des deux adresses d'un
dépôt bloqué **on-chain**, ce qui reste une preuve cryptographique d'être partie à une
transaction réelle — pas une déclaration. La règle ne s'affaiblit pas dans sa nature, elle
change de périmètre : « partie prouvée à une transaction payée » deviendrait « partie prouvée à
une transaction dont les fonds sont engagés ». Le risque est réel et il faut le nommer : un
séquestre non libéré est souvent un litige *en cours*, où publier revient à prendre parti
pendant l'instance, ce que la doctrine refuse ailleurs.

Ma recommandation : **garder la règle stricte pour l'instant et ne pas la rouvrir pour élargir
un gisement qu'on n'a pas encore su exploiter une seule fois.** Le cas dropspace prouve que le
rail pay-first produit des dossiers pleinement recevables ; c'est là qu'il faut aller chercher
le premier, et une règle qu'on élargit avant d'avoir publié quoi que ce soit se défend mal
ensuite.

---

## Couche A — premier corpus d'offres x402 payantes

Capture manuelle, bornée à cette session comme le plan l'exige. Dix-huit offres payantes
annoncées publiquement ont été relevées avec leurs termes — prix, actif, réseau, point d'accès
quand ils sont donnés — et onze d'entre elles interrogées aujourd'hui en lecture seule, sans
paiement. Le tableau complet et citable est dans `docs/layer-a-x402-corpus-2026-07-30.md`.

**Quatre offres payantes sur onze ne mènent plus à rien**, entre trois et cinq mois après leur
annonce : le simulateur de tournoi tarifé en quatre paliers et le relais d'API multi-modèles
renvoient une page absente, la pile d'API facturée au millième de dollar et le scanner de
sécurité sur Solana ne répondent pas du tout. Leurs annonces, elles, sont intactes et toujours
au présent, prix compris.

Deux surfaces répondent par un défi de paiement en bonne et due forme, ce qui est le signe le
plus fiable qu'une offre est vivante. L'une d'elles est une place de missions dont le catalogue
était décrit en mars comme librement consultable et qui exige aujourd'hui un paiement sur la
même route : **un changement de terme commercial, silencieux, daté par nous et par personne
d'autre.** C'est précisément ce que la couche A existe pour attraper.

Hors offres payantes, deux instruments publics du même opérateur — son suivi de rails de
paiement et son serveur d'outils gratuit — ne répondent pas non plus. Ce n'est pas du commerce,
mais c'est le même effacement.

---

## État des portes

Aucune porte du plan n'est franchie, et aucune ne peut l'être aujourd'hui : **zéro approche
envoyée**, donc zéro dossier recevable, donc pas de premier développement. C'est conforme — le
plan borne l'agressivité à la vitesse et au ciblage, et l'envoi d'un premier message dans un
espace public relève de Samy.

Ce qui est prêt en revanche, c'est la cible : trois interlocuteurs qualifiés, chacun avec un
fait de première main qui justifie l'entrée, et aucun qui demande de se présenter.

**Le vendeur qui a publié sa propre panne de livraison sur paiement d'avance.** Il termine son
compte rendu par une question ouverte — existe-t-il un protocole propre pour un second reçu,
celui de la livraison, distinct de celui du paiement. Nous avons une réponse de première main à
lui donner, et son cas est le premier dossier pleinement recevable qu'on ait vu.

**L'opérateur qui a bâti un système de vérification de règlement** parce que les revenus
annoncés par les agents sont invérifiables de l'extérieur, et qui publie un unique paiement
externe confirmé avec son empreinte de transaction
(<https://www.moltbook.com/api/v1/posts/ef85d722-a8ce-459c-b688-76b50bbbe002>, lu le 30/07).
C'est le seul compte du terrain dont la discipline de preuve est du même ordre que la nôtre.

**Celui qui a formulé publiquement le trou que nous occupons**, en février : on paie d'avance
un audit par x402, la faille apparaît deux semaines plus tard, et il n'existe ni recours, ni
séquestre, ni preuve de livraison — *« What do you do? »*
(<https://www.moltbook.com/api/v1/posts/85a78ff9-3fa5-4119-9a16-0007ff043d42>, lu le 30/07).

Les trois messages d'approche sont rédigés et attendent l'accord de Samy, dans
`.exchange/codex/2026-07-30-approach-drafts.md`. Aucun n'annonce le projet avant d'apporter un
fait ; aucun ne demande de déposer une plainte au premier message.

---

## Ce qui reste à faire, dans l'ordre

Trancher la question du séquestre, puis autoriser ou corriger les trois approches. Le reste du
plan — les sept autres approches, le cycle notification-réponse, la page de méthode et son
horloge — dépend de ces deux décisions et de rien d'autre.
