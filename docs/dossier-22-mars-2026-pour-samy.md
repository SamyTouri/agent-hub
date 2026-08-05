---
title: Le 22 mars 2026 — ce qui s'est passé, et ce que ça dit du marché où nous allons entrer
date: 2026-08-04
destinataire: Samy
statut: dossier explicatif — chaque chiffre mesuré ou sourcé, étiqueté ligne à ligne
---

# Dossier : la falaise du 22 mars 2026

Tu m'as demandé de comprendre l'événement du 22 mars et de te l'expliquer en détail, avec quatre
questions centrales : pourquoi ? a-t-il été remplacé ? ACP est-il toujours l'essentiel du marché ?
et si c'était une bulle, sommes-nous en avance plutôt qu'en retard ?

Réponse courte à chacune, puis le détail.

| ta question | réponse courte |
|---|---|
| **Pourquoi ?** | **L'événement est nommé** (§4bis, apport de Codex, corroboré par une mesure à moi) : le 22 mars 2026 était le dernier jour de l'**Epoch 5**, que Virtuals a annoncée comme **la dernière du programme d'incitations aGDP**. Ce qui reste inconnu est la *part* de la chute imputable à l'arrêt des récompenses. |
| **A-t-il été remplacé ?** | **Oui, partiellement.** ACP v2 tourne depuis avril sur un nouveau contrat. Il fait 1 072 $ en juillet et **il croît de 39 % par mois**. |
| **ACP est-il encore l'essentiel du marché ?** | **La question est mal posée** — corrigé sur ton objection, §6. x402 est un compteur d'API (données, inférence), pas un marché de services entre agents ; il n'a même pas de catégorie « agent à agent ». ACP reste **le seul endroit où il existe du travail commandé avec obligation de livraison** — et ce marché-là vaut ~1 082 $/mois. |
| **Bulle éclatée ? Sommes-nous en avance ?** | **Oui pour la bulle** (subventionnée, à moitié peuplée de flottes fictives). **Et oui, nous sommes en avance** — mais pas pour la raison qu'on croyait. Voir §7, c'est la partie qui compte. |

---

## 1. Avertissement de méthode — j'ai publié une version fausse de ceci il y a six heures

Ce matin j'ai publié « le marché s'est arrêté, 9,56 $ en juillet ». **C'était faux d'un facteur
113.** J'avais mesuré un contrat sur trois.

J'avais pourtant testé l'objection de migration — contre un second contrat, contre Arbitrum, BNB,
Optimism et Polygon. Ce que je n'avais pas fait, c'est **lire le journal des versions de Virtuals**,
qui annonce noir sur blanc le déploiement d'ACP v2 en avril 2026. La réponse était dans la
documentation de l'éditeur pendant que je cherchais des preuves dans mes propres données.

Corrigé publiquement sur Moltbook le jour même. Je le mets en tête ici parce que **tu dois savoir
quel crédit accorder au reste** : tout ce qui suit est mesuré, mais ce dossier a moins de douze
heures et il a déjà changé une fois de conclusion.

---

## 2. La chronologie, datée

| date | événement | statut |
|---|---|---|
| **2026-02-01** | ACP intègre ERC-8004 : inscription on-chain automatique des agents | RAPPORTÉ (changelog Virtuals) |
| **2026-02-07** | Intégration OpenClaw Skills | RAPPORTÉ (changelog) |
| **2026-02-12** | **Virtuals annonce le « Revenue Network » à Consensus Hong Kong : jusqu'à 1 M$/mois distribués aux agents qui vendent via ACP** | RAPPORTÉ (communiqué PRNewswire) |
| **2026-02-13 →** | Le volume déposé dans le séquestre décolle : 4 k$/jour → 20 k$ → 46 k$ | **MESURÉ** |
| **2026-02** | 211 propriétaires créent des flottes de ~100 agents chacun | **MESURÉ** |
| 2026-02-23 | Pic journalier : **415 708 $** | **MESURÉ** |
| **2026-02 / 03** | Sommet mensuel : **1,16 M$** puis **1,04 M$** | **MESURÉ** |
| 2026-03-10 | Changelog : bascule « job privé » | RAPPORTÉ |
| 2026-03-18 | Changelog : paliers d'abonnement et configuration tarifaire | RAPPORTÉ |
| **2026-03-22 → 23** | **LA FALAISE : 79 836 $ le 22, 2 401 $ le 23. −97 % en une nuit.** | **MESURÉ** |
| 2026-03-24 | Virtuals annonce l'intégration Arbitrum comme couche de commerce | RAPPORTÉ (crypto.news) |
| **2026-04** | **ACP v2.0 : nouveau contrat `0x238E541Bfe…32E0` sur Base** | RAPPORTÉ (changelog) + **MESURÉ** |
| 2026-05 | **Plancher : 778 $ sur le mois**, tous contrats confondus | **MESURÉ** |
| 2026-06 → 07 | Reprise : 799 $ puis **1 082 $**, entièrement sur v2 | **MESURÉ** |

---

## 3. Ce que la chaîne montre exactement

### La courbe, trois contrats réunis

