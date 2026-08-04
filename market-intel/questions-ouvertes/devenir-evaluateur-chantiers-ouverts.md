---
title: Devenir évaluateur — les quatre chantiers, traités le 2026-08-04
type: question-ouverte
statut: A, B, C TRAITÉS · D rédigé, non publié · UN ARBITRAGE ATTEND SAMY
updated: 2026-08-04
---

# Où on en est après la session du 2026-08-04 après-midi

Point de reprise réécrit en fin de session. La version précédente (matin) listait quatre chantiers
non commencés ; les trois premiers sont faits, le quatrième est écrit.

**Objectif de Samy** : savoir si et comment devenir évaluateur de façon efficace, et en tirer un
article détaillé.

## La thèse d'investissement de Samy — toujours valable, mais son diagnostic a changé

> *« C'est un marché appelé à croître et y être dès le début pourrait être le début d'un grand gain
> financier. Gagner un premier centime sera peut-être comparable à posséder un bitcoin en 2010. »*

Décision de cadrage non re-litigée : **la petitesse du marché est la raison d'y être.** Publier les
petits chiffres avec rigueur, sans conclusion défaitiste.

**Ce que la mesure du 04/08 après-midi déplace** : on ne peut plus expliquer les petits chiffres par
la jeunesse du marché. Le séquestre ACP a fait **1,16 M$ en février 2026** et **9,56 $ en juillet**.
Ce n'est pas un marché qui n'a pas encore démarré, c'est **un marché qui a eu lieu et s'est
retiré**. La thèse « arriver tôt » devient « arriver après un premier cycle » — position toujours
bon marché, information toujours à personne, mais ce n'est pas le même pari et il faut le dire.

## Réponse courte à la question posée

**Devenir évaluateur ERC-8183 ne peut pas être un plan de revenus** : le siège a versé **0,42 $**
dans toute son histoire. **Mais l'occuper ne coûte presque rien** — une inscription et quelques
centimes de gaz. Les deux décisions doivent être dissociées : prendre le siège est sans regret ;
construire un produit d'évaluation par-dessus attend une source de financement qui existe.

**Devenir validateur ERC-8004 est impossible aujourd'hui** : le registre de validation n'est déployé
sur aucune chaîne principale. Le rôle existe sur le papier seulement. Le dépôt officiel annonce sa
sortie « later this year » — **c'est la date à surveiller**.

## Chantier A — Inspector by AURAA · TRAITÉ

→ [[2026-08-04-inspector-by-auraa-largent-va-dans-lautre-sens]]

- Sa description au registre est le mot `TEST` répété dix fois ; aucune offre publiée.
- Il n'a jamais encaissé une commission. Il a **déposé 41,35 $** dans le séquestre et **récupéré
  19,40 $** en remboursements. Son `grossAgenticAmount` de 21,95 $ est **ce qu'il a perdu**.
- Idem pour Minos, May, Cournot : quatre sur cinq payaient.
- `uniqueBuyerCount: 0` n'est pas un champ cassé — il est exact. Il n'a pas d'acheteur parce qu'il
  **est** l'acheteur.
- « Arrêté le 27/05 » était faux : `lastActiveAt` est une écriture de métadonnée. Vie réelle
  **2026-03-11 → 03-15**, quatre jours.
- **Veri Agent** est le seul jamais payé : 53 × 0,008 $ = **0,42 $**, en une journée.

## Chantier B — Kleros comme produit · TRAITÉ, objection fatale

→ [[2026-08-04-kleros-comme-produit-lobjection-du-financement]]

L'objection mécanique est **rédhibitoire pour le montage tel quel** : chez Kleros les **parties**
paient des frais d'arbitrage à l'ouverture du litige ; ERC-8183 ne lève aucun frais de ce type. Il
n'y a donc pas de caisse à répartir entre N votants — c'est un poste budgétaire absent, pas une
somme insuffisante. S'y ajoute que payer la cohérence contredit être payé sur l'approbation, et que
la commission médiane mesurée vaut **0,0005 $** (gisement total de la plateforme sur 30 jours :
**0,46 $**).

**Ce qui survit** : le principe — payer l'analyse, pas la conclusion — avec sa propre source de
financement, à côté de la transaction. C'est déjà notre montage.

**La compatibilité contractuelle est acquise** : ERC-8183 n'exige pas que l'adresse d'évaluateur
soit un compte externe, un contrat agrégateur s'y inscrit sans adaptateur.

## Chantier C — La liste des validateurs ERC-8004 · TRAITÉ, elle est vide

→ [[2026-08-04-erc-8004-sur-base-la-liste-des-validateurs-est-vide]]

- Le dépôt officiel déploie **deux** contrats sur ~24 réseaux : Identity et Reputation. **Le
  Validation Registry n'est déployé nulle part** ; son README dit la section encore en discussion.
- Vérifié on-chain sur Base, 787 121 événements lus : **`ValidationRequest` 0, `ValidationResponse`
  0, validateurs distincts 0.**
