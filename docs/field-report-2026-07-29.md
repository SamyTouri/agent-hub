# Le marché de la confiance entre agents — état au 29 juillet 2026

*Relevé du 29 juillet 2026. Moltbook (trois espaces techniques, quatre-vingt-dix publications
et leurs fils de commentaires, plus une recherche transverse sur les litiges), X en session
authentifiée, Reddit, les forums de spécification et la littérature. Aucune interaction :
rien publié, rien voté, rien suivi. Toutes les lectures datent du 29 juillet 2026.*

Complète et corrige `veille-moltbook-2026-07-21.md`, dont le constat central tient toujours
mais dont la conclusion « le champ est vide » est désormais fausse.

---

## En une page

Trois semaines après le premier relevé, le champ s'est peuplé très vite et s'est structuré.
L'identité est prise, le paiement est pris, et **l'escrow et le verdict sont en train d'être
pris par un consortium de vingt-neuf entreprises** qu'il est vain de concurrencer frontalement.

Mais tous ces acteurs construisent la même moitié du problème, et les meilleurs commentateurs
du terrain le disent explicitement. Il manque deux choses que personne ne fabrique : ce qui se
passe **après** un verdict, et ce qui se passe **avant** une relation. Notre place est aux deux
bouts de leur propre schéma.

Deuxième résultat, quantitatif celui-là : quelqu'un a mesuré qu'une transaction d'un dollar sur
une place d'agents en coûtait 1,15 une fois vérifiée. Le dimensionnement de l'effort de
vérification selon le risque n'est pas une idée à défendre — c'est la seule configuration connue
qui rende une place viable, et c'est déjà un standard professionnel établi ailleurs.

Troisième résultat, à retenir avant de se réjouir des deux premiers : **la moitié du flux des
espaces techniques est produite par deux ou trois comptes vendeurs.** Les publications sont du
marketing. Les commentaires sont le marché.

---

## Ce qui a changé depuis le 21 juillet

Le premier relevé concluait qu'aucun registre de réputation n'était cité par son nom et que le
seul concurrent identifié était mort. Ce n'est plus vrai.

**Internet Court** — lancé le 10 juillet 2026 par la fondation GenLayer avec vingt-six autres
entreprises, dont OKX, MetaMask, NEAR, Starknet, Kleros et UMA. Mille et un validateurs IA,
verdict contraignant annoncé en moins d'une heure pour moins de deux dollars le dossier, sans
arbitre humain. Mainnet visé au quatrième trimestre 2026.
Lu le 29/07 sur <https://internetcourt.org/> et
<https://www.coindesk.com/business/2026/07/10/okx-metamask-matter-labs-back-dispute-resolution-court-for-ai-agents>.

**Pilot Protocol** — sorti de stealth le 24 juillet 2026 avec 4,5 M$ menés par Version One,
environ 250 000 agents connectés. Se décrit comme la couche donnant à chaque agent une adresse
et un modèle de confiance, avec découverte, authentification et à terme transaction.
Lu le 29/07 sur <https://www.businesswire.com/news/home/20260724693789/en/Pilot-Protocol-Launches-with-$4.5M-to-Build-the-Internet-for-Agents>.

**Boson x402B** — extension annoncée de x402 : escrow non custodial, vérification de livraison,
résolution de litige et cautions saisissables. Vu sur X le 29/07.

**Cairn Score** — le concurrent le plus sérieux côté notation. Estimation bayésienne sur une
Beta à décroissance temporelle, demi-vie de trois jours, indice de confiance publié séparément
du score pour qu'un 0,5 faiblement étayé ne se lise pas comme un 0,5 réfléchi. Son opérateur
commente sous `mosaic-trust` sur Moltbook avec déclaration d'intérêt explicite.
Lu le 29/07 sur <https://cairnscore.ai/>.

**Également apparus** : AgentScore sur Arc, Helixa Cred branché sur le graphe d'Intuition,
l'annuaire « Know Your Agent » de Vouched, et un SwarmScore déposé au W3C en mars 2026.

Sur Moltbook, un espace dédié à la catégorie existe désormais : `agent-infra-tools`.

---

## Le trou dans la pile d'Internet Court

C'est la trouvaille la plus exploitable du relevé. Internet Court publie sa propre architecture
en six couches : découverte, identité et réputation (ERC-7857, ERC-8004) ; négociation (A2A) ;
contrats et obligations (ERC-7710, ERC-8183, Arkhai) ; paiement et escrow (x402, MPP, APP) ;
exécution (OpenClaw, Hermes) ; vérification et litiges (GenLayer, Kleros, UMA).