| mois | v1 | v1-bis | **v2** | **TOTAL** |
|---|---:|---:|---:|---:|
| 2025-11 | 240 934 | — | — | **240 934** |
| 2025-12 | 952 560 | — | — | **952 560** |
| 2026-01 | 136 551 | — | — | **136 551** |
| **2026-02** | 1 161 073 | — | — | **1 161 073** |
| **2026-03** | 1 039 223 | 24 | — | **1 039 248** |
| 2026-04 | 34 050 | 5 | 157 | **34 212** |
| **2026-05** | 474 | 1 | 303 | **778** ← plancher |
| 2026-06 | 29 | 0 | 770 | **799** |
| **2026-07** | 10 | 0 | **1 072** | **1 082** |

Cumul depuis l'origine : **3,57 M$** sur 1,38 million de transferts, 23 840 déposants,
8 183 bénéficiaires. Ce cumul **corrobore indépendamment** les ~3,9 M$ annoncés par la plateforme —
c'est un point à leur crédit et il faut le dire.

### La falaise, au jour

| jour | dépôts | USDC |
|---|---:|---:|
| 2026-03-21 | 21 289 | 42 405 |
| **2026-03-22** | 8 313 | **79 836** |
| **2026-03-23** | 3 683 | **2 401** |
| 2026-03-24 | 2 402 | 396 |

**Le détail qui oriente tout** : la **valeur** chute de 97 % en une nuit, mais le **nombre** de
dépôts ne fait que se diviser par deux, puis décroît lentement pendant des semaines.

Ce ne sont donc pas les agents qui s'arrêtent d'un coup. **C'est une classe de montants qui
disparaît.**

### Quelle classe ? Celle de 10 à 100 dollars

| tranche | 1–22 mars | 23 mars–30 avril | juillet |
|---|---:|---:|---:|
| < 0,02 $ | 89 293 dépôts | 52 028 | **376** |
| 0,1–1 $ | 95 611 | 14 259 | 25 |
| 1–10 $ | 90 735 | 11 618 | 1 |
| **10–100 $** | **32 326 dépôts · 635 246 $ · 64 % de la valeur** | **1 123 · 17 730 $** | **0** |
| 100–1 000 $ | 649 | 312 | 0 |

**La mission à 10–100 $ s'évapore : −96,5 % en nombre, et elle portait les deux tiers de la
valeur.** Ce qui survit le plus longtemps, c'est la poussière : en juillet, 376 des 428 dépôts v1
font moins de deux centimes.

Une disparition **sélective par montant**, **simultanée sur des milliers d'adresses**, en **une
nuit**. C'est la forme d'un robinet qu'on ferme, pas d'une demande qui faiblit.

---

## 4. Pourquoi — le mécanisme, et ce que je n'ai pas prouvé

### Le fait qui explique la montée

**Le 12 février 2026, Virtuals annonce le Revenue Network : jusqu'à 1 M$ par mois distribués aux
agents qui vendent des services via ACP**, financé par les revenus du protocole et indexé sur
« la production économique mesurable plutôt que sur la spéculation » (leur formulation).

Confronte les deux séries :

- avant l'annonce, le séquestre encaisse **4 à 16 k$ par jour** ;
- à partir du 13 février : 20 k$, 46 k$, 80 k$, 108 k$, puis 415 k$ le 23 février ;
- sur le mois : **1,16 M$** — *le même ordre de grandeur que le programme lui-même*.

**Un programme qui verse jusqu'à 1 M$/mois pour du volume produit environ 1 M$/mois de volume.**
C'est une coïncidence de taille et de date que je ne sais pas expliquer autrement.

### Le registre est à moitié composé de flottes

C'est la mesure la plus parlante du dossier, et elle n'était pas dans mon plan :

| taille de flotte | propriétaires | agents détenus |
|---|---:|---:|
| 1 agent | 5 254 | 5 254 (11,9 %) |
| 2–5 | 2 495 | 6 458 (14,7 %) |
| 6–20 | 689 | 7 037 (16,0 %) |
| 21–50 | 40 | 1 128 (2,6 %) |
| 51–99 | 36 | 3 066 (7,0 %) |
| **100 et plus** | **211** | **21 108 (47,9 %)** |

**211 adresses détiennent près de la moitié du registre ACP.** Et les tailles ne sont pas
quelconques : 104, 101, 101, 101, 101, 100, 100, 100, 100, 100… **C'est un plafond ou une cible, pas
une croissance.**

J'ai échantillonné six de ces flottes et demandé leur date de création : **590 des 600 agents ont
été créés en février 2026**, le mois du lancement du programme. La plupart n'ont **jamais** exécuté
une seule mission — `grossAgenticAmount: 0`, `successfulJobCount: 0`.

**Conséquence directe pour nous** : le chiffre « 44 051 agents » que nous avons publié, et que tout
le monde publie, est **à moitié composé de flottes créées en un mois pour un programme
d'incitation**. Il faut cesser de le citer nu.

### Ce que j'ai cherché et NON trouvé — avec la limite que Codex y a mise

L'hypothèse évidente est le lavage : des agents d'un même propriétaire se payant entre eux pour
fabriquer du volume. **Je l'ai testée et elle est fausse à cette échelle.** En mappant chaque
déposant et chaque bénéficiaire vers son propriétaire ACP, l'argent qui revient au même
propriétaire ne représente que **2,7 %** du volume de la période subventionnée.

**Codex a raison de dire que ce test prouve moins que je ne le lui faisais dire.** Il réfute une
boucle naïve entre agents *déclarés sous le même propriétaire dans le registre ACP*. Il ne teste pas
le **contrôle économique commun de portefeuilles acheteurs non attribués** — deux adresses pilotées
par la même personne mais jamais enregistrées comme agents du même propriétaire passent au travers.

