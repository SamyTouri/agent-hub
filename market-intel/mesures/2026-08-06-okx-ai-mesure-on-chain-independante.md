---
title: OKX.AI mesuré on-chain — le vendeur le plus visible encaisse 0,04 $ en 83 minutes
type: mesure
statut: MESURÉ par nous (X Layer RPC public + challenges x402 publics), le 2026-08-06 — réserves en §6
updated: 2026-08-06
---

# Ce qu'OKX.AI affiche, et ce que la chaîne montre

Première vérification **indépendante** des compteurs d'OKX.AI, menée le 2026-08-06 à la demande
de Samy — exécution de l'expérience §16.5 de l'audit Codex ([[../acteurs/okx-ai]]), qui n'avait pu
lire que les surfaces publiques de la plateforme. **Aucune dépense, aucun compte créé, aucune
transaction émise** : tout ci-dessous est de la lecture publique.

Réponse aux questions ouvertes §17 de l'audit, en partie.

## 1. Le fait central

| | |
|---|---:|
| **PixelBrief**, vendeur vitrine d'OKX.AI, usages affichés | **21 711** |
| Son solde réel en USD₮0 sur X Layer | **4,78 $** |
| Ce qu'il a encaissé pendant 83 minutes de chaîne observées en continu | **2 paiements × 0,02 $ = 0,04 $** |

Extrapolé, ce rythme donne ~35 paiements par jour, contre **~395 usages par jour** affichés depuis
sa création (21 711 usages / 55 jours). **Écart d'un facteur ~11 entre le compteur d'usages et les
paiements observables sur la chaîne.** Le second vendeur testé, Barker Yield Agent (358 usages),
détient **1,02 $**.

Ce n'est pas un marché fictif : **les paiements existent, ils sont réels et vérifiables**. Ils sont
simplement d'un ordre de grandeur inférieur à ce que la vitrine suggère.

## 2. Ce qui est vérifiable de l'extérieur — et qui est à porter au crédit d'OKX

Trois ancrages tiennent l'épreuve, sans compte ni permission :

1. **Le challenge x402 s'obtient sans aucun compte OKX.** Les endpoints sont hébergés par les
   vendeurs eux-mêmes (`mcp.barker.money`, `pixelbrief.tech`), pas par OKX. Un `GET` non payé
   renvoie un `402` complet : réseau, actif, montant, destinataire, domaine EIP-712.
2. **Le destinataire du challenge est exactement l'adresse publiée au catalogue.** Pour Barker,
   `payTo = 0x83f1…4c9f = ownerAddress`. La vitrine et la chaîne désignent le même bénéficiaire :
   c'est contrôlable par un tiers, et c'est plus que ce que font la plupart des places mesurées.
3. **L'identité ERC-8004 existe réellement.** La `registryTx` de PixelBrief est retrouvée sur
   X Layer, statut succès, 6 logs, bloc 65 184 773 — via l'EntryPoint ERC-4337
   `0x0000…a032`. Le registre `0x8004a169…` porte 130 octets de bytecode (proxy).

## 3. L'architecture réelle : tous les agents partagent le même portefeuille

`eth_getCode` sur les adresses d'agents renvoie **23 octets commençant par `0xef0100`** — une
délégation **EIP-7702**. Les deux agents testés délèguent vers **la même implémentation**
`0xe40ccb2d94975c51bff0c004efdfd9b3a5796fa4` : l'Agentic Wallet d'OKX.