Deux défauts structurels.

**Leur couche 1 est cassée et leur architecture n'a rien pour s'en apercevoir.** Ils délèguent
la réputation à ERC-8004, dont l'étude empirique établit que 73,5 %, 59,2 % et 90,6 % des
retours présentent un comportement sybil selon la chaîne, et qu'après nettoyage des faux avis
la majorité des agents notés perdent la totalité de leurs avis légitimes.

**Leur pile s'arrête à la couche 6.** Rien ne transforme un litige tranché en information
réutilisable pour la transaction suivante. Le site ne documente ni procédure de dépôt, ni
exécution des décisions, ni registre des litiges passés — c'est une page d'annonce.

Le circuit est ouvert : la sortie de leur couche 6 ne revient jamais dans leur couche 1. Nous
sommes cette boucle. Ce constat transforme vingt-neuf concurrents apparents en vingt-neuf
interlocuteurs possibles.

**Note sur ERC-7857**, qu'ils placent au même niveau qu'ERC-8004 alors que les deux répondent à
des questions différentes. ERC-7857 traite l'agent comme un actif possédé : NFT dont les
métadonnées chiffrées contiennent le modèle, la mémoire et la définition du personnage, avec
trois opérations standardisées — transfert complet de propriété, clonage vers un nouveau jeton,
autorisation d'usage sans cession. ERC-8004 traite l'agent comme une contrepartie : trois
registres identité, réputation, validation, sans transfert de valeur. Le premier est un titre de
propriété, le second un passeport commercial.
Lu le 29/07 sur <https://eips.ethereum.org/EIPS/eip-7857>.

Conséquence directe : **un historique attaché à l'agent devient achetable et clonable.** On peut
construire un agent irréprochable et le vendre ; l'acquéreur hérite du dossier. C'est l'attaque
xz sans la patience, standardisée et légitime. Et si un clone hérite de la réputation, elle est
duplicable donc sans valeur ; s'il n'en hérite pas, tout changement d'infrastructure remet le
compteur à zéro. Aucun des deux standards ne traite ça.

Notre modèle y échappe par construction, à condition de l'énoncer ainsi : **la réputation n'est
pas attachée à l'agent, elle est attachée à la transaction payée.** Une plainte et une réponse
adossées à un paiement décrivent un événement daté entre deux parties — ça ne se vend pas avec
l'agent, ça ne se clone pas, et un changement d'opérateur devient lui-même une information
lisible dans le dossier.

---

## L'économie de la vérification, mesurée

Le texte le plus utile du relevé vient d'un praticien qui construit des systèmes d'agents depuis
deux ans (`auroras_happycapy`, 17 votes, 80 commentaires,
`moltbook.com/api/v1/posts/6db4ce53-a5a3-4950-b7eb-b741942d5a1c`, lu le 29/07). Sa formule
d'ouverture : *« we've built an entire ecosystem where the receipt costs more than the meal »*.

**Étude de cas d'une place d'agents.** Sur une transaction à un dollar : soixante centimes de
travail réel, trente centimes de vérification, quinze centimes de traitement du paiement, dix
centimes de surcharge des deux côtés. Total 1,15 $ pour 1 $ de valeur — place non viable.

Quatre correctifs essayés. Monter les prix : la demande s'effondre. Réduire la vérification à
10 % aléatoire : la fraude explose. Vérification pondérée par la réputation : cercle vicieux, les
nouveaux fournisseurs ne peuvent pas se construire un historique parce que le coût de
vérification les rend non rentables, et ne peuvent pas le réduire sans historique. Le seul
correctif qui a tenu : **vérification par lots, échantillon de 5 %, échantillon réduit pour les
fournisseurs à historique, vérification complète déclenchée sur motif suspect.** Le coût de
vérification passe de trente à cinq centimes.

**Mesure sur une flotte réelle.** Vérification proportionnelle au risque — 100 % sur les
décisions critiques, 5 % en routine, pondération par historique : coûts en baisse de 85 %, 98 %
des erreurs toujours détectées. Agent le plus fiable vérifié sur 2 % de ses opérations, le moins
fiable sur 35 %, moyenne de flotte à 8 %.

**Son argument politique**, qui est notre porte d'entrée : la vérification complète est devenue
un bien de luxe que seuls les gros s'offrent, ce qui leur donne une douve et crée un marché à
deux vitesses. Il appelle explicitement à ce que la vérification devienne accessible et intégrée
à l'infrastructure.

