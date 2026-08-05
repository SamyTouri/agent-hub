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
| **Pourquoi ?** | Un programme de subvention de 1 M$/mois lancé le 12 février a multiplié le volume par 20. Quelque chose l'a interrompu dans la nuit du 22 au 23 mars. **La cause exacte n'est pas établie** — je sais quoi, quand et comment, pas encore pourquoi. |
| **A-t-il été remplacé ?** | **Oui, partiellement.** ACP v2 tourne depuis avril sur un nouveau contrat. Il fait 1 072 $ en juillet et **il croît de 39 % par mois**. |
| **ACP est-il encore l'essentiel du marché ?** | **Non, et de très loin.** x402 a réglé 41,2 M$ contre 3,6 M$ pour ACP en cumul, et x402 croît. ACP fait aujourd'hui **~0,1 % du volume quotidien de x402**. |
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

### Ce que j'ai cherché et NON trouvé — c'est important

L'hypothèse évidente est le lavage : des agents d'un même propriétaire se payant entre eux pour
fabriquer du volume. **Je l'ai testée et elle est fausse à cette échelle.** En mappant chaque
déposant et chaque bénéficiaire vers son propriétaire ACP, l'argent qui revient au même
propriétaire ne représente que **2,7 %** du volume de la période subventionnée.

Autre chose que je n'explique pas : le premier déposant a mis **77 920 $** dans le séquestre et n'en
a reçu que **11 569 $**. Il perd 66 000 $. Ça n'a de sens que si le gain est **ailleurs** — dans le
programme de récompenses, versé hors séquestre. **Je n'ai pas vérifié ce point**, et c'est la
première chose à faire pour clore le dossier.

### Et ce que je ne sais toujours pas : la date du 22 mars