Et ce n'est pas théorique. Un service public, **ClawBoost**, commercialise aujourd'hui exactement
ça : des agents acheteurs multi-portefeuilles, la création de vrais jobs ACP, le recyclage
automatique du capital, et environ **4,8× le budget initial en volume aGDP**, avec 20 % perdus par
tour en frais ACP. Leur exemple : 5 000 $ transformés en 23 995 $ de volume brut. *(Observé
aujourd'hui — ça ne prouve pas que ce service opérait en février-mars.)*

La borne mathématique est cohérente : avec 20 % de friction par tour, une boucle fermée plafonne à
`B + 0,8B + 0,8²B + … = 5B`. Le « 4,8× » annoncé est une boucle finie proche de cette limite.

**Formulation corrigée** : le lavage entre agents d'un même propriétaire déclaré est marginal
(2,7 %). **Le volume fabriqué par des acheteurs contrôlés en commun mais non attribués n'est pas
mesuré, et il est industriellement faisable.**

### Le gain du gros perdant : Codex donne la piste

Le premier déposant a mis **77 920 $** dans le séquestre pour n'en retirer que **11 569 $**. Il perd
66 000 $ — ce qui n'a de sens que si le gain est ailleurs.

Codex pointe une mesure déjà dans `market-intel/` que j'avais oubliée : sur un autre agent, une
transaction verse **1 803,81 USDC depuis un contrat de distribution à preuve Merkle**, réclamée par
le propriétaire, alors que les jobs réels du même agent pèsent **8 $**. Le champ `revenue` de l'API
est donc un agrégat **ventes + récompenses réclamées**, en proportion inconnue.

**La vérification à faire est donc précise** : chercher les versements reçus par nos gros déposants
perdants depuis ce distributeur Merkle ou ses successeurs. Si on les trouve, la bulle est documentée
de bout en bout et ce n'est plus une inférence.

### La chasse au distributeur Merkle : échec, et ce qu'elle a trouvé à la place

*(Ajouté le 2026-08-05 sur instruction de Samy — piste ouverte par Codex.)*

**Ce que je cherchais** : le contrat de distribution à preuve Merkle qui, dans une mesure antérieure,
versait 1 803,81 USDC à un agent dont les vrais jobs pesaient 8 $. Si nos gros déposants perdants
figuraient parmi ses bénéficiaires, la bulle était documentée de bout en bout.

**Je ne l'ai pas trouvé, et je le dis plutôt que de le suggérer.** Méthode : j'ai indexé toutes les
entrées de jetons, tous jetons confondus, vers les adresses des cinq plus gros propriétaires
déposants (1 462 transferts, janvier→août 2026), puis testé chaque émetteur important en comptant
ses destinataires distincts — un distributeur en paie des milliers, un portefeuille personnel en
paie deux.

Les deux meilleurs candidats se sont révélés être de l'infrastructure générique :

| contrat | sorties mesurées | verdict |
|---|---|---|
| `0xee7ae85f…4055` | 108 888 transferts, **1,43 md$**, 52 434 destinataires | trop gros de trois ordres de grandeur — routeur ou pont |
| `0x0a2854fb…9330` | 899 242 transferts, **79 M$ d'USDC** + des dizaines d'autres jetons, 65 502 destinataires | agrégateur multi-jetons, pas un programme |
| `0xb4cb8009…00e5` | **4 264 892** transferts, 172 M$ d'USDC + 84 238 WETH, 52 377 destinataires | pool d'échange |
| `0xd0b53d92…f224` | **3 781 020** transferts, **1,93 md$** d'USDC + 882 255 WETH, 23 681 destinataires | pool d'échange |

**Le test qui les élimine tous les quatre** : un programme de récompenses hebdomadaires verse **par
vagues**, groupées en fin d'epoch. J'ai donc compté leurs versements jour par jour. Aucun
groupement : leurs journées les plus chargées tombent indifféremment un mercredi, un mardi, un
dimanche, un samedi, à volume quasi constant. **C'est le profil d'une infrastructure d'échange, pas
d'une campagne.**

Corollaire utile : l'argent frais qui alimentait l'anneau `0x0e59260d…` vient de **swaps**, pas d'un
programme. Cet opérateur-là s'est financé au marché.

**Statut : piste non conclue, cinq candidats testés et écartés.** Ce qui la fermerait : retrouver la transaction exacte de 1 803,81 $
décrite dans notre fiche du 3 août, dont l'adresse n'avait pas été consignée — leçon au passage,
**une mesure qui ne note pas l'adresse qu'elle a lue n'est pas reproductible**.

**Deux faits utiles au passage.** Sur mes cinq plus gros propriétaires déposants, **deux ont en
réalité gagné de l'argent** — `0x70cd50ed…` a déposé 77 920 $ et reçu 126 247 $ (**+48 327 $**),
`0xec140041…` a déposé 37 373 $ et reçu 60 986 $ (**+23 613 $**) — tandis que les trois autres ont
tout perdu (321 $, 25 $ et 20 $ reçus pour 30 à 37 000 $ déposés). L'idée que « les gros déposants
perdaient tous » était fausse.

### En revanche, l'objection de Codex est maintenant démontrée, pas seulement plausible

En suivant ces flux, je suis tombé sur un cas qui règle la question de la limite de mon test à
2,7 %.

**Le propriétaire `0x0e59260dd59dc5a5feb99c597eb0f6162a11d464` exploite 6 agents ACP.** Cinq d'entre
eux affichent un `grossAgenticAmount` remarquablement uniforme : **21 885 · 21 932 · 22 035 ·
22 200 · 22 998 $** — une fourchette de 5 % sur cinq agents, ce qui ne ressemble pas à de la demande.

Mesuré sur tous leurs portefeuilles plus celui du propriétaire, février→mai 2026 :

| flux | montant | transactions |
|---|---:|---:|
| déposé dans le séquestre ACP | **0,00 $** | **0** |
| reçu du séquestre ACP | **143 289,61 $** | 9 007 |
| **circulation interne entre leurs propres portefeuilles, HORS séquestre** | **174 938,15 $** | **75** |
| argent frais reçu de l'extérieur | 49 100,31 $ | 183 |
| sorti vers l'extérieur | 196 186,01 $ | 110 |

**Le chiffre qui compte est celui du milieu.** Ces agents ont fait circuler **174 938 $ entre leurs
propres portefeuilles en 75 virements, entièrement en dehors du séquestre.** Mon test de
circularité mesurait les flux *du séquestre* : il ne pouvait pas voir un seul de ces dollars.

**Donc : « le lavage est écarté à 2,7 % » était une conclusion trop large, et Codex avait raison de
le dire.** La formulation juste est : *la circularité passant par le séquestre est de 2,7 % ; la
circularité hors séquestre existe, elle est documentée sur au moins un opérateur, et son ampleur
totale n'est pas mesurée.*

**Ce que ce cas n'est pas** : ce n'est pas du lavage au sens strict. Cet anneau **n'a rien déposé**
dans le séquestre et en a **extrait 143 290 $** — c'est un vendeur net, payé par l'argent d'autres
déposants. Ce qui est anormal, c'est l'uniformité des montants déclarés et la circulation interne
massive en si peu de virements.

**Et un troisième chiffre qui ne se réconcilie avec rien** : la plateforme déclare 111 050 $ de
`grossAgenticAmount` cumulé pour ces six agents, alors qu'ils ont reçu 143 290 $ du séquestre. Ni
égal, ni proportionnel. Une raison de plus de ne jamais traiter ce champ comme une mesure.

### Et un piège de vocabulaire qui invalide les comparaisons faciles

L'**aGDP** n'est pas un chiffre d'affaires. Virtuals le définit comme **toute valeur traitée par
l'agent** : fonds reçus, fonds retransmis, frais payés et reçus, et **le notionnel des jobs de
trading**. Leur propre exemple : un agent qui reçoit 10 $ et en reverse 3 $ produit **13 $** d'aGDP ;
un agent qui gère 5 000 $ de trading pour 10 $ de frais produit **5 010 $** d'aGDP.

De même, un `job ID` compte pour une transaction même s'il contient plusieurs mouvements de fonds.
**Les « 2 millions de jobs » annoncés ne sont donc pas comparables à mes 1,38 million de transferts
USDC.**

**Quatre grandeurs différentes qu'il ne faut jamais confondre** : l'aGDP annoncé, les 3,57 M$ entrés
dans le coffre (mesurés), les frais réellement gagnés par les vendeurs, et les récompenses
distribuées.

## 4bis. L'événement est nommé — apport de Codex, et ce que ma mesure y ajoute

*(Ajouté le 2026-08-05 après lecture de `.exchange/codex/complement-dossier-22-mars-2026-codex.md`.
La version précédente de ce dossier disait « je ne sais pas nommer l'événement ». C'est levé.)*

### La pièce trouvée par Codex

Une archive d'une publication du compte officiel `@virtuals_io` annonce que **l'Epoch 5 est la
dernière epoch du programme d'incitations aGDP**, avec ce bilan : jusqu'à 4 M$ de revenu
agent-à-agent, plus de 2 millions de jobs, plus de 32 951 agents lancés, **plus de 1 M$
d'incitations distribuées**, et le passage annoncé à une nouvelle structure.

La documentation officielle décrit les epochs comme des semaines **lundi 00:00 → dimanche 23:59
(UTC+4)**. **Le 22 mars 2026 était un dimanche** — je l'ai vérifié. La séquence hebdomadaire depuis
le lancement du 12 février place donc l'Epoch 5 finale sur le **16–22 mars**.

**Statut : RAPPORTÉ par Virtuals via un miroir tiers, la fenêtre exacte de l'Epoch 5 étant une
inférence forte de Codex, pas une page officielle.**

### Ce que ma mesure y ajoute — et c'est plus fort que la concordance de date

Une date qui tombe bien reste une coïncidence tant qu'on n'a pas montré que l'arrêt est **collectif**.
Je l'ai mesuré.

**Les dépôts de 10 $ et plus, du 15 au 22 mars : 19 341 dépôts, 371 881 $, émis par 116
propriétaires distincts.** Les trois premiers ne pèsent que **15,9 %** de la valeur. Ce n'est pas un
opérateur qui range ses affaires : **c'est 116 acteurs indépendants qui s'arrêtent en même temps.**

Et « en même temps » est littéral. Après recalage sur des horodatages de blocs réels (mon
extrapolation dérivait de +30 min, ce qui ne se voit pas au jour mais fausse une lecture horaire) :

| heure UTC, dimanche 22 mars | USDC déposés |
|---|---:|
| 12:00 | 18 141 |
| **13:00** | **22 460** |
| 14:00 | 9 510 |
| **15:00** | **101** |
| 16:00 | 28 |
| 17:00 | 10 |

**Le décrochage est à ~14:32 UTC**, à la minute près : les dépôts par multiples de 60 $ s'arrêtent
net, et il ne reste que de la poussière sub-dollar.

**Un arrêt simultané de 116 opérateurs indépendants à la même minute, un dimanche, ne peut pas être
une somme de décisions individuelles.** C'est une échéance commune. La pièce de Codex dit laquelle.

### La réserve que je maintiens

**14:32 UTC = 18:32 UTC+4, soit environ cinq heures et demie AVANT la frontière d'epoch inférée
(23:59 UTC+4 = 19:59 UTC).** Les deux ne coïncident pas exactement.

Lecture la plus simple, mais **c'est une inférence de ma part** : on n'envoie pas ses derniers jobs à
la seconde d'une échéance qu'il faut que le système ait le temps de compter. Cinq heures de marge
avant une date-limite, c'est un comportement ordinaire. Autres lectures possibles : le fuseau de
l'aGDP n'est pas celui de l'ACP Score (14:32 UTC = 22:32 à Singapour, siège de Virtuals), ou le
budget de l'epoch était épuisé avant sa clôture.

**Ce que ça ne dit pas** : la part exacte de la chute imputable à l'arrêt des récompenses, le préavis
donné aux participants, et la proportion d'activité qui existait indépendamment.

### Les explications concurrentes, toutes écartées

| explication | statut |
|---|---|
| un gros acteur part | **écarté** — 6 580 déposants, le premier pèse 9,8 % ; et 116 opérateurs sur les gros dépôts |
| migration de chaîne | **écarté** — aucun contrat ACP sur Arbitrum, BNB, Optimism, Polygon (§5) |
| migration vers un autre contrat | **écarté puis nuancé** — v1-bis fait 29,78 $ ; v2 existe mais démarre en avril et à 157 $ |
| panne de Base | **écarté** (Codex) — l'incident le plus proche commence le **24 mars ~12:00 UTC**, après la falaise, et n'affecte pas la production de blocs |
| contexte macro | **insuffisant** (Codex) — semaine risquée, mais Bitcoin était encore +1,5 % sur 24 h le matin du 23 ; n'explique ni l'alignement sur l'epoch, ni la sélectivité par tranche, ni l'absence de rebond |
| changelog produit | **non pertinent** — entrées les 10 et 18 mars, rien le 22 : une fin de campagne se publie dans la communication du programme, pas dans les notes de version |

---

## 5. A-t-il été remplacé ? — oui, partiellement, et c'est la bonne nouvelle

**Sur d'autres chaînes : non.** J'ai vérifié le code des contrats ACP sur Arbitrum, BNB Chain,
Optimism et Polygon : **aucun n'y est déployé**. L'annonce Arbitrum du 24 mars n'a pas de contrepartie
on-chain à ce jour. (En revanche, les registres ERC-8004, eux, sont bien déployés sur Arbitrum, BNB
et Optimism — l'identité voyage, pas le commerce.)

**Sur Base, par ACP v2 : oui.** Contrat `0x238E541BfefD82238730D00a2208E5497F1832E0`, qui détient
l'USDC directement (j'ai vérifié le chemin complet de l'argent cette fois) :

> **Précision de Codex, et elle est juste** : le changelog documente un **SDK ACP v2 dès le 15
> octobre 2025**. Ma phrase « ACP v2 déployé en avril » doit donc se lire « **ce contrat Core-là
> devient actif en avril 2026** ». Version produit, version de SDK et contrat de règlement sont trois
> choses distinctes. Ça ne change pas la mesure de la reprise, seulement ce qu'on a le droit d'en
> dire.

| mois | v2 |
|---|---:|
| 2026-04 | 156,50 $ |
| 2026-05 | 302,96 $ |
| 2026-06 | 770,21 $ |
| **2026-07** | **1 072,11 $** |

**+39 % de juin à juillet, et une croissance sur quatre mois consécutifs.** v1 est mort ; le marché
ne l'est pas. Il a redémarré ailleurs, propre, et petit.

---

## 6. ACP est-il encore l'essentiel du marché ? — la question est mal posée, et je l'avais mal posée

> **Correction, sur objection de Samy.** La première version de ce dossier comparait le volume ACP au
> volume x402 et en concluait que « le marché a choisi le paiement sans la confiance, à onze contre
> un ». **La comparaison était biaisée : je rapportais un dénominateur étroit à un dénominateur
> large.** x402 est un rail de paiement HTTP, pas un marché de services entre agents.

### Ce que x402 vend réellement — RAPPORTÉ, sources ci-dessous

Répartition des services x402 (décembre 2025) :

| catégorie | part |
|---|---:|
| Données | 30,9 % |
| IA | 25,4 % |
| Blockchain | 15,2 % |
| Utilitaires | 11,7 % |
| Trading | 6,2 % |
| Recherche | 5,3 % |
| Autre | 5,3 % |

**Il n'y a pas de catégorie « commerce entre agents ».** Les premiers vendeurs sur 30 jours (au
2026-05-30) : **StableEnrich** (revente d'APIs Apollo, Google Maps, Serper), **BlockRun YOPO**
(passerelle vers 55+ modèles LLM), **HYRE Agent** (données DeFi), **twit.sh** (données X). La source
la plus détaillée le dit sans détour : ce sont *« pas des transactions pair-à-pair ou d'agent à agent
au sens traditionnel, mais de la facturation de consommation d'API »*.

**La bonne lecture** : x402 est un **compteur**, pas une place de marché. On appelle une API, on paie
à l'appel, la livraison est la réponse HTTP — **immédiate, autoévidente, et à 1–10 centimes**. Il
n'y a rien à vérifier parce qu'il n'y a rien qui puisse être livré à moitié.

ACP fait autre chose : **commander un travail** à un agent, avec obligation de livraison, séquestre,
et un tiers qui dit si c'est fait. Ce sont **deux marchés différents**, pas deux concurrents.

### Donc, la réponse corrigée

**ACP n'a jamais été « la majorité du marché des paiements entre agents »** — ce marché-là est
dominé par la facturation d'API et vaut ~1,11 M$/mois. **Mais ACP est, à notre connaissance, le seul
endroit où existe du travail commandé avec obligation de livraison**, et ce marché-là vaut
aujourd'hui **~1 082 $/mois**.

C'est un fait plus dur que celui que j'avais écrit, et plus honnête : **le marché où la confiance
sert à quelque chose ne fait pas onze fois moins que l'autre — il fait mille fois moins, et il est
presque seul de son espèce.**

*(x402 : RAPPORTÉ — agenteconomy.to au 2026-08-05, recherche BlockRun décembre 2025, note x402inc
au 2026-05-30. **Aucun de ces chiffres n'est mesuré par nous** ; à refaire nous-mêmes avant tout
usage engageant. ACP : MESURÉ.)*

---

## 7. Était-ce une bulle, et sommes-nous en avance ? — oui, et oui, mais pas comme on l'espérait

### Que c'était une bulle : ce qui l'établit

1. La montée coïncide au jour près avec un programme de subvention de **1 M$/mois**, et elle produit
   un volume **du même ordre de grandeur que la subvention**.
2. **47,9 % du registre** est constitué de flottes d'exactement ~100 agents, **créées en février**,
   dont la plupart n'ont jamais rien fait.
3. La chute est **sélective par montant** et **instantanée** — la signature d'un financement coupé,
   pas d'une demande qui s'érode.
4. **116 opérateurs indépendants s'arrêtent dans la même heure**, un dimanche, au dernier jour de la
   dernière epoch du programme.
5. Après la coupure, il reste **0,07 % du pic** (778 $ contre 1,16 M$).
6. **Virtuals le savait et le disait.** Dès le bilan de l'Epoch 1, la plateforme reconnaissait
   publiquement observer de l'**activité de service artificielle**, des **flux auto-dirigés** et des
   **distorsions de prix**, et introduisait `Agent Score` puis des règles anti-farming resserrées à
   chaque epoch. *(RAPPORTÉ par Virtuals via miroirs secondaires — apport de Codex.)*
7. **L'économie du farming était positive.** Plus de 1 M$ de récompenses pour 3,57 M$ entrés dans le
   coffre, soit ~**28 centimes de récompense par dollar déposé** — au-dessus des **20 %** de friction
   ACP par tour. Un participant bien classé pouvait donc gagner de l'argent **sans aucune demande
   extérieure**. *(Ordre de grandeur, pas rendement individuel : périmètres et pondérations
   diffèrent.)*

**Verdict : oui, une bulle subventionnée, avec une incitation dont la mécanique rendait le farming
rentable, et que l'éditeur combattait déjà sans y parvenir.**

**Ce que ça n'établit pas** : que tout le volume était fictif. La proportion d'activité réellement
demandée par un tiers indépendant **n'est pas mesurée**, et je ne vois pas comment la mesurer avec
les données publiques.

### Que nous ne sommes pas en retard : ce qui l'établit

C'est ta question de fond, et la réponse est solide, mais elle n'est pas « le marché va redécoller
et nous serons là ». Elle est plus intéressante que ça.

**Ce qui est vrai :**

- Le vrai marché du commerce entre agents avec livraison vérifiée n'a **jamais dépassé quelques
  centaines de dollars par mois** hors subvention. Le pic était acheté.
- Personne n'a pris la place. Le siège d'évaluateur a versé **0,42 $** en tout. Le registre de
  validation ERC-8004 **n'est déployé nulle part**. Il n'y a pas de titulaire à déloger.
- **Ça repart** : quatre mois de croissance consécutive sur v2.
- **Nous avons aujourd'hui une carte du terrain que personne d'autre ne publie** — adresses des
  contrats, séries mensuelles, composition du registre. C'est un actif réel et daté.

**Ce qui doit tempérer :**

- Une reprise de 778 → 1 082 $/mois, ce sont trois points. **Ce n'est pas encore une tendance**, et
  je te le dis maintenant plutôt que dans trois mois.
- L'argent, lui, est chez x402 — **onze fois plus, et en croissance** — et x402 a délibérément
  choisi de ne pas avoir de couche de confiance.

### La lecture que j'en fais pour « créer de la valeur économique grâce à la création de confiance »

*(Réécrite après l'objection de Samy. La version précédente disait « le marché a choisi le paiement
sans la confiance, onze contre un » — c'était une inférence tirée d'une comparaison faussée.)*

Il n'y a pas eu de choix entre confiance et absence de confiance. **Il y a deux marchés qui n'ont
pas le même problème.**

**Deux conditions doivent être réunies pour que quelqu'un paie pour de la vérification :**

1. **Il faut assez de valeur en jeu** — le coût d'une erreur doit dépasser le coût du contrôle.
2. **Il faut que le livrable ne soit pas autoévident** — s'il suffit de regarder pour savoir si
   c'est fait, il n'y a rien à vérifier.

Appliquons-les :

| | valeur en jeu | livrable autoévident ? | besoin de confiance |
|---|---|---|---|
| **x402** — appel d'API, inférence, données | 1 à 10 centimes | **oui** — la réponse HTTP arrive ou n'arrive pas | **structurellement nul** |
| **ACP** — travail commandé, livré plus tard | 0,05 $ médian, plafonné à 10 $ | **non** — un rapport peut être livré et mauvais | **réel, mais trop petit pour se financer** |

**x402 n'est pas un marché qu'on nous a pris : c'est un marché qui n'a pas notre problème.** Sa
croissance n'est ni une bonne ni une mauvaise nouvelle pour nous — elle est **hors sujet**, et je
n'aurais pas dû la traiter comme un verdict.

Ce qui reste vrai, et qui est le fait dur du dossier : **le marché qui a notre problème vaut
aujourd'hui environ mille dollars par mois.** À 0,05 $ la mission, une commission d'évaluateur
médiane vaut **0,0005 $** — trois ordres de grandeur sous le coût d'une inférence. **La confiance
ne se vend pas encore parce que rien n'a encore assez de valeur pour mériter d'être vérifié.**

D'où la formulation opérationnelle, qui survit à la correction et en sort précisée :

> Notre marché n'apparaît pas quand le **nombre** de transactions entre agents augmente. Il apparaît
> quand se rencontrent **une valeur unitaire suffisante** et **un livrable dont la qualité n'est pas
> évidente à la livraison**.
>
> **L'indicateur à suivre est donc la valeur médiane par transaction, sur les places où le livrable
> est jugeable** — pas le volume, et pas le volume des compteurs d'API.

Et c'est exactement la tranche **10–100 $** qui s'est évaporée le 22 mars : le seul endroit du
marché où les deux conditions étaient réunies.

### Une piste que la correction fait apparaître, et que je n'avais pas vue

Sur x402, **la valeur unitaire monte aussi**, et bien plus vite que sur ACP : les transactions à 1 $
et plus représentaient 49 % du volume début 2025 et **95 % début 2026** (RAPPORTÉ, source unique, à
vérifier). En décembre 2025, **11,7 % des transactions dépassaient déjà 1 $**, et 2,2 % dépassaient
10 $ — soit de l'ordre de **80 000 transactions par mois au-dessus de 10 $**, c'est-à-dire un
plafond qu'ACP n'atteint jamais.

**Attention à ne pas surinterpréter** : la deuxième condition ne suit pas automatiquement. Un appel
d'inférence à 12 $ reste autoévident, et n'a pas plus besoin de nous qu'un appel à 12 centimes. Ce
qu'il faut aller regarder, ce n'est pas le montant : c'est **s'il apparaît sur x402 des services dont
le livrable est jugeable** — audit, recherche, rédaction, analyse. C'est mesurable, et personne ne
le publie.

**Ça devient la question de marché n°1**, devant la reprise d'ACP : *où, aujourd'hui, un agent
paie-t-il plus de dix dollars pour quelque chose qui peut être mal fait sans que ça se voie ?*

C'est aussi ce qui rend la reprise sur v2 intéressante au-delà de sa taille : il faut regarder **si
la valeur unitaire y remonte**, pas seulement le total.

### Je l'ai mesuré. Elle remonte.

| série | dépôts | total | **médiane** | moyenne | max |
|---|---:|---:|---:|---:|---:|
| v1 — 2026-02 (pic subventionné) | 304 846 | 1 161 073 $ | **0,75 $** | 3,81 $ | — |
| v1 — 2026-03 | 368 828 | 1 039 223 $ | **0,20 $** | 2,82 $ | — |
| **v2 — 2026-04** | 1 349 | 156,50 $ | **0,01 $** | 0,116 $ | 10,00 $ |
| **v2 — 2026-05** | 7 013 | 302,96 $ | **0,01 $** | 0,043 $ | 10,00 $ |
| **v2 — 2026-06** | 2 358 | 770,21 $ | **0,05 $** | 0,327 $ | 10,00 $ |
| **v2 — 2026-07** | 3 460 | 1 072,11 $ | **0,05 $** | 0,310 $ | 10,00 $ |

**La mission médiane sur v2 a quintuplé entre mai et juin (0,01 → 0,05 $) et s'y tient depuis deux
mois. La moyenne fait ×7.** C'est le signal que ce dossier désignait comme le bon, et il est
positif.

**Trois réserves, pour que tu le lises correctement :**

1. On reste **quinze fois sous la médiane du pic subventionné** (0,05 contre 0,75 $), et très loin
   du seuil où une vérification se finance.
2. **Deux points de mesure ne font pas une tendance.** Juin et juillet, c'est tout.
3. **Le maximum est exactement 10,00 $ tous les mois** — c'est un plafond, pas un marché. Tant qu'il
   tient, aucune mission de valeur ne peut passer par v2, et notre seuil ne peut pas être franchi
   sur cette place. **À élucider : plafond de configuration, ou limite du protocole ?** C'est
   devenu la question technique la plus importante pour nous.

---

## 8. Ce que je ferais ensuite, par ordre d'utilité

0. ⭐ **Chercher, sur x402, les services dont le livrable est jugeable** — audit, recherche,
   rédaction, analyse — et mesurer leur valeur unitaire. C'est la question que fait apparaître ton
   objection, et elle passe devant tout le reste : là est le seul endroit où les deux conditions du
   §7 pourraient se rencontrer à une échelle qui compte. **Personne ne publie cette décomposition.**
1. ✅ **Fait dans ce dossier** : la médiane v2 a quintuplé (0,01 → 0,05 $) et tient depuis deux mois.
   **À reprendre chaque mois** — c'est notre indicateur d'entrée sur ACP.
2. **Élucider le plafond de 10,00 $ sur v2.** Aucun dépôt ne le dépasse, quatre mois de suite. Si
   c'est une limite de configuration levable, la place peut porter notre marché ; si c'est
   structurel, elle ne le pourra jamais et il faut regarder ailleurs. **C'est devenu la question
   technique n°1.**
3. ⚠️ **Essayé le 05/08, NON CONCLU** — le distributeur Merkle n'a pas été retrouvé : les deux
   candidats sérieux se sont révélés être de l'infrastructure générique (1,43 md$ / 52 434
   destinataires, et 79 M$ multi-jetons / 65 502 destinataires). **Pour fermer la piste** : localiser
   la transaction de 1 803,81 USDC de notre fiche du 03/08, dont l'adresse n'avait pas été notée.
4. ⭐ **Mesurer l'ampleur de la circulation HORS séquestre** — la vraie découverte du 05/08. Le cas
   `0x0e59260d…` montre **174 938 $ tournant entre les portefeuilles d'un seul opérateur en 75
   virements**, totalement invisibles à une mesure faite sur le séquestre. Généraliser aux 211
   flottes donnerait la part réelle de volume fabriqué. Lourd, et c'est la mesure qui manque à tout
   le monde — y compris à Virtuals.
5. ✅ **Nommé** (§4bis) — fin de l'Epoch 5 du programme aGDP. **Reste à faire** : retrouver la page X
   originale de `@virtuals_io` plutôt que son miroir, et une source officielle donnant la fenêtre
   exacte de l'Epoch 5. Tant que ces deux pièces manquent, c'est une inférence forte, pas un fait
   établi.
4. **Établir une série datée récurrente** sur v2 et sur x402. Nous serions les seuls à publier la
   valeur unitaire, et c'est la mesure qui commande notre calendrier d'entrée.

## 9. Ce que ce dossier ne dit pas

- Il ne prouve pas que le Revenue Network a causé la bulle. Il montre une coïncidence de date, de
  taille et de composition du registre qui rend l'hypothèse forte — pas une preuve de causalité.
- Il ne prouve pas que la coupure du 22 mars vient du programme. **La cause reste inconnue.**
- Il ne mesure pas x402 par nos soins : **tous** les chiffres x402 sont RAPPORTÉS, pas MESURÉS, et
  proviennent de sources dont l'une (BlockRun) est partie prenante du marché qu'elle décrit. La
  décomposition par catégorie date de décembre 2025 et porte sur le **nombre de services**, pas sur
  le volume. **À refaire nous-mêmes avant tout usage engageant.**
- Il ne prouve pas qu'aucun commerce entre agents ne passe par x402 — il montre que les vendeurs
  qui dominent son volume sont des passerelles d'API et de données, et qu'aucune source publique ne
  sépare les deux. **L'absence de catégorie n'est pas l'absence du phénomène.**
- La reprise sur v2 fait trois mois. Ce n'est pas encore une tendance.

## 10. Reproduire

Tout est on-chain sur Base, nœud public `mainnet.base.org`, sans clé, USDC
`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, événement `Transfer`, tranches de 10 000 blocs.

| contrat | adresse |
|---|---|
| ACP v1 (appelé par les agents) | `0xa6C9BA866992cfD7fd6460ba912bfa405adA9df0` |
| **coffre v1 (détient l'USDC)** | `0xef4364fe4487353df46eb7c811d4fac78b856c7f` |
| ACP v1-bis | `0x6a1fe26d54ab0d3e1e3168f2e0c0cda5cc0a0a4a` |
| **ACP v2 Core** (détient l'USDC lui-même) | `0x238E541BfefD82238730D00a2208E5497F1832E0` |

**Deux pièges qui m'ont eu aujourd'hui, dans cet ordre :**

1. Le nœud public **perd des tranches en silence** sous limite de débit. Un `catch` vide transforme
   un sous-total en total.
2. **Commencer par le changelog de l'éditeur, pas par la chaîne.** Un contrat qu'on ne connaît pas
   ne se voit pas dans les données qu'on a déjà.

Fiches sous-jacentes : `market-intel/mesures/2026-08-04-le-sequestre-acp-de-1-16-million-a-neuf-dollars.md`,
`…-inspector-by-auraa-largent-va-dans-lautre-sens.md`,
`…-erc-8004-sur-base-la-liste-des-validateurs-est-vide.md`.
