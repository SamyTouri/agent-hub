# Plan terrain — Complaint Bureau, version 2

> **Provenance.** Promu depuis `.exchange/codex/2026-07-29-complaint-bureau-field-test-plan-v2.md` le 2026-08-01, sans modification du corps. Motif : `docs/DOCTRINE.md` invoque une « first field gate » sans la définir, et sa seule définition écrite vivait dans un fichier ignoré par Git. Ce document est donc la référence de cette porte.

Date : 2026-07-29
Auteur : Claude Code Opus 5, sur le plan v1 de Codex du même jour
Statut : arbitrages de Samy intégrés, à ratifier

**Deux horloges, à ne jamais confondre.** Celle du produit se compte en secondes : vérifier une
signature, notifier une contrepartie et publier un dossier sont des opérations machine, et rien
dans ce plan ne justifie qu'elles prennent plus de temps que leur exécution. Celle du
recrutement se compte en jours, parce qu'elle dépend de trouver des humains et de les
convaincre — c'est la seule lenteur légitime ici, et elle n'est pas un délai du produit mais
une contrainte de départ. Tout délai du produit qui dépasse la seconde doit être justifié par
une raison nommée, jamais par une habitude d'entreprise.

Cette version garde l'ossature de Codex — preuve comportementale avant code, portes
explicites, rien de construit prématurément — et modifie trois choses sur instruction de
Samy, chacune datée et motivée ci-dessous.

## Ce qui change, et pourquoi

**1. La plainte devient symétrique.** Le v1 excluait la plainte d'un vendeur contre un
acheteur, faute de contrôle de l'adresse payeuse. Codex avait raison de refuser de changer
la règle en silence ; Samy la change explicitement le 2026-07-29. La règle n'est pas
affaiblie, elle est corrigée : ce qui fonde la recevabilité n'est pas d'avoir payé, c'est
**d'être partie prouvée à une transaction réelle**.

**2. L'horloge de réponse cesse d'être un nombre de jours.** Le v1 fixait sept jours
calendaires. C'est un délai d'entreprise humaine posé sur un marché qui facture à la seconde,
et il n'a aucune justification : une contrepartie qui livre en trente secondes et encaisse à
la seconde ne peut pas demander une semaine pour dire un mot. Le délai devient **proportionné
à la vitesse à laquelle la contrepartie opère elle-même** — le principe de dimensionnement de
Samy, appliqué au litige. Détail dans la section « l'horloge » plus bas.

**3. Le cadrage juridique ne bloque plus la publication.** Le v1 en faisait une porte
bloquante. Samy a arbitré le 2026-07-29 : avance rapide tant que le revenu n'a pas dépassé
cent euros. La protection n'est pas le cadrage, elle est procédurale, et elle est déjà dans
le plan — preuve de qualité de partie, notification traçable, fait daté sans qualification,
droit de réponse permanent et gratuit. Ces quatre-là restent non négociables, précisément
parce qu'ils remplacent le cadrage.

## La règle d'entrée, symétrique

Un dossier est recevable quand son auteur prouve, par une signature, qu'il contrôle **l'une
des deux adresses d'une transaction réelle** :

- **l'adresse payeuse** — c'est un acheteur, il conteste ce qu'il a reçu ;
- **l'adresse bénéficiaire** — c'est un vendeur, il conteste le comportement de son client.

Le hachage de transaction seul ne prouve rien : la chaîne est publique, n'importe qui peut
présenter le hachage de quelqu'un d'autre. La signature reste le seul élément recevable, et
elle l'est désormais des deux côtés. C'est le miroir strict de la règle existante, pas une
exception.

**Ce dont un vendeur peut se plaindre**, puisque le non-paiement est exclu par construction :
un périmètre modifié après acceptation, une contestation ouverte par principe et sans grief
formulé, une demande de remboursement sans motif, des exigences hors mission présentées comme
correctives, des re-livraisons répétées sans critère d'acceptation. Le terrain montre que ce
n'est pas théorique : un opérateur a documenté cinquante-deux litiges provenant tous du même
donneur d'ordre, sur cent vingt et une missions, sans qu'aucun n'ait de rapport avec la
qualité livrée. Ces plaintes-là n'existent nulle part aujourd'hui.

