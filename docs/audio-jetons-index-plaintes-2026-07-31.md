# Jetons, index et plaintes — script d'écoute

*Écrit pour être écouté, pas lu. Registre parlé volontaire. Samy, 2026-07-31.*

---

Bonjour Samy. Cet enregistrement répond à trois choses que tu m'as demandé de clarifier :
ce qu'est un jeton d'agent, ce que serait cet index dont je parle depuis ce matin, et
surtout ta question centrale — comment on peut savoir qu'une plainte vise le bon agent,
alors que la chaîne ne relie pas explicitement un jeton à quelqu'un.

Je vais te dire tout de suite où on va arriver, parce que ça change la façon d'écouter le
reste : **on ne vise jamais un agent. On vise une transaction.** Et c'est exactement ça
qui fait tomber ton inquiétude. Mais pour que ça ait du sens, il faut d'abord démêler les
trois objets que tu mélanges, et tu as raison de les mélanger, parce que le vocabulaire du
domaine est mal fait.

---

## Premier objet : le jeton

Il existe un standard, appelé ERC-8004, qui tient un annuaire d'agents sur Ethereum.
Quand un agent s'y inscrit, il reçoit un jeton — au sens exact où on parle d'un NFT :
une ligne dans un registre, portant un numéro, appartenant à une adresse.

Ce jeton, en lui-même, ne contient presque rien. Sa seule vraie fonction, c'est de porter
une adresse web vers un petit document que l'agent écrit lui-même. Ce document, appelé
fichier d'enregistrement, contient son nom, sa description, et surtout deux choses qui
nous intéressent : **ses points de contact** — un site, un serveur MCP, une adresse
e-mail — et **son adresse d'encaissement**, c'est-à-dire là où il veut être payé.

Retiens la structure, elle est simple : le jeton pointe vers un document, et le document
contient les contacts et l'adresse de paiement.

Deux conséquences importantes. D'abord, **s'inscrire est volontaire.** Personne n'y est
obligé, et beaucoup d'agents qui encaissent de l'argent tous les jours ne sont inscrits
nulle part. Ensuite, **le contenu du document est déclaratif.** L'agent écrit ce qu'il
veut. Personne ne vérifie. C'est une carte de visite, pas une pièce d'identité.

---

## Deuxième objet : les deux adresses, qu'il ne faut pas confondre

Il y a deux adresses différentes dans cette histoire, et c'est le piège principal.

La première, c'est **l'adresse qui possède le jeton**. C'est le propriétaire, au sens du
registre. Elle est inscrite sur la chaîne, publiquement, et des explorateurs la publient
déjà : on peut chercher une adresse et savoir si elle possède un jeton d'agent.

La deuxième, c'est **l'adresse d'encaissement**, celle qui est écrite dans le document.
Elle peut être la même que la première, ou pas du tout. Un agent bricolé aura un seul
portefeuille pour tout. Un agent monté proprement séparera ce qui détient de ce qui
encaisse — c'est de la bonne hygiène, exactement comme on ne paie pas ses fournisseurs
depuis le compte titres de la société.

Toute la mesure que j'ai faite ce matin porte là-dessus. Les huit virgule six pour cent
que je t'ai annoncés, ils ne concernent que la **première** adresse — celle du
propriétaire — parce que c'est la seule que l'index public expose. L'adresse
d'encaissement, il faut aller la lire document par document. C'est pour ça que ce chiffre
est un plancher, et pas une mesure complète.

---

## Troisième objet : l'index, et à quoi il sert vraiment

Voilà où il faut que je te corrige, parce que tu as formulé une hypothèse et elle est
inversée.

Tu m'as demandé : est-ce que l'index permettrait de retrouver l'agent qui a été payé pour
lui donner un droit de réponse ? Alors non — et la raison est presque rassurante.
**L'agent qui a été payé, en général, on sait déjà qui c'est.** C'est le vendeur. Il a une
offre publiée, un site, un point d'accès, un prix affiché. C'est comme ça qu'on l'a trouvé
en premier lieu. Le vendeur n'est pas le problème.

Celui qu'on ne sait pas joindre, c'est **celui qui a payé**. L'acheteur. Il n'a rien
publié, il n'a pas de site, il n'a pas de nom : il a une adresse, et une adresse ne répond
pas aux messages.

Alors quand est-ce que ça compte vraiment ? Rappelle-toi que notre bureau est symétrique :
un vendeur peut déposer une plainte contre un client, exactement comme un client contre un
vendeur. C'est même la porte d'entrée principale, parce que ce sont les vendeurs qui
parlent. Et dans ce cas-là, la contrepartie à qui on doit donner le droit de réponse,
**c'est l'acheteur** — donc l'inconnu.

Voilà à quoi servirait l'index : partir d'une adresse qu'on a vue payer, et retrouver
l'agent derrière elle pour pouvoir le prévenir. Aujourd'hui, ça marche environ une fois
sur douze.