Conséquence directe, et **correction d'une erreur que j'ai failli commettre** : le nonce EOA et le
solde de gas de ces adresses **ne mesurent rien** de l'activité de l'agent (les UserOperations
passent par l'EntryPoint et un paymaster). Le premier relevé — « 8 transactions sortantes, 0 OKB »
— a été écarté pour cette raison. Seul le **solde du token** et les **transferts observés** sont
retenus.

C'est aussi la confirmation technique de l'intégration verticale décrite par l'audit : ces agents
n'ont pas de portefeuille indépendant, ils ont le portefeuille d'OKX.

## 4. La barrière d'entrée : le rail est captif de X Layer

Le challenge exige `network: eip155:196` (X Layer) et l'actif **USD₮0**
`0x779ded0c9e1022225f8e0630b35a9b54be713736` (6 décimales). Deux schemes sont proposés : `exact`
et **`aggr_deferred`** (agrégation différée pour les micro-appels).

Notre portefeuille acheteur détient de l'USDC sur **Base**, le réseau où vit l'essentiel de
l'économie x402 mesurée. **Pour acheter un service à 0,02 $ sur OKX.AI, il faut d'abord bridger
vers X Layer** — dont le coût dépasse de plusieurs ordres de grandeur le prix du service.

**C'est la friction concrète de la « fédération d'économies verticales »** annoncée par l'addendum
Codex du 05/08 : l'interopérabilité est revendiquée au niveau des protocoles (x402, ERC-8004,
MPP), et bloquée au niveau du réseau de règlement.

### ⚠️ X Layer est un cul-de-sac d'interopérabilité — MESURÉ le 06/08

Testé avec **l'agrégateur de bridges d'OKX lui-même** (`onchainos cross-chain quote`, lecture
seule), pour faire entrer un stablecoin sur X Layer :

| Depuis | Montant testé | Résultat |
|---|---:|---|
| Polygon | 5 $ puis 20 $ | `Insufficient liquidity` — **aucune route** |
| Base | 10 $ | `Insufficient liquidity` — **aucune route** |
| BNB Chain | 10 $ | `Insufficient liquidity` — **aucune route** |
| Arbitrum | 10 $ | `Insufficient liquidity` — **aucune route** |

Cibles testées : USD₮0 **et** USDG sur X Layer. `routerList` vide dans tous les cas, sans même une
option de transit.

**Conséquence, et elle est structurante : on ne peut pas amener d'argent sur X Layer par un pont.
La voie d'entrée praticable est un retrait depuis l'exchange OKX lui-même.** Un agent financé
ailleurs — c'est-à-dire sur Base, où vit l'essentiel de l'économie x402 — ne peut pas devenir
client d'OKX.AI sans passer par la caisse d'OKX.

Ce n'est donc pas seulement « coûteux » comme on l'écrivait plus haut : c'est **fermé** par les
routes disponibles. Cela ne prouve pas une intention, et un pont tiers hors agrégateur OKX pourrait
exister ; mais du point de vue d'un acheteur qui utilise les outils fournis, l'entrée de capitaux
est monocanal. À rapprocher du volume cumulé de 4 041 $ : une place dont le seul robinet est son
propre exchange.

## 5. Le contexte : l'économie agentique est un grain de poussière sur X Layer

Scan continu de **5 000 blocs (~83 minutes), 0 fenêtre perdue**, tous les transferts USD₮0 :

| | |
|---|---:|
| Transferts USD₮0 observés | **12 815** |
| **Montant médian** | **204,89 $** |
| Transferts ≤ 1,00 $ | 2 773 (21,6 %) |
| Adresses réceptrices distinctes | 1 072 |
| Dont allant à nos deux agents OKX.AI | **2** |

X Layer est un réseau où circulent des centaines de dollars par transfert. Les micro-paiements y
existent, mais **ils ne sont pas agentiques** : les montants les plus fréquents sont 0,0001 $
(302 fois) et 0,01 $ (203 fois), concentrés dans des **paires payeur→receveur répétitives** — une
seule paire produit 300 transferts identiques de 0,0001 $. Ce sont des bots de distribution, pas
des agents qui achètent des services. Les trois plus gros receveurs de micro-montants sont des EOA
détenant 100 534 $, 6 870 $ et 116 $.

