---
title: Devenir évaluateur — la direction arrêtée par Samy et les quatre chantiers ouverts
type: question-ouverte
statut: DIRECTION ARRÊTÉE, travail non commencé
updated: 2026-08-04
---

# Où on en est, et ce qui reste à faire pour trancher « devenir évaluateur »

Point de reprise écrit le **2026-08-04** en fin de session, sur consigne de Samy. Tout ce qui
précède est mesuré et consigné ; ce qui suit ne l'est pas encore.

**Objectif final annoncé par Samy** : savoir **si et comment devenir évaluateur de façon efficace**,
et pouvoir en tirer **un article détaillé**.

## La thèse d'investissement de Samy — à ne pas re-litiger

Décision de cadrage, 2026-08-04 : **la petitesse du marché n'est pas un problème, c'est la raison
d'y être.**

> *« C'est un marché appelé à croître et y être dès le début pourrait être le début d'un grand gain
> financier. Gagner un premier centime sera peut-être comparable à posséder un bitcoin en 2010. »*

Conséquence directive : **cesser de traiter les petits chiffres comme un signal de renoncement.**
25,05 $ de marché d'évaluateurs, 0,047 $ le verdict, 2,47 $ de revenu lifetime chez [[evallayer]] —
ce sont des mesures d'un marché naissant, pas des verdicts sur sa viabilité. Continuer à les
publier avec la même rigueur, sans en tirer de conclusion défaitiste.

## Ce qui est déjà su et mesuré (ne pas refaire)

- La carte complète des protocoles, leurs règles de paiement et leurs listes :
  [[2026-08-04-marche-des-evaluateurs-tous-protocoles]].
- Les 75 évaluateurs ACP, dont 5 actifs, **25,05 $ pour 532 verdicts**, prix médian affiché 0,01 $.
- Les trois asymétries d'ERC-8183 : [[erc-8183-escrow-et-evaluateur]].
- Le rapport **27 000 pour 1** entre vendre du jugement depuis le siège d'arbitre (25 $) et le
  vendre comme prestation ordinaire (679 310 $, [[2026-08-01-metiers-de-la-confiance]]).
- [[evallayer]] : a tenu le rôle quatre mois, l'a quitté, est enregistré `PROVIDER`.

## Chantier A — Qui est « Inspector by AURAA » et comment il gagne autant

**Le seul évaluateur qui a une vraie activité.** 403 verdicts rendus, 21,95 $ — soit **88 % de tout
le marché des évaluateurs enregistrés à lui seul**, et un prix unitaire de 0,054 $, cinq fois celui
de ses voisins à 0,01 $.

Questions à trancher : qui l'opère, que vend-il exactement, comment ses clients l'ont trouvé (le
registre n'a pas d'appariement), pourquoi il pratique un prix cinq fois supérieur et le tient,
pourquoi il s'est arrêté le 2026-05-27, et si son offre est publiée ou négociée hors bande.

Agent `#8806`, `uniqueBuyerCount: 0` — **anomalie à expliquer** : 403 jobs réussis pour zéro
acheteur unique déclaré. Le champ ment ou ne mesure pas ce qu'on croit.

## Chantier B — Kleros comme modèle produit (idée de Samy, à instruire)

**L'idée**, formulée par Samy le 04/08 :

> *« Nous pourrions devenir un agrégateur d'évaluateurs qui fonctionne de la même façon que Kleros
> (payé si du même avis que la majorité) et nous proposerions cette solution d'évaluation au sein
> d'ERC-8183. »*

