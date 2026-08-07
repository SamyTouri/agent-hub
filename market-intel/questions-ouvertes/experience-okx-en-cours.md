---
title: Expérience OKX.AI en cours — état au 2026-08-07, tâche publiée en attente d'acceptation
type: question-ouverte
statut: EN COURS — une tâche payante est publiée et attend le prestataire. À reprendre.
updated: 2026-08-07
---

# Où en est l'expérience OKX.AI, et comment la reprendre

Nous sommes **entrés dans OKX.AI comme acheteur** et une **tâche payante est publiée, en attente
d'acceptation par le prestataire**. Ce fichier existe pour que l'expérience ne se perde pas entre
deux sessions ou entre deux agents. Mesures déjà obtenues :
[[../mesures/2026-08-06-okx-ai-mesure-on-chain-independante]] · contexte : [[../acteurs/okx-ai]].

## 1. Notre identité sur la place

| | |
|---|---|
| Agent | **#10579 — « Agent Reputation »**, rôle **User** (acheteur) |
| Portefeuille | `0xde4dee2e35c2c9fb15a552498a23d6587b7b29cc` (X Layer, chaîne 196) |
| Adresse de communication | `0xd0fdFb2db2331131Dae457a4C36DC8b7Cc095CF4` |
| Enregistrement on-chain | tx `0x9aa885ae61c45547b859951a57d6f5c308ba06b5346d330a920485cfffe72170`, bloc 67 240 574 |
| Compte | login social Google sur `samy.touri@gmail.com`, via OKX Agentic Wallet |
| Description publique | assume que nous mesurons et publions, **y compris sur OKX.AI** |

**Solde au 07/08** : **5,00389 USDT** et **6,221639 USDG** sur X Layer. Origine : 10 € d'USDG
achetés sur OKX Europe (une tentative refusée par la banque, la seconde passée), retirés sur
X Layer, puis 5 USDG convertis en USDT — conversion **imposée**, aucun vendeur n'acceptant l'USDG.

## 2. La tâche en attente

| | |
|---|---|
| jobId | `0xf450b20c5544fd42aa099cfc82e224f1428380b3a9bf7718c97eccaf20034879` |
| Titre | *Verify four measured claims about the agent economy* |
| Prestataire | **Janus Research & Audit #3895**, service *Research Claim Verification* |
| serviceId | `31225e8d-3968-4ecd-b05f-0674c5921170` |
| Prix | **0,10 USDT**, mode **escrow** |
| Publication | tx `0x9bd753da4891ecc049e6353f917cadcfa35a03a3fe039c5f67fe235c190e8741`, bloc 67 245 265 |
| **Statut** | **`created`** — le prestataire n'a pas encore accepté |
| Fonds engagés | **aucun** — la publication ne finance pas l'escrow |

**Contenu commandé** : la vérification de quatre affirmations **dont nous connaissons déjà la
réponse mesurée** (volume cumulé OKX.AI ~4 042 $ ; absence de route de pont vers X Layer ; stake
évaluateur de 100 OKB ; contrat et décimales de l'USDG). C'est le cœur de la méthode : **on ne
peut juger objectivement un livrable jugeable que si l'on détient la vérité terrain.** Un rejet
éventuel sera donc légitime et documentable, jamais arbitraire.

## 3. Ligne de base du prestataire — à comparer après coup

| | valeur au 07/08, avant notre tâche |
|---|---:|
| Ventes affichées (`soldCount`) | **11** |
| Solde USDT on-chain (`0x3a604b5f…aa8d`) | **6,00005** |
| Avis | 100 % positifs |
| Créé le | 2026-07-04 |
| Statut | en ligne, « Listed — eligible for task recommendations » |

**C'est l'étalonnage** : si la tâche aboutit, on saura au centime près ce qu'il encaisse et si son
compteur de ventes bouge. Ligne de base plateforme prise juste avant publication : volume
**4 042,51162 $**, `tasksPosted` **14 112**, `tasksCompleted` **9 429**, `tasksOpen` **625**.

## 4. Les deux issues, toutes deux informatives

- **Il accepte** → financer l'escrow (**geste réservé à Samy**), recevoir le livrable, le juger
  contre notre vérité terrain, accepter ou rejeter. Un rejet ouvrirait l'arbitrage par évaluateurs
  stakés — le mécanisme le plus original de cette place, que personne n'a documenté de l'extérieur.
- **Il ne réagit jamais** → l'offre expirera. Un prestataire en ligne, noté 100 %, « éligible aux
  recommandations », qui ne répond pas à une commande payante : c'est exactement l'écart
  vitrine/réalité que notre couche documente. **Mesurer alors le délai d'expiration.**

## 5. Où vivent les outils — hors de ce dépôt

L'installation est **volontairement cloisonnée dans `C:\Dev\OKX-Lab`**, hors de tout dépôt git,
pour ne polluer ni AgHub ni les autres projets :

- 4 skills sur 9 installées en *project-level* (`okx-guide`, `okx-agentic-wallet`, `okx-ai`,
  `okx-agent-payments-protocol`) — les skills DeFi, DEX et compétitions ont été écartées ;
- CLI `onchainos` v4.4.6 dans `%USERPROFILE%\.local\bin` (+ `okx-pilot.exe`, téléchargé
  silencieusement lors d'une cotation de swap) ;
- identifiants de session dans `%USERPROFILE%\.onchainos` — **chiffrés** (`keyring.enc`), aucune
  clé privée sur disque : le portefeuille est à exécution distante côté OKX.

**Pour reprendre l'expérience**, ouvrir une session dans `C:\Dev\OKX-Lab` (les skills n'y sont
actives que là) :

```powershell
$env:PATH = "$env:USERPROFILE\.local\bin;$env:PATH"
onchainos agent status 0xf450b20c5544fd42aa099cfc82e224f1428380b3a9bf7718c97eccaf20034879
onchainos agent tasks          # nos tâches
onchainos wallet balance       # nos soldes
```

## 6. Défauts de l'outillage rencontrés — à ne pas re-diagnostiquer

- **`okx-a2a` est absent et introuvable.** Le CLI tente de l'invoquer à chaque publication de
  tâche (`spawn okx-a2a failed: program not found`) ; il n'est **ni documenté ni installable**
  dans le dépôt officiel. Un acheteur suivant le tutoriel officiel a donc le **canal de dialogue
  agent-à-agent cassé**, sans avertissement. N'affecte pas la publication on-chain.
- `agent search` et `cross-chain tokens` **ignorent leurs propres filtres** — filtrer côté client.
- `agent status` prend le jobId en **argument positionnel**, pas en option.
- Le trousseau Windows échoue à l'écriture → repli fichier (contenu chiffré, sans gravité).

## 7. Frontières tenues, et à tenir

- **Claude n'exécute aucun mouvement de fonds** : ni paiement, ni swap, ni financement d'escrow.
  Il prépare, vérifie et mesure ; Samy exécute. Règle projet, respectée sans exception ici.
- Claude n'a créé **aucun compte** et n'a saisi **aucun identifiant** : login social fait par Samy
  dans son navigateur, phase `init` / `poll` seulement côté CLI.
- L'acceptation des conditions OKX a été faite **sur validation explicite de Samy**, après lecture.

Voisin : [[../mesures/2026-08-06-okx-ai-mesure-on-chain-independante]] · [[../acteurs/okx-ai]] ·
[[../syntheses/2026-08-05-vision-globale-marche-agent-a-agent]]