**Conséquence de méthode : compter les micro-transferts d'une chaîne comme de l'activité agentique
serait faux d'au moins un ordre de grandeur.** Le même piège que le volume brut x402
([[../concepts/volume-brut-nest-pas-revenu]]).

## 6. Réserves — ce que cette mesure ne prouve pas

- **Le scheme `aggr_deferred` peut régler hors de notre champ.** Des paiements agrégés puis réglés
  par lots n'apparaîtraient pas comme des transferts unitaires. L'écart usages/paiements de ×11
  est donc un **maximum**, pas une fraude démontrée. Les deux transferts observés étaient bien des
  `exact` à 0,02 $.
- **83 minutes est une fenêtre courte.** Le rythme extrapolé est un ordre de grandeur, pas une
  série. À rejouer pour en faire une tendance.
- **Le RPC public d'OKX plafonne `eth_getLogs` à 100 blocs**, et les six autres RPC X Layer testés
  renvoient 403. L'historique complet d'une adresse est donc **hors de portée** sans clé
  d'explorateur — ce qui est en soi un fait sur l'auditabilité de ce réseau.
- Les soldes ne prouvent pas l'absence de revenu : des fonds ont pu être retirés.

## 7. Ce que l'expérience établit pour notre positionnement

L'expérience visait à mesurer **la profondeur de preuve** offerte à chaque étape. Verdict :

- **Ce qu'OKX rend vérifiable** : l'identité, le bénéficiaire, le prix, le challenge, et les
  paiements `exact` unitaires. C'est réel et c'est mieux que la moyenne du marché.
- **Ce qui reste invérifiable** : le lien entre un `usageCount` et des paiements, la part
  d'agrégation, la part de sampling gratuit, l'identité des payeurs, et **tout l'historique**.
  Un tiers ne peut pas reconstituer ce qu'un agent a réellement encaissé.

**L'écart entre le compteur affiché et la chaîne est précisément l'objet de notre couche.** Il ne
se comble pas avec un score : il se comble en conservant, datées, les observations que la
plateforme n'a pas intérêt à conserver — ici, « 21 711 usages affichés le 06/08 ; 4,78 $ détenus ;
0,04 $ encaissés en 83 minutes ».

## 8. Ce qui reste à faire, et ce qui exige une décision de Samy

- **Rejouer ce relevé** à intervalle régulier pour en faire une série (le volume plateforme est
  déjà passé de **4 035,77 $ le 05/08 à 4 041,58 $ le 06/08, soit +5,81 $ en 24 h**).
- **Achat réel d'un service** : exige de l'USD₮0 sur X Layer, donc un bridge — coût sans rapport
  avec le prix du service. **Décision de dépense, réservée à Samy.**
- **Tâche sous séquestre et rejet légitime** : exigent un compte OKX et un Agentic Wallet.
  **Hors de ce que je peux faire** ; c'est une action de Samy.

## Refaire la mesure

```
RPC        https://rpc.xlayer.tech      (eth_getLogs plafonné à 100 blocs — bissecter)
USD₮0      0x779ded0c9e1022225f8e0630b35a9b54be713736   (6 décimales)
Transfer   0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
PixelBrief 0xe7bbb197827048ba8fa7e908ec871b80568dbc25   (EIP-7702)
Barker     0x83f15f5bea445109e255ab82622fbdfecd1e4c9f
challenge  curl -s https://mcp.barker.money/barker_defi_vaults      → 402 complet, sans compte
état SSR   https://www.okx.ai/agents  puis  #appState  (JSON intégral)
```

**Piège à ne pas répéter** : sur un compte EIP-7702/4337, `eth_getTransactionCount` et le solde de
gas ne mesurent **pas** l'activité. Vérifier `eth_getCode` avant d'interpréter quoi que ce soit.

Voisin : [[../acteurs/okx-ai]] · [[../syntheses/2026-08-05-vision-globale-marche-agent-a-agent]] ·
[[../concepts/volume-brut-nest-pas-revenu]]
