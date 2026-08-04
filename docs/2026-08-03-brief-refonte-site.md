> # ⛔ SUSPENDU — NE PAS EXÉCUTER
>
> **Décision de Samy, 2026-08-03**, le jour même de la rédaction : la refonte est **prématurée**.
> Un beau site figerait des choix de positionnement qui ne sont pas faits, et créerait de la dette
> de modification en aval. L'effort va à **la définition de la proposition de valeur et au contact
> direct avec les acteurs de terrain**.
>
> Ce document est conservé pour son raisonnement, pas pour être suivi. **Au plus, aujourd'hui :**
> un changement de couleurs et une page propre pour un premier article — rien de la refonte
> décrite ci-dessous.
>
> Ne le reprendre que sur instruction explicite de Samy.

---

# Mission Codex — refonte visuelle et éditoriale d'agentreputation.dev

Rédigé le 2026-08-03. Destinataire : Codex. Émetteur : Samy, via Claude.

**Avant de commencer, lis `market-intel/index.md`** — sa table de routage te dit quelle fiche
répond à quelle question. C'est là que vivent les mesures qui doivent transparaître dans le ton du
site, avec leurs réserves. Ne reprends aucun chiffre sans ouvrir la fiche qui le porte : plusieurs
ont été corrigés le 2026-08-03 et une version de mémoire serait fausse.

---

## 1. Ce que tu fais, en une phrase

Tu refais **l'identité visuelle et l'architecture de pages** du site public
`agentreputation.dev` pour qu'il se lise comme **un cabinet d'analyse indépendant**, avec deux
publics nettement séparés — les humains et les agents — et une **page d'articles** qui devient la
vitrine de notre crédibilité.

**Tu ne touches ni à la doctrine, ni à la base de connaissance marché, ni au moteur de preuves.**
Périmètre strictement interdit, listé au §7.

---

## 2. Le contexte que tu dois comprendre avant de dessiner

Agent Reputation vend **une seule chose** : la capacité à dire à un acheteur ce qu'un vendeur
livre **réellement**, avant qu'il s'engage. Tout le reste en découle.

Ce qui nous distingue est mesurable, et voici les trouvailles récentes qui doivent transparaître
dans le ton du site (les chiffres exacts et leur formulation te seront fournis par Samy — **ne les
invente pas, et ne les écris pas de mémoire**) :

- Nous frappons aux portes. Sur les vendeurs de confiance d'une grande place de marché, **deux
  tiers des points d'accès publiés ne répondent pas**.
- Nous datons les promesses. Un vendeur affiche « en ligne, 99,8 % de disponibilité, dernier scan
  il y a 2 minutes » alors que son serveur refuse toute connexion depuis des mois.
- Nous corrigeons en public. Quand une de nos mesures est fausse, la correction est publiée, datée,
  avec la méthode.

**Le ton du site doit être celui-là : mesuré, précis, sans esbroufe, et pas neutre — nous prenons
position et nous signons.**

---

## 3. Les deux interfaces

### 3.1 L'interface humaine — c'est elle qui doit être travaillée

Public : un dirigeant, un fondateur, un responsable technique qui envisage d'acheter un service
rendu par un agent, ou qui veut comprendre ce marché.

**Ce qu'il doit obtenir, dans cet ordre et sans effort :**

1. **En moins de dix secondes** : ce que nous faisons. Une accroche courte, humaine, sans jargon
   crypto. Pas « registre cross-registre de preuves » — quelque chose comme *« nous mesurons ce que
   les agents livrent vraiment »*.
2. **L'existence du bureau des plaintes**, présenté comme un service **gratuit, sans compte**,
   ouvert à toute partie à une transaction réglée — acheteur **ou** vendeur.
3. **Une invitation forte vers la page d'analyses**, avec inscription à la lettre d'information.

**Un visage.** Samy apparaît sur le site : photo, nom, une ligne sur qui il est. C'est un choix
délibéré et c'est notre différence — dans ce secteur, personne ne signe. Prévois un emplacement
digne pour ça, pas une vignette perdue en pied de page. Prévois aussi un lien discret vers ses
autres activités.

### 3.2 L'interface agent — sobre et fonctionnelle

Public : un agent logiciel ou son développeur.

Une page dédiée, **dense, sans décoration**, qui liste : les points d'accès machine, la carte
d'agent, le serveur d'outils, les trois outils de plainte, et comment déposer un dossier par
signature. Un humain peut y arriver, mais elle n'est pas conçue pour lui.

**Les deux interfaces doivent être atteignables l'une depuis l'autre en un clic**, avec un
basculement explicite et visible.

---

## 4. La page d'analyses — le nouveau centre de gravité

C'est la nouveauté la plus importante de cette refonte.

- Une page **liste** des articles : titre, date, une phrase de résumé, temps de lecture.
- Une page **article** soignée, lisible, faite pour un texte long avec tableaux de chiffres et
  citations. La typographie de lecture est ici plus importante que partout ailleurs.
- Un bloc d'**inscription à la lettre d'information**, présent sur la liste et en fin d'article.
- Chaque article porte **sa date et son auteur**, et un espace visuel prévu pour une **note de
  correction datée** — nous corrigeons en public, le gabarit doit le rendre naturel plutôt que
  honteux.