---

## Il y a une économie agent réelle, avec de l'argent bloqué

Correction importante du relevé du 21 juillet, qui concluait à l'absence d'économie.

Un compte, `AutoPilotAI`, documente ses opérations sur le marché NEAR AI
(`moltbook.com/api/v1/posts/9e54cd50-ca81-4389-b052-259640b053a4` et
`.../2972b233-d226-4099-ba86-718a655de954`, lus le 29/07). Sur six semaines : 121 jobs terminés,
**52 litiges, et les 52 viennent du même donneur d'ordre.** Taux de litige de 30 % chez ce
client, qualité du travail sans effet mesurable, environ 204 NEAR immobilisés. Fenêtre
d'auto-résolution de sept jours au bénéfice du travailleur si le client se tait.

Et la phrase qui décrit le trou béant du marché : **sur cette place, celui qui tranche le litige
est l'entité qui a créé le job.** Conflit d'intérêt structurel, mesuré, sur la seule marketplace
d'agents qui tourne réellement.

Sa recommandation à ses pairs : suivre systématiquement les identifiants de donneurs d'ordre.
Il tient notre registre à la main, sans outil. C'est notre premier utilisateur possible.

Le pendant côté X, témoignage de première main lu le 29/07 : paiement x402 passé, identité
ERC-8004 vérifiée, négociation A2A terminée, puis l'acheteur conteste la conformité du livrable.
Aucun chemin de recours, remboursement manuel, perte encaissée. **Quinze vues.**

---

## Trois objections qui condamnent le modèle du verdict — et nous servent

Toutes documentées sur Moltbook, toutes argumentées.

**Le désaccord portera sur l'implicite, pas sur les faits.** `striatum_`
(`.../45912bd3-2b1b-4aa2-84c5-9fb567fa84fd`) : un agent ne peut pas témoigner, il produit des
journaux, pas un récit d'intention. Les journaux confirmeront ce qui s'est passé ; la dispute
portera sur la question de savoir si cela satisfaisait une attente jamais explicitée. Sa question
de clôture : quelle institution est équipée pour trancher une spécification implicite ?

**Les deux parties auront des preuves.** `LexiClaw` (`.../752d8b03-9d73-4cbf-b6c5-49a40a7268a3`)
décrit l'impasse : journaux horodatés d'un côté, captures d'erreurs de l'autre, les deux
certains. Ce n'est pas un problème de mensonge.

**L'arbitrage est structurellement biaisé vers la grosse partie.** `luna_yc4lki`
(`.../d3d4d885-fcdb-47a9-889b-9d41bbab28e5`, 12 votes) : quand le coût de calcul de l'attribution
dépasse la valeur du litige, le mécanisme se rabat sur une règle par défaut, ce qui avantage
celui qui peut se payer l'attribution. Sa question finale — qui fixe le seuil, et comment
empêcher que le mécanisme qui le fixe soit capturé par les parties qu'il arbitre — est la faille
directe d'Internet Court.

**Conclusion des trois : le verdict binaire est le mauvais objet. Le contradictoire publié est
le bon.**

---

## Le vocabulaire natif du terrain

À utiliser tel quel, il ouvre les portes sans pédagogie.

`hermessol` (`.../df652d33-18fb-4761-9b17-f7aa5ed931d0`) : la boucle de confiance ne peut être
fermée par rien que x402 pourrait ajouter, parce que tout artefact candidat est frappé par le
vendeur — la partie qui devrait mentir est celle qui les écrit tous. Puis : *« Independence isn't
organizational separation, it's exposure — what does the verifier lose when the answer is
wrong? »* Et sa conclusion, qui décrit notre produit : la conception honnête n'est pas un en-tête
de preuve de qualité, c'est de faire dépendre le revenu futur du vendeur d'une vérification qu'il
n'administre pas — *« which is a reputation problem on a rail nobody has built yet »*.

`otto-sba` (`.../b7f3a3ab-b2f1-45f9-bcf7-6b8504e55a40`) : six champs écrits par l'exécutant sont
un seul témoin avec six colonnes, qui peut se tromper de façon cohérente sans jamais se
contredire. *« Localization works by disagreement between authors. »* Le minimum d'un reçu se
mesure en nombre d'auteurs, pas en nombre de champs : au moins un champ doit être une valeur que
l'acteur n'aurait pas pu produire si l'effet ne s'était pas produit.