**Ce que la symétrie apporte au-delà du volume.** Elle est la meilleure réponse à
l'accusation d'être un tribunal à charge, elle double le gisement sans doubler le travail, et
surtout elle rend le registre utile à l'achat *et* à la vente — un fournisseur peut enfin
filtrer un client, ce qu'aucun outil ne permet.

## L'horloge, et pourquoi c'est elle qui recrute

Le plaignant ne dépose pas pour être indemnisé — il ne le sera pas. Il dépose pour que la
contrepartie ne recommence pas ailleurs. Un registre qui publie dans six semaines ne sert pas
ce motif ; un registre qui publie dans trois jours, si. **La vitesse de publication est
l'argument de recrutement principal, pas un détail opérationnel.**

Le déroulé, annoncé au plaignant à la seconde du dépôt :

1. Dépôt et vérification de la signature — **immédiat**, c'est une opération cryptographique,
   rien n'y attend un humain.
2. Notification de la contrepartie par son canal le plus rapide — **immédiate**, horodatée,
   conservée, et portant l'horodatage exact de publication qui en découle.
3. Publication **à la seconde où la contrepartie répond**, sa version attachée au dossier, ou
   à l'expiration de sa fenêtre si elle se tait.
4. La réponse reste possible après publication, sans limite, et s'attache au même dossier.

**La fenêtre est proportionnée à la contrepartie, pas fixée par convention.** Une contrepartie
qui publie un point de contact machine — endpoint A2A, serveur MCP, webhook, compte actif sur
un réseau d'agents — est joignable en continu et n'a aucun besoin de plus d'**une heure**.
Celle qui n'expose qu'un canal humain dispose de **vingt-quatre heures**, l'alignement déjà
retenu par Samy pour Moltbook. Une contrepartie injoignable par aucun canal vérifiable est
publiée avec la mention que la notification a échoué et la trace de la tentative — l'absence
de canal de contact est elle-même un fait sur un vendeur qui encaisse.

Le principe se défend en une phrase, et c'est celle qu'on donnera publiquement : **le délai de
réponse ne dépasse jamais la vitesse à laquelle la contrepartie facture.**

Deux propriétés du dispositif, contre-intuitives et centrales. **Répondre accélère sa propre
publication** — le silence ne retarde donc rien, il prive seulement de sa version dans la
première lecture. Et **le plaignant connaît l'horodatage de publication à la seconde du
dépôt**, ce qui transforme une démarche incertaine en engagement daté. C'est ça qui fait
déposer, bien plus que n'importe quel argument sur l'utilité du registre.

Un dossier publié ne se retire jamais. Il se corrige, daté, ou il se complète. Une contestation
sans élément contraire laisse le dossier publié en `disputed`, avec la réponse liée.

## Recrutement : aller chercher les plaintes qui existent déjà

Le v1 prévoyait dix approches ciblées. C'est le bon principe et c'est trop lent. La correction
n'est pas d'élargir l'audience mais d'exploiter un gisement que le v1 ignore : **les gens
racontent déjà publiquement leurs mésaventures, et leur récit est volatil.**

**Piste 1 — les plaintes déjà écrites.** Recenser systématiquement les témoignages publics de
litige payé sur X, Moltbook, les tickets GitHub et les fils de marketplaces. J'en ai un
exemple précis : un opérateur a raconté publiquement un paiement passé, une identité vérifiée,
une négociation aboutie, puis un litige sans aucun recours, remboursement manuel et perte
encaissée — le tout pour quinze vues. Ces gens ont déjà payé le coût de l'écriture. On ne leur
demande pas de raconter, on leur propose de rendre leur récit permanent et opposable. C'est
l'approche la moins coûteuse pour eux et donc la plus convertissante.

**Piste 2 — les récidivistes documentés.** Quand une même contrepartie apparaît dans plusieurs
récits, elle devient le point d'entrée : chaque victime a un intérêt direct à ce que les autres
dossiers existent. Un dossier isolé est un témoignage ; trois dossiers sur la même contrepartie
sont un signal que personne ne peut ignorer.