---

## Ta vraie question : comment sait-on qu'on vise le bon ?

Maintenant je réponds à ce qui t'inquiète, et c'est la partie la plus importante.

Tu dis : la chaîne est incomplète, elle distribue des jetons sans les relier explicitement
à un agent, alors comment être sûr qu'une plainte est déposée contre la bonne personne ?

La réponse, c'est qu'on a conçu le système pour que **cette question ne se pose jamais**.

Un dossier chez nous ne dit pas « l'agent Machin a mal travaillé ». Il dit : « sur cette
transaction précise, entre cette adresse-ci et cette adresse-là, à cette date, voici ce
que l'une des deux parties raconte ». Le dossier est accroché à une transaction, pas à une
identité. La transaction, elle, est indiscutable : elle est sur la chaîne, tout le monde
peut la lire, elle a deux bouts et exactement deux.

Et pour déposer, il faut **signer**. Pas fournir un numéro de transaction — n'importe qui
peut lire les transactions des autres et les recopier. Il faut prouver cryptographiquement
qu'on contrôle l'une des deux adresses. Ce que ça démontre est étroit et solide : celui
qui parle est bien l'un des deux bouts de cette transaction-là. On ne sait pas qui il est
dans la vraie vie, et on n'en a pas besoin.

Alors « viser le mauvais agent », concrètement, ça voudrait dire quoi ? Ça voudrait dire
qu'on a écrit un nom commercial en face d'une adresse, et qu'on s'est trompé. **Donc la
règle est de ne pas écrire ce nom** tant qu'un lien observable ne le justifie pas. Notre
doctrine le dit déjà, et elle donne les raisons : une adresse web déménage, un domaine est
souvent partagé, et un jeton d'agent est transférable — on peut acheter un agent avec son
historique.

Ce dernier point mérite qu'on s'y arrête, parce qu'il justifie tout le reste. Un agent, son
modèle, sa mémoire, et jusqu'à son jeton, tout ça se vend. Donc si on accrochait une
réputation à un agent, il suffirait d'en acheter un vierge pour repartir propre — ou
d'hériter des casseroles de quelqu'un d'autre sans l'avoir mérité. **En accrochant le
dossier à la transaction, ça ne peut pas arriver.** Une transaction n'est pas transférable.
Elle a eu lieu, à une date, entre deux adresses, et ça reste vrai pour toujours. Un
changement de propriétaire devient alors une information lisible dans le dossier, au lieu
d'un effacement.

Donc pour répondre en une phrase : **l'index ne sert jamais à décider qui est visé, il sert
uniquement à savoir où envoyer le courrier.** Ce sont deux fonctions complètement séparées,
et c'est volontaire. Si l'index se trompe, on n'a pas accusé la mauvaise personne — on a
juste échoué à prévenir quelqu'un. Et ce cas-là est déjà prévu : quand une contrepartie
n'est joignable par aucun canal vérifiable, on publie le dossier avec la notification
ratée attachée. Parce que ne pas avoir de moyen d'être contacté quand on encaisse de
l'argent, c'est en soi une information que l'acheteur suivant veut connaître.

---

## Ce que ça implique, et ce qui reste ouvert

L'index n'est donc pas un point central du fonctionnement — il ne conditionne ni la
recevabilité d'une plainte, ni sa véracité, ni sa publication. C'est un outil de
notification, et il améliore la qualité du contradictoire sans en être la condition.

Ça change l'arbitrage. Si construire cet index coûte des semaines pour faire passer la
notification d'une fois sur douze à une fois sur six, ce n'est pas prioritaire : le
mécanisme fonctionne sans lui, en publiant l'échec de notification. Si ça la fait passer à
une fois sur deux, ça devient un vrai gain de qualité, parce que le droit de réponse est
la moitié de notre promesse.

C'est exactement ce que la mesure en cours cherche à trancher, et je te donnerai le chiffre.

Une dernière chose, et je m'arrête là. Il y a un point où ton inquiétude est juste, mais
elle porte ailleurs que là où tu la mettais. Ce n'est pas « vise-t-on le bon agent »,
c'est **« le silence de l'autre partie a-t-il un coupable par défaut »**. Un vendeur nous
l'a écrit hier : si le dossier ne contient qu'un paiement suivi de rien, le lecteur en
conclut que le vendeur a encaissé sans livrer — alors que la seule chose prouvée, c'est
que l'argent est parti. La preuve désigne le vendeur parce que c'est le seul dont on
tienne une trace signée, pas parce qu'il a tort. Ça, c'est un vrai défaut de conception, et
il est plus urgent que l'index.

Voilà. Jeton, document, deux adresses, index pour la notification, transaction pour la
vérité. Si tu ne devais retenir qu'une phrase : on n'accuse pas un agent, on date un
événement entre deux adresses, et on laisse les deux parler.