**Ne copie ni The Agent Times ni AgentNews.** Ce sont des fils d'actualité automatisés à haut
volume. Nous publions **peu et mesuré**. La page doit donner l'impression d'un cabinet qui publie
une note tous les quinze jours, pas d'un robot qui publie quarante fois par jour.

---

## 5. Direction graphique

**La contrainte principale, et elle est ferme : pas de blanc sur fond noir.** Le fond sombre est
devenu l'uniforme de tout ce secteur. S'en écarter est en soi une prise de position.

- **Couleurs vives et joyeuses, mais peu nombreuses.** Une couleur d'accent affirmée, une
  secondaire, et des neutres chauds. Pas de dégradés néon, pas d'esthétique « terminal ».
- **Fond clair ou teinté**, pas blanc pur — un blanc cassé, un crème, un pastel très désaturé.
- **Sérieux par la typographie et l'espace**, pas par l'austérité. Une belle fonte de titrage avec
  du caractère, une fonte de lecture confortable, des marges généreuses.
- **Les chiffres sont notre produit** : prévois un traitement graphique soigné pour un nombre isolé
  et pour un tableau de mesures. C'est ce que les visiteurs viendront regarder.
- Accessibilité : contrastes conformes, taille de texte confortable, navigation au clavier.
- **Thème sombre en option**, jamais par défaut.

Propose **deux directions distinctes** avant de développer, et laisse Samy choisir.

---

## 6. Contraintes techniques — impératives

### 6.1 Quota Vercel — le piège du jour

Le projet a reçu le 2026-08-02 une alerte à **75 % du quota gratuit d'écritures ISR
(200 000/mois)**. Une correction a été appliquée le 2026-08-03 en allongeant plusieurs fenêtres de
régénération.

**Donc : n'introduis aucune page avec un `revalidate` court.** Toute nouvelle page doit être
statique, ou avoir un `revalidate` d'au moins **1800 secondes**. Si tu crois avoir besoin de plus
frais, demande avant.

Le catalogue d'agents utilise `force-dynamic` **volontairement**, avec un cache CDN de sept jours
et une purge par étiquette. **Ne le convertis pas en ISR** — c'est ce qui avait épuisé le quota en
juillet.

### 6.2 Les tests de doctrine doivent rester verts

`scripts/doctrine-boundary.test.mts` impose des contraintes de **contenu**, pas seulement de style.
Lis-le avant de commencer. En résumé :

- Le mot **`complaint`** doit apparaître sur `app/page.tsx`, `README.md`, `public/llms.txt`,
  `agent-card.json`, `server.json` et `skills/agentreputation-dev/SKILL.md`.
- Les trois outils **`check_complaints`, `file_complaint`, `complaint_bureau`** doivent être
  annoncés dans `agent-card.json`, `app/page.tsx`, `README.md`, `public/llms.txt`.
- La page `/owners` doit garder `t.bureauTitle`, `t.bureau`, `t.complaintsLabel`, un lien vers
  `/complaints`, et **exactement 13 occurrences** de chacun de ces champs dans `lib/owners-i18n.ts`
  (le type plus douze langues). **Si tu ajoutes une langue, ajoute-la partout.**
- Les formules interdites, qui ne doivent réapparaître nulle part : *agent discovery*, *discovery
  across 16k+*, *make yourself discoverable*, *Discover candidate agents*, *find work*, *ratings
  make the network trustworthy*.
- Le mot **`compatibility`** et la formule **« not a recommendation »** doivent rester présents.

### 6.3 Interdits de doctrine

- **Aucun score, aucune note, aucun classement, aucun palmarès.** Nulle part, même décoratif.
- **Ne présente jamais un nombre que nous avons calculé comme un fait.** Un chiffre publié porte sa
  source, sa date et sa méthode.
- Le catalogue est une **surface de compatibilité**, jamais un produit ni une recommandation.

### 6.4 Porte de sortie obligatoire

`npm run typecheck`, `npm test` (452 tests) et `npm run build` **verts** avant toute livraison.
`agent-card.json` et `public/.well-known/agent-card.json` doivent rester **identiques** — le build
échoue sinon.

---

## 7. Périmètre interdit

**Ne touche à aucun de ces éléments** — ils sont pilotés ailleurs et une modification créerait un
conflit :

- `docs/DOCTRINE.md`, `AGENTS.md`, `CLAUDE.md`
- `market-intel/` — la base de connaissance marché, en cours de construction
- `server.json` — toute modification déclenche une republication automatique au registre public
- Le moteur de preuves : `lib/canonical-capture.ts`, `lib/endpoint-probe.ts`, `scripts/complaint-*`
- Les routes d'API existantes et le schéma de base de données
- Les crons de `vercel.json`

Si la refonte exige de toucher l'un d'eux, **arrête-toi et demande**.

---

## 8. Livraison attendue

1. **D'abord** : deux directions graphiques distinctes, en maquette, sans code de production.
2. Après validation de Samy : l'implémentation, avec les tests verts.
3. Un court document disant ce que tu as changé, ce que tu as volontairement laissé, et ce sur quoi
   tu as hésité.

Travaille sur une branche dédiée. Ne pousse pas sur `main`.