**Piste 3 — le côté vendeur, que personne ne courtise.** L'opérateur aux cinquante-deux litiges
recommande à ses pairs de suivre eux-mêmes les identifiants de leurs donneurs d'ordre. Il tient
déjà notre registre à la main, sans outil. C'est le premier utilisateur le plus probable du
projet, et il est côté vendeur — pas côté acheteur.

**Piste 4 — entrer par le fait, jamais par l'annonce.** Règle inchangée depuis la veille du
21 juillet et confirmée : dans ces espaces, un premier commentaire qui apporte un fait de
première main passe ; une présentation ne passe pas. Le fait de première main que nous aurons
bientôt et que personne d'autre n'a, c'est le déroulé exact d'un cycle notification-réponse
réel.

**Ce qui reste interdit, et ce n'est pas de la prudence mais de l'efficacité.** Pas de dépôt
sans signature, jamais. Pas de publication sans notification traçable. Pas de plainte déposée
ou rédigée par nous à la place de quelqu'un. Pas de démarchage de masse : le terrain a montré
que les grands espaces sont du bruit et que les fermes de contenu y noient tout. L'agressivité
porte sur la **vitesse et le ciblage**, pas sur le volume.

## Portes

**Après les dix premières approches** (les gates de Codex, conservées) : deux dossiers
recevables sur deux contreparties distinctes → on continue en manuel. Un seul → seconde série
d'approches, ne pas concevoir le produit autour d'un cas unique. Des cas réels mais un refus de
notification ou de publication → tester une base privée consultable avant engagement plutôt
qu'un registre public. Aucun cas recevable → arrêter B, prioriser la mémoire commerciale datée.

Ajout de la v2 : **au moins un des deux dossiers doit venir du côté vendeur.** Si les deux
viennent d'acheteurs, la symétrie reste une intention non testée, et c'est exactement ce que
Codex reprochait à juste titre au fait de changer une règle sans l'éprouver.

**Porte du premier développement**, resserrée par rapport au v1 puisque le cadrage juridique
n'est plus bloquant : deux dossiers recevables sur deux contreparties distinctes, au moins un
cycle notification-réponse mené jusqu'au bout, et l'accord explicite d'au moins un plaignant
pour une publication nommée.

Les vues, les likes, les compliments et les silences ne comptent toujours pas.

## Premier développement autorisé

Inchangé par rapport au v1, plus une chose. Une page publique de méthode et d'éligibilité, un
dépôt privé, un dossier public au niveau d'une transaction, la réponse de la contrepartie liée
en permanence, des corrections datées. Signature, vérification et modération restent manuelles.

L'ajout : **l'horloge de publication doit être visible sur la page de méthode dès le premier
jour.** C'est l'élément qui recrute ; le cacher reviendrait à construire le produit sans son
argument.

## Ne pas construire maintenant

Pas de comptes, pas de score, pas de recherche, pas d'automatisation de la signature ou de la
notification, pas de file de modération, pas de moteur de workflow, pas de paiement du rapport
de pré-engagement, pas d'exposition MCP ou A2A, pas de refonte du site, pas de campagne large.

La couche D sort de cette liste : la plainte vendeur **est** la réciprocité, et Samy l'active
le 2026-07-29. Elle reste manuelle comme le reste.

## Couche A en parallèle, bornée

Inchangé : au maximum une journée pour compter puis capturer manuellement un petit corpus
d'offres x402 payantes, et cette collecte ne retarde pas le test de B.

## Ce qui doit remonter à Samy

Le cadrage juridique n'est plus une porte, mais il reste une dépense à faire avant l'ouverture
publique du registre — pas avant les premiers dossiers.

**Tranché par Samy le 2026-07-29, avant le premier dossier plutôt que sous la pression du
premier incident** : une contrepartie qui répond par une menace au lieu d'une réponse voit son
dossier publié à l'heure prévue, **et la menace publiée avec, telle quelle et datée**, comme
pièce du dossier. Intimider le registre est un fait qu'un acheteur veut connaître. La règle est
entrée en doctrine ; il n'y a plus de décision à prendre le jour où ça arrivera.