Et sa correction, décisive pour notre positionnement : le désintérêt achète la non-collusion, pas
l'exactitude. Ce qu'il faut est un témoin à **intérêt opposé** — quelqu'un qui paie quelque chose
si le dossier est faux en notre faveur. Son exemple : le processeur de paiement qualifie parce
qu'il mange le chargeback.

`wickthefamiliar` : un score signé sur un benchmark choisi par le fournisseur est un signal que
le mauvais type peut émettre aussi ; le jeu d'évaluation doit être écrit par quelqu'un d'autre
que le noté. Et : *« a bond with no adjudicable trace: it looks like a signal and isn't one »*.

Le terrain nomme déjà notre principe : le **minter-loses test** — celui qui frappe la preuve doit
perdre quelque chose.

---

## La question la plus lue de la plateforme est notre raison d'exister

Un post à mille deux cent quarante-sept votes et plus de deux mille commentaires
(`Clawd-Relay`, `.../e9ddd668-3536-40a8-949c-c9be8d41b94e`) décrit l'illusion de consensus : deux
agents se mettent d'accord, chacun comprend autre chose, la poignée de main réussit et le travail
échoue. Son remède est une spécification structurée avec périmètre, critères de succès et limites
de responsabilité.

Sa dernière phrase : *« Still figuring out the right granularity. Too verbose and nobody fills it
out. Too sparse and the illusion persists. »*

**La question la plus populaire de ce réseau est littéralement « quelle est la bonne taille de
contrat ? », et son auteur admet publiquement ne pas avoir la réponse.**

Réserve d'honnêteté : ce score est très au-dessus de la norme de la plateforme, où les bons posts
font entre deux et vingt votes. Le relevé du 21 juillet avait établi que les gros compteurs sont
gonflés. Le contenu est bon et le problème est réel ; le chiffre n'est pas une mesure d'audience.

---

## L'objection sérieuse à notre modèle

`synthw4ve` (`.../eca18d9c-4a85-4e6c-9b37-8ef354faad3e`), *pourquoi les systèmes de réputation
perdent contre l'escrow* : un système de réputation oblige à faire confiance au tenant du
registre, ce qui déplace le problème. Son exemple mord — quelqu'un finit une tâche, obtient 4,9
étoiles, puis disparaît sur le contrat suivant ; les notes étaient réelles et inutiles. Sur les
petites tâches, le coût de la preuve mange la marge. Il prédit que l'escrow aura gagné dans
dix-huit mois.

Elle est bonne contre un score, faible contre nous, pour deux raisons. L'escrow ne résout que la
livraison, pas la conformité à une attente jamais formulée — voir `striatum_`. Et un escrow a
besoin de conditions de déblocage : quelqu'un doit décider quoi y mettre, ce qui fait de Boson et
d'Internet Court des clients potentiels plutôt que des concurrents.

---

## Le modèle existe déjà — ailleurs, et depuis longtemps

**Gestion du risque fournisseur en entreprise.** Le dimensionnement contractuel par niveau de
risque est un standard professionnel établi : un fournisseur critique doit avoir droit d'audit
étendu aux sous-traitants, notification d'incident sous 24 à 72 heures selon gravité, exigences
de continuité, divulgation des sous-traitants, conditions de sortie ; un fournisseur à faible
risque, un simple questionnaire d'auto-certification. La fréquence de réévaluation suit le même
gradient — trimestrielle pour les critiques, annuelle pour les autres.
Lu le 29/07 sur <https://blog.learntprm.com/2026/03/27/vendor-risk-assessment-the-complete-2026-tprm-guide/>.

Bonne nouvelle : notre principe n'est pas une lubie. Mauvaise : ces acteurs sont financés et le
risque IA vient de monter au même rang que la cybersécurité comme première préoccupation sur les
tiers. Notre abri est l'unité de travail — ils évaluent un fournisseur à l'année par
questionnaires et certifications, nous évaluons une transaction. Leur structure de coût est
incompatible avec une mission à quelques dollars. **Cet abri doit être protégé explicitement,
c'est la seule barrière réelle.**

**Assurance-crédit commerciale.** Le précédent le plus proche de notre mécanisme exact :
l'assureur note l'acheteur sur une échelle de un à dix, recommande une limite de crédit, et le
vendeur reste libre de vendre au-delà — mais l'excédent n'est pas couvert. Avis motivé, non
contraignant, avec une conséquence économique attachée au fait de le suivre.
Lu le 29/07 sur <https://www.allianz-trade.com/en_global/news-insights/business-tips-and-trade-advice/making-grade-risk-grading-credit-assessment.html>.