- Population ERC-8004 sur Base : **60 567 agents**, 15 247 propriétaires, **434 995 avis** de 12 405
  clients — et **encore une inscription aujourd'hui**.
- **L'intersection demandée par Samy** : **79 propriétaires ACP sur 8 725 (0,91 %)** possèdent aussi
  une identité ERC-8004. Les deux populations sont disjointes. C'est un plancher, pas une mesure
  exacte (adresses différentes possibles des deux côtés).

## Chantier D — L'article · RÉDIGÉ, non publié

→ `docs/article-evaluator-market-2026-08-04.md`

Anglais, ~2 500 mots, chaque chiffre mesuré, section méthode et reproduction, et un tableau final
des cinq corrections qu'il apporte à nos propres publications.

**Non publié** : il faut décider où (site, Moltbook, les deux) et l'arbitrage doctrinal ci-dessous
touche à ce qu'il annonce de nous.

## ⚠️ CE QUI ATTEND SAMY — arbitrage doctrinal

Notre position publique est **« nous ne sommes pas un adjudicateur »**. Or occuper le siège
ERC-8183, même pour quelques centimes, c'est rendre des verdicts : la norme ne connaît que
`complete` et `reject`, et ils déplacent l'argent.

Trois sorties, détaillées dans [[2026-08-04-kleros-comme-produit-lobjection-du-financement]] §6 :

1. **Séparer les métiers** — le registre de faits ne juge pas, l'agent évaluateur juge, et c'est
   annoncé comme un métier distinct. *(préférence de Claude, parce qu'elle ne réécrit aucune
   promesse déjà publiée et se vérifie de l'extérieur)*
2. **Requalifier la doctrine** — pas adjudicateur *de nos propres dossiers*.
3. **Renoncer au siège** — cohérence maximale, option perdue.

## Ce qui reste ouvert, par ordre d'intérêt

1. **Que s'est-il passé en mars 2026 ?** La rupture est verticale : 1,04 M$ puis 34 k$. C'est la
   forme d'un robinet qu'on ferme. Question posée publiquement le 04/08, sans réponse à ce jour.
   **C'est la question la plus riche du dépôt.**
2. **Séparer ventes et subventions** dans le total de 3,57 M$ — la chute de mars en fait une
   urgence, pas un raffinement ([[deux-grappes-anormales-verification-on-chain]]).
3. **Le registre de validation ERC-8004**, annoncé « later this year ». Population zéro, norme en
   écriture, date annoncée : la configuration exacte du cadrage de Samy. À surveiller comme un
   événement daté.
4. **Affiner l'intersection** en lisant la métadonnée `agentWallet` de chaque inscription 8004.
5. **La commission d'évaluateur peut-elle être versée à l'adresse du propriétaire** plutôt qu'au
   portefeuille de l'agent ? Non vérifié — d'où la formule prudente « aucune commission n'est
   arrivée **sur le portefeuille de l'agent** ».
6. **La retenue de 20 %** observée chez Veri (encaissé 0,424 pour un `grossAgenticAmount` de 0,53) —
   une seule observation, à confirmer.

## Règles de publication apprises ce jour

- **Moltbook n'autorise qu'un billet public par jour.** Mesuré le 04/08 : le second a été refusé
  (`one-public-post-per-day allowance`). Les commentaires ne sont pas soumis à cette limite. Ça
  explique une partie de notre cadence et ça se planifie.
- Toute publication passe par `.exchange/codex/mb-publish-verify.mjs` : publier → résoudre le défi →
  relire le statut → **vérifier la présence dans le fil**.
- L'outil `moltbook_create_post` attend `submolt_name`, **pas** `subreddit`.
- **Payload prêt pour le prochain billet** : `.exchange/codex/mb-payload-post-collapse.json` — la
  chute du séquestre ACP, mois par mois. À publier tel quel.

## Publié le 2026-08-04 après-midi, vérifié et retrouvé dans le fil

- **Correction on-chain** (`76ba932f`) sur notre propre billet : les 25,05 $ étaient de l'argent
  sorti ; le siège a versé 0,42 $. Avec les adresses du contrat et du coffre, et le test qui
  distingue une commission d'un remboursement.
- **Réponse à `botarena-gg`** (`c7a49613`), qui avait bâti son argument sur notre chiffre erroné :
  je retire l'appui empirique que je lui avais fourni, puis je discute le fond — inverser
  l'incitation donne un procureur, pas un tribunal — et je note qu'EvalLayer, qui applique son
  modèle, a gagné 2,47 $ contre 0,42 $ pour le siège. Question ouverte posée en retour.
- **Non traité, à faire** : `credodictum` a posté une analyse sérieuse de l'asymétrie depuis la
  place de l'agent, et se présente comme évaluateur à tarif fixe. **Meilleur candidat identifié pour
  une conversation d'évaluateur à évaluateur.** Non contacté.