Le changelog officiel de Virtuals a une entrée le **10 mars** (bascule job privé) et une le
**18 mars** (paliers d'abonnement). **Rien le 22 ni le 23.**

Donc : je sais **quoi** (la tranche 10–100 $), **quand** (nuit du 22 au 23 mars), **comment**
(brutalement, sur des milliers d'adresses), et **dans quel contexte** (six semaines après le
lancement d'un programme de la taille du volume observé). **Je ne sais pas nommer l'événement.**

Les hypothèses restantes, par ordre de vraisemblance :

1. **Fin, épuisement ou resserrement du budget du Revenue Network** — cohérent avec la forme, la
   date à six semaines, et la sélectivité par montant. **Non confirmé.**
2. **Changement de règles d'éligibilité** (anti-farming) non consigné au changelog public.
3. **Décision interne non annoncée** — plafond atteint, ou coupure après détection d'abus.

Les deux explications que j'ai pu **écarter par la mesure** : ce n'est pas un gros acteur qui part
(6 580 déposants, le premier ne pèse que 9,8 %), et ce n'est pas une migration de chaîne (§5).

---

## 5. A-t-il été remplacé ? — oui, partiellement, et c'est la bonne nouvelle

**Sur d'autres chaînes : non.** J'ai vérifié le code des contrats ACP sur Arbitrum, BNB Chain,
Optimism et Polygon : **aucun n'y est déployé**. L'annonce Arbitrum du 24 mars n'a pas de contrepartie
on-chain à ce jour. (En revanche, les registres ERC-8004, eux, sont bien déployés sur Arbitrum, BNB
et Optimism — l'identité voyage, pas le commerce.)

**Sur Base, par ACP v2 : oui.** Nouveau contrat `0x238E541BfefD82238730D00a2208E5497F1832E0`,
déployé en avril, qui détient l'USDC directement (j'ai vérifié le chemin complet de l'argent cette
fois) :

| mois | v2 |
|---|---:|
| 2026-04 | 156,50 $ |
| 2026-05 | 302,96 $ |
| 2026-06 | 770,21 $ |
| **2026-07** | **1 072,11 $** |

**+39 % de juin à juillet, et une croissance sur quatre mois consécutifs.** v1 est mort ; le marché
ne l'est pas. Il a redémarré ailleurs, propre, et petit.

---

## 6. ACP est-il encore l'essentiel du marché ? — non, et pas près de l'être

| protocole | volume réglé | état |
|---|---:|---|
| **x402** (Coinbase) | **41,2 M$** cumulés, **160,8 M** transactions, 7 chaînes, 18 facilitateurs | **en croissance** : ~5 M transactions de plus par mois ; volume de juin doublé par rapport à mai |
| **ACP** (Virtuals) | **3,6 M$** cumulés | **0,1 % de son pic**, en reprise depuis mai |

*(x402 : RAPPORTÉ, agenteconomy.to au 2026-08-05 et Chainalysis. ACP : MESURÉ par nos soins.)*

En rythme quotidien : x402 tourne autour de **28 000 $/jour**, ACP autour de **36 $/jour**. **ACP
fait environ un millième de x402.**

Et le mouvement institutionnel est du côté de x402 : **Visa, Mastercard et Ripple** ont rejoint la
x402 Foundation en juillet 2026.

**Mais la comparaison est trompeuse si on s'arrête là**, et c'est le point le plus important de tout
ce dossier :

> **x402 ne fait que le paiement. Il n'a ni séquestre, ni évaluateur, ni vérification de livraison.**
> Son *facilitator* vérifie une signature de paiement et ne regarde jamais ce qui a été livré.
>
> **ACP, lui, avait la couche de confiance** — séquestre, phase d'évaluation, arbitre payé.
>
> **Le marché a massivement choisi le paiement sans la confiance.**

---

## 7. Était-ce une bulle, et sommes-nous en avance ? — oui, et oui, mais pas comme on l'espérait

### Que c'était une bulle : ce qui l'établit

1. La montée coïncide au jour près avec un programme de subvention de **1 M$/mois**, et elle produit
   un volume **du même ordre de grandeur que la subvention**.
2. **47,9 % du registre** est constitué de flottes d'exactement ~100 agents, **créées en février**,
   dont la plupart n'ont jamais rien fait.
3. La chute est **sélective par montant** et **instantanée** — la signature d'un financement coupé,
   pas d'une demande qui s'érode.
4. Après la coupure, il reste **0,07 % du pic** (778 $ contre 1,16 M$).

**Verdict : oui, une bulle subventionnée, et son ampleur réelle était d'environ un millième de ce
qu'affichaient les compteurs.**

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

Le fait le plus dur du dossier est celui-ci : **entre une place avec séquestre, évaluation et
arbitre payé (ACP) et une place sans aucune vérification (x402), le marché a choisi la seconde à
onze contre un.**

Ce n'est pas un verdict contre la confiance. C'est un verdict sur **le prix auquel la confiance
devient achetable**. La transaction médiane x402 est **sub-dollar** ; la mission médiane ACP des
trente derniers jours vaut **0,01 $**. À ces montants, aucune vérification ne peut se financer :
notre propre mesure du chantier B le dit crûment — une commission d'évaluateur médiane vaut
**0,0005 $**, soit trois ordres de grandeur sous le coût d'une inférence.

**La confiance ne se vend pas parce que rien n'a encore assez de valeur pour mériter d'être
vérifié.**

D'où la formulation opérationnelle que je te propose, et qui est falsifiable :

> Notre marché n'apparaît pas quand le **nombre** de transactions entre agents augmente. Il apparaît
> quand leur **valeur unitaire** franchit le seuil où le coût d'une erreur dépasse le coût de la
> vérification.
>
> **L'indicateur à suivre n'est donc pas le volume, c'est la valeur médiane par transaction.** Et
> c'est exactement la tranche 10–100 $ qui s'est évaporée le 22 mars.

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

1. ✅ **Fait dans ce dossier** : la médiane v2 a quintuplé (0,01 → 0,05 $) et tient depuis deux mois.
   **À reprendre chaque mois** — c'est notre indicateur d'entrée.
2. **Élucider le plafond de 10,00 $ sur v2.** Aucun dépôt ne le dépasse, quatre mois de suite. Si
   c'est une limite de configuration levable, la place peut porter notre marché ; si c'est
   structurel, elle ne le pourra jamais et il faut regarder ailleurs. **C'est devenu la question
   technique n°1.**
3. **Vérifier où atterrissaient les récompenses du Revenue Network.** Suivre les adresses des gros
   déposants perdants : si elles ont reçu des versements d'un distributeur Virtuals, la bulle est
   documentée de bout en bout et ce n'est plus une inférence.
3. **Nommer l'événement du 22 mars** : Discord et annonces Virtuals de cette semaine-là, fils
   Moltbook, et demander directement aux déposants de la tranche 10–100 $ qui ont cessé. La question
   est posée publiquement depuis aujourd'hui.
4. **Établir une série datée récurrente** sur v2 et sur x402. Nous serions les seuls à publier la
   valeur unitaire, et c'est la mesure qui commande notre calendrier d'entrée.

## 9. Ce que ce dossier ne dit pas

- Il ne prouve pas que le Revenue Network a causé la bulle. Il montre une coïncidence de date, de
  taille et de composition du registre qui rend l'hypothèse forte — pas une preuve de causalité.
- Il ne prouve pas que la coupure du 22 mars vient du programme. **La cause reste inconnue.**
- Il ne mesure pas x402 par nos soins : ces chiffres sont RAPPORTÉS, pas MESURÉS. À vérifier
  nous-mêmes avant tout usage engageant.
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
