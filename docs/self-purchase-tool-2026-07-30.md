# Brief — outil d'achat de notre propre offre, pour entrer au catalogue x402

> **Provenance.** Promu depuis `.exchange/codex/self-purchase-tool-brief.md` le 2026-08-01, sans modification du corps. Motif : il documente un outil qui dépense de l’argent réel, et cette explication ne devait pas vivre hors du dépôt.

À coller comme premier message d'une conversation Claude Code dédiée, ouverte sur `C:\Dev\AgHub`.
Rédigé le 2026-07-30 en fin de session, après vérification de l'état réel en production.

---

## But

Écrire l'outil qui permet à Samy d'acheter lui-même notre offre pré-engagement, une fois, en
USDC réel sur Base mainnet. Ce paiement n'a pas de valeur commerciale : il sert uniquement à
nous faire entrer dans le catalogue de découverte x402, celui que les agents acheteurs
interrogent avant de payer un vendeur. Ce catalogue n'indexe une ressource qu'**au premier
paiement réellement réglé** par le facilitateur CDP ; il n'existe aucune inscription manuelle.

## État vérifié le 2026-07-30, à ne pas re-découvrir

Tout est déjà prêt côté vendeur. L'offre est active sur Base mainnet (`eip155:8453`), en USDC
natif Circle, à 0,50 USDC. Le défi de paiement réel sert bien les métadonnées de découverte du
catalogue, `method` compris, et la description de la ressource fait 494 caractères sur un
plafond de 500 au-delà duquel le facilitateur refuse le règlement. Interroger
`GET https://agentreputation.dev/api/prepurchase/order` pour confirmer plutôt que de croire ce
paragraphe.

Ne PAS refaire la bascule mainnet : une note de mémoire du 24/07 disait testnet et elle est
fausse, elle a déjà coûté une erreur.

## Ce qui manque, et le modèle à suivre

L'outil d'achat existant vise le vendeur externe de juillet, pas nous :
`scripts/case-002-pay.mts`, `lib/case002-payment.ts`, `scripts/Invoke-Case002.ps1`. Environ six
cents lignes au total. Reprendre sa structure, qui est bonne et éprouvée :

- **Trois actions** : `Preflight` (lecture seule, aucune signature, aucune dépense), `Pay`
  (dépense réelle), `Resume` (rejoue la MÊME autorisation déjà signée après une réponse perdue,
  jamais une nouvelle).
- **Une sentinelle d'exécution** : la dépense n'est possible que si une variable d'environnement
  vaut une phrase exacte, en plus du drapeau d'action. Un outil de dépense ne doit pas pouvoir
  partir sur une faute de frappe.
- **Secret-blind strict** : la clé du portefeuille va du coffre à l'environnement du processus
  enfant sans jamais transiter par une sortie, un journal ou le modèle. Les clés sont au
  catalogue Bitwarden sous `CDP_AGENTHUB_API_KEY_ID`, `CDP_AGENTHUB_API_KEY_SECRET` et
  `CDP_AGENTHUB_WALLET_SECRET`.

## Règle de rôle, non négociable

**Tu écris l'outil, tu ne l'exécutes pas en mode dépense.** Envoyer des fonds, y compris de
Samy vers Samy, est hors de ce que tu réalises même sur autorisation explicite. Tu lances le
préflight, tu vérifies tout ce qui est vérifiable sans dépenser, tu donnes la commande exacte,
et Samy la lance. Ne pas contourner, ne pas proposer de contourner.

## Définition de fini

Le préflight passe et affiche ce qu'il a vérifié : réseau, actif, montant, adresse
d'encaissement, présence des métadonnées de découverte, et solde du portefeuille acheteur s'il
est lisible. La commande de dépense est prête et documentée en une ligne. Rien n'a été dépensé.

Prévoir aussi la vérification d'après-coup, parce qu'elle est le seul moyen de savoir si ça a
marché : après le règlement, contrôler que la transaction est confirmée, puis que le catalogue
nous liste — l'indexation prend jusqu'à six heures et un échec de métadonnées ne produit
**aucune erreur nulle part**.

## Réserve à répéter à Samy

Le classement du catalogue se joue sur le nombre d'acheteurs **distincts**, le nombre de
paiements et la fraîcheur, sur trente jours. Un achat qu'on se fait à soi-même nous fait entrer
avec un acheteur unique qui est nous. C'est nécessaire — on ne peut pas être trouvé avant
d'exister — mais ça n'apporte pas de visibilité tant qu'un tiers réel n'a pas acheté.

Terminer par les sections obligatoires : `SUMMARY`, `OPINIONS & DISAGREEMENTS`,
`REFUSED ACTIONS`, `FILES TOUCHED`, `SUGGESTED NEXT`.