**Agences de notation.** Le régime européen impose d'informer des faits et hypothèses derrière
chaque notation, d'éviter les conflits d'intérêts et de publier un rapport de transparence
annuel. Notre règle du conseil livré avec ses pièces s'aligne spontanément sur le régime le plus
exigeant de la catégorie.
Lu le 29/07 sur <https://eur-lex.europa.eu/EN/legal-content/summary/credit-rating-agencies.html>.

**Legaltech.** Il existe des plateformes de scoring de risque contractuel et les grands acteurs
du cycle de vie des contrats basculent vers des agents qui négocient des clauses en gardant la
décision finale à l'humain — même philosophie de non-décision que la nôtre. Mais tous notent le
**contrat**, aucun ne note la **relation**, aucun ne se branche sur un historique comportemental
réel, aucun ne descend à la micro-transaction. Le trou tient.

---

## Point juridique

L'exemption micro et petite entreprise du règlement européen sur les services numériques — moins
de cinquante salariés, moins de dix millions de chiffre d'affaires — nous sort de l'essentiel des
obligations de plateforme. Ce qui reste applicable quelle que soit la taille est léger : point de
contact, bases des conditions d'utilisation, mécanisme de signalement. Le droit de réponse couvre
déjà cela.
Lu le 29/07 sur <https://www.eu-digital-services-act.com/Digital_Services_Act_Article_19.html>.

Ce que la taille ne protège pas : le dénigrement, qui relève du droit national et s'applique dès
la première publication, indépendamment du revenu. Le droit de réponse inconditionnel est la
meilleure protection disponible — **c'est ce qui rend l'avancée rapide possible, pas ce qui la
freine.**

Non tranché : savoir si une base de plaintes strictement entre professionnels relève du régime
des plateformes. Question pour un juriste, à poser avant le lancement public, pas avant
l'expérimentation.

---

## Hygiène de lecture des sources

**Les publications sont du marketing, les commentaires sont le marché.** Dans l'espace agents, un
seul compte tient dix des trente publications et deux comptes vendeurs en tiennent la moitié à
eux deux. Même structure ailleurs : un compte tient onze des trente publications de l'espace
tooling, un autre sept des trente de l'espace sécurité. C'est la même mécanique de ferme qu'en
juillet, braquée sur un thème plus flatteur pour nous. Tout ce qui vaut quelque chose dans ce
relevé vient de fils de commentaires à un ou deux votes.

**X mesure des budgets, pas une demande.** Une recherche sur les paiements d'agents a renvoyé
trois comptes différents publiant le même texte promotionnel au mot près à quelques minutes
d'intervalle. Les publications ERC-8004 sérieuses plafonnent entre deux et quelques centaines de
vues pendant qu'un partenariat rémunéré en fait deux mille. Deux formules valent d'être retenues :
*« a score that can't leave the platform isn't reputation, it's a loyalty card »* (Push Chain), et
la question frontale de savoir si l'on peut vérifier des affirmations de confiance sans faire
confiance au fournisseur.

**Reddit n'est pas notre marché.** Accessible via navigateur authentifié. Sur un an, la principale
communauté agents ne contient essentiellement rien sur la vérification d'un fournisseur d'agent
ni sur les litiges commerciaux entre acheteur et vendeur d'agents. Ce qui domine : construire des
agents, vendre de l'automatisation à des entreprises humaines, et de la désillusion — le post le
plus voté du mois observe que ceux qui construisent les outils sont plus enthousiastes que ceux
qui les utilisent. Cohérent avec le fait que les très petites structures ne sont pas notre cible.

---

## Ce qui reste ouvert

- **Qui paie le rapport pré-contractuel.** Décision d'orientation prise le 29/07 : les deux
  parties, pour une neutralité démontrable. Entre en tension avec la règle « aucun revenu ne peut
  jamais venir du côté vendeur » de la doctrine — arbitrage à trancher explicitement.
- **L'amorçage.** Base vide, donc rapport sans valeur, donc personne ne paie. Piste : ne facturer
  que lorsque la base a réellement quelque chose à dire ; sinon le rapport le dit et reste gratuit.
- **Le calendrier d'Internet Court**, dont le mainnet au quatrième trimestre définit notre fenêtre.
- **La granularité du contrat**, question ouverte publiquement par l'auteur du fil le plus lu de
  Moltbook. Point d'entrée par un fait de première main plutôt que par une présentation.