**Pourquoi c'est prometteur** : Kleros paie le juré pour avoir **voté avec la majorité finale**, pas
pour avoir approuvé. C'est le seul correctif connu à l'asymétrie qui vide le siège ERC-8183 — et il
est absent de ce marché. Un agrégateur qui présente une adresse unique à ERC-8183 tout en faisant
voter N évaluateurs derrière résoudrait aussi le problème de découverte (le client ne doit connaître
qu'une adresse).

**Ce qu'il faut instruire avant de s'engager, dans cet ordre :**

1. **Le mécanisme Kleros en détail** : sélection des jurés, pondération par mise, escalade
   d'appel, coût réel d'un litige, et ce que devient un vote quand il n'y a pas de majorité claire.
2. **La compatibilité contractuelle** : ERC-8183 désigne **une seule adresse** d'évaluateur, fixée à
   la création, non modifiable. Un agrégateur y entre-t-il naturellement comme contrat, ou faut-il
   un adaptateur ?
3. **D'où vient l'argent qui paie la majorité.** Chez Kleros, les parties paient les frais
   d'arbitrage. Dans ERC-8183, l'évaluateur touche un pourcentage global **et seulement s'il
   approuve** — donc un agrégateur qui paie N votants sur une commission de 5 % versée dans un seul
   cas de figure n'a mécaniquement pas de quoi les payer. **C'est l'objection la plus sérieuse et
   elle doit être traitée en premier.**
4. **La tension avec notre doctrine** : nous avons écrit que nous ne sommes pas un adjudicateur (pas
   de verdict, pas d'arbitrage). Devenir évaluateur agrégé, c'est rendre des verdicts. **Arbitrage de
   doctrine à soumettre à Samy** — voir `docs/DOCTRINE.md` et [[agent-hub-role-evaluateur]] dans la
   mémoire projet, où la question du cumul évaluateur/conseil a déjà été tranchée une fois le 01/08.

## Chantier C — Reconstruire la liste des validateurs ERC-8004

**Autorisé par Samy le 04/08.** Personne ne publie cette liste, elle est reconstructible, et
c'est un actif que nous savons produire.

### Réponse aux deux questions techniques de Samy

**« Sur quelle blockchain aller regarder ? »** — Il n'y en a pas une seule. ERC-8004 précise que
ses trois registres *« can be deployed on any L2 or on Mainnet as per-chain singletons »*. Il faut
donc **d'abord établir où les registres sont effectivement déployés**, chaîne par chaîne, puis
indexer les événements `ValidationRequest` et `ValidationResponse` de chacun. Priorité raisonnable :
**Base** (c'est là qu'opère Virtuals ACP et l'essentiel du marché mesuré) puis **Ethereum mainnet**.
Un agent peut par ailleurs être enregistré sur plusieurs chaînes, donc le dédoublonnage est un vrai
sujet et non un détail.

**« Les agents qui utilisent 8183 doivent-ils être enregistrés avec un jeton 8004 ? »** — **Non.**
Le frontmatter d'ERC-8183 porte `requires: 20`, c'est-à-dire **ERC-20 uniquement**. ERC-8004 n'est
pas une dépendance : la norme 8183 se contente de le **suggérer** comme moyen de choisir un
évaluateur (*« Use reputation (e.g. ERC-8004) or staking for evaluator selection »*). Les deux
populations sont donc distinctes et **leur intersection est elle-même une mesure à faire** — elle
dirait combien d'acteurs du commerce agent se dotent volontairement d'une identité portable.

### Méthode envisagée

Indexer les événements des registres 8004 déployés, en extraire les adresses de validateurs
distinctes, leur volume de réponses, leur distribution de scores (`response` est un entier 0–100),
et leurs `tag`. Produire la première liste publique de validateurs ERC-8004 actifs.

## Chantier D — L'article

Sortie attendue : un article détaillé sur le marché des évaluateurs. La matière des chantiers A à C
en est la substance. À ne pas rédiger avant que B ait tranché la question du financement des votants.

## Rappel de procédure

Toute publication Moltbook passe par `.exchange/codex/mb-publish-verify.mjs` : publier → résoudre le
défi → relire le statut → **vérifier la présence dans le fil**. Détail et pièges :
[[2026-08-04-la-porte-de-verification-des-deux-cotes]].
