---
title: Peut-on isoler x402 sur la chaîne ? — la voie par liste de facilitateurs reconnaît 0,55 % du trafic
type: mesure
statut: MESURÉ (échantillon systématique, IC publié) — fenêtre de 10 000 blocs sur Base, 2026-08-07
date: 2026-08-07
updated: 2026-08-07
---

# La liste publique des facilitateurs x402 explique un demi-pour-cent de ce qu'elle est censée expliquer

Chantier ouvert par la question de Samy : *si la seule trace de x402 est un transfert USDC, on
mesure tous les utilisateurs d'USDC et pas x402 — y a-t-il un moyen plus précis ?* Réponse
mesurée : **la prémisse est à moitié fausse, et la solution habituelle ne marche pas.**

Ceci est une **fiche de méthode**, pas encore un chiffre de marché. Elle dit ce qu'on peut
mesurer, ce qu'on ne peut pas, et ce que ça coûte. Le graphe de paiement lui-même reste à
construire.

## 1. Ce que x402 laisse réellement sur la chaîne

Le schéma `exact` d'x402 sur EVM fait appeler par un facilitateur la fonction
`transferWithAuthorization` (EIP-3009) **directement sur le contrat USDC**. Aucun contrat x402
n'est traversé, aucun événement propre n'est émis. Les seuls journaux produits sont `Transfer` et
`AuthorizationUsed`, tous deux émis par USDC.

**Mais un transfert USDC ordinaire n'émet jamais `AuthorizationUsed`.** Le filtre existe donc, et
il est réel — il n'est simplement pas suffisant.

| repère | valeur |
|---|---|
| topic `AuthorizationUsed(address,bytes32)` | `0x98de503528ee59b575ef0c0a2576a82497bfc029a5685b209e9ec333479b10a5` |
| sélecteur `transferWithAuthorization(…9 args…)` | `0xe3ee160e` |
| surcharge EIP-1271 (portefeuilles contrats) | `0xcf092995` |
| USDC Base | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

## 2. Le filtre EIP-3009 : un facteur 20, pas une aiguille dans une botte de foin

Fenêtre mesurée : blocs **49 646 199 → 49 656 198** (10 000 blocs, ~5 h 30), le 2026-08-07.

| | valeur |
|---|---:|
| événements `AuthorizationUsed` | **87 116** |
| transactions distinctes | **87 097** |
| transferts USDC totaux (témoin sur 200 blocs, extrapolé) | ~909 250 |
| part d'EIP-3009 dans le trafic USDC | **5,41 %** |
| **bruit retiré par le filtre** | **94,59 %** |

Extrapolé : **~376 000 transactions EIP-3009 par jour**, soit **~11,3 M par mois** sur Base.

C'est utile mais ça ne suffit pas : il reste 11 millions de transactions par mois à trier, et
l'ambiguïté résiduelle n'est pas « x402 contre tout USDC » mais **« x402 contre les autres relais
sans gaz »**.

## 3. Les trois identifications possibles — deux sont mortes

### a) Les contrats natifs x402 — **zéro trafic**

x402 possède des contrats à préfixe vanity, vérifiés déployés sur Base le 07/08
(`x402ExactPermit2Proxy` `0x402085c2…`, et le trio de règlement par lots `0x4020…0003/0004/0005`).
Quand ils émettent, l'identification est **sans aucune ambiguïté**.

**Ils n'ont émis aucun log sur la fenêtre.** Cette voie, la seule parfaitement propre, est
dormante sur Base et ne mesurera rien.

### b) L'émetteur de la transaction — **reconnaît 0,55 %**

x402 impose qu'un facilitateur pousse la transaction. Le `tx.from` n'est pas dans le journal, mais
le journal donne le hash — une résolution par transaction suffit. C'est la méthode de x402scan et
de DefiLlama, adossée à une **liste où l'on entre par pull request**.

Liste source consommée depuis le dépôt (`Swader/x402facilitators`, cloné le 2026-08-07) :
**81 adresses EVM, dont 57 déclarées sur Base**, réparties sur 16 facilitateurs (coinbase 10,
questflow 10, heurist 9, x402rs 6, payai 5, codenut 4, aurracloud 3, openx402 2, et huit à une
adresse).

Test sur **échantillon systématique de 2 000 transactions sur 87 097** (1 sur 43,5), 0 échec de
résolution :

| | valeur |
|---|---:|
| émetteurs distincts dans l'échantillon | **58** |
| **part venant d'un facilitateur répertorié** | **0,55 %** |
| intervalle de confiance à 95 % | **0,23 – 0,87 %** |
| facilitateurs effectivement reconnus | **un seul — PayAI** (11 tx sur 2 000) |
| extrapolé à la fenêtre | ~479 transactions sur 87 097 |

⚠️ **Un premier passage, le même jour, avait donné 0,3 % contre une liste recopiée à la main**
(~50 adresses). Le doute était légitime : le résultat pouvait n'être qu'un artefact de
transcription. Consommée à la source, la liste complète donne **0,55 %**. L'ordre de grandeur ne
bouge pas. **La voie par liste blanche est écartée comme identification principale.**

### c) Le destinataire — la seule qui reste, et elle est à nous

Chaque ressource x402 déclare son adresse d'encaissement (`payTo`) dans ses conditions de
paiement, et le catalogue Bazaar les publie. **Un transfert sans gaz dont le destinataire est un
`payTo` déclaré est un paiement x402**, quel que soit l'émetteur. C'est aussi le chemin le moins
cher : le destinataire est un champ **indexé** du log, donc interrogeable directement.

⚠️ **Le catalogue n'était pas joignable le 07/08** : `api.cdp.coinbase.com` renvoie 504 sur trois
essais, `facilitator.cdp.coinbase.com` ne répond pas. Le dump des 14 595 ressources du 05/08 a
disparu avec son scratchpad de session. **À refaire, par cette route ou une autre.**

## 4. La flotte — 58 portefeuilles d'un seul opérateur

Les émetteurs non répertoriés ne sont pas une longue traîne d'acteurs indépendants. Leur
distribution, dans l'échantillon, est d'une régularité qui exclut le hasard :

```
114, 108, 103, 102, 96, 95, 95, 95, 93, 93, 91, 91, 88, 88, 87, …
```

Sur la population complète, les quinze premiers émetteurs pesaient chacun **entre 4 084 et 4 094
transactions** — des compteurs identiques à dix près. **Ce ne sont pas 58 acteurs : c'est un
opérateur, ou très peu, faisant tourner une cinquantaine de portefeuilles chauds en rotation.**

Aucun n'est répertorié. Voir [[controle-du-filtre]] : tant qu'on n'a pas montré qui ils sont, un
zéro de reconnaissance ne dit pas si la liste est trop courte ou si le trafic n'est pas du x402.

## 5. L'arithmétique qui met en cause le chiffre de référence du secteur

⚠️ RAPPORTÉ, non vérifié par nous : x402scan publierait **~11 M de transactions sur 30 jours**, et
filtrerait par liste blanche de facilitateurs.

Or nous mesurons **~11,3 M de transactions EIP-3009 par mois** sur Base — *toute* la population,
liste ou pas — et **0,55 % seulement viennent d'un facilitateur public**. Si x402scan filtrait
bien par cette liste, il publierait **~62 000 transactions par mois, pas 11 millions**. Facteur
**~177**.

Une de ces trois propositions est donc fausse, et nous ne savons pas encore laquelle :

1. la description qu'on a de la méthode de x402scan est inexacte ;
2. sa liste d'adresses est deux cents fois plus grosse que la liste publique communautaire ;
3. son chiffre ne mesure pas ce qu'il annonce mesurer.

**Aucune n'est bénigne**, et dans les trois cas **le chiffre de référence du secteur ne se
reproduit pas depuis les sources publiques.** Ne rien publier de cette section avant d'avoir
tranché — mais c'est la piste la plus prometteuse du chantier.

## 6. La conception qui découle de tout ça

**Construire le graphe de paiement à partir des seuls journaux.** Chaque `AuthorizationUsed` a,
dans la même transaction, son `Transfer` apparié — qui donne **payeur, payé et montant**. Deux
requêtes de logs suffisent : aucune résolution de transaction, donc aucun mur de coût.

Le graphe fournit une **discrimination structurelle** indépendante de toute liste et de tout
catalogue :

- une ressource réellement consommée = **un payé, beaucoup de payeurs distincts, montants variés** ;
- une flotte = **montants uniformes, peu de contreparties, cadence régulière**.

On cesse alors de demander « est-ce du x402 ? », question à laquelle la chaîne répond mal, pour
demander « quelqu'un achète-t-il quelque chose à quelqu'un d'autre ? », à laquelle elle répond
bien. C'est la méthode qui a daté la bulle ACP et qui a montré que 87,7 % du paiement direct était
circulaire ([[2026-08-07-le-flux-subscriptions-acp-mesure]]).

Liste de facilitateurs et catalogue `payTo` deviennent des **étiquettes posées sur un graphe déjà
construit**, plus des conditions d'entrée. Le 504 du Bazaar ne bloque donc plus le chantier.

## 7. Ce que ça ouvre

1. **Identifier la flotte** — la question la plus rentable ouverte à ce jour. Si ces ~58
   portefeuilles sont ceux d'un facilitateur non répertorié (Coinbase CDP en fait tourner
   vraisemblablement bien plus que ses 10 adresses historiques), **nous pouvons publier la vraie
   liste, que personne n'a**. Si ce n'est pas du x402, le compteur du secteur mesure autre chose.
   Se tranche en regardant qui a financé ces portefeuilles et à qui ils versent.
2. **Construire le graphe** sur une période longue, et en tirer la distribution par montant et par
   nombre de payeurs distincts — la seule chose qui réponde à *quelqu'un paie-t-il pour un
   livrable jugeable*.
3. **Refaire le dump du catalogue Bazaar**, par l'API CDP quand elle répond ou par une autre route.
4. **Vérifier nous-mêmes la méthode de x402scan** dans son dépôt, au lieu de la tenir de seconde
   main. C'est la condition pour publier le §5.

## Refaire la mesure

```
eth_getLogs address=USDC 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
           topics=[0x98de5035…]              → tous les paiements sans gaz
           tranches de 500 blocs, séquentiel, bissection sur échec
```

**Leçons de coût, chèrement acquises aujourd'hui :**

- Une tranche de 10 000 blocs sur ce topic **dépasse la taille de réponse** du nœud public
  (`-32020 backend response too large`) : il a fallu 13 bissections. Sous charge, le même nœud
  répond **HTTP 500** au lieu du code d'erreur propre — **il faut bissecter sur les deux**, sinon
  la passe meurt au bout de ses relances.
- **Résoudre les émetteurs transaction par transaction ne passe pas à l'échelle** : 99 761 appels
  RPC pour 5 h 30 de chaîne. La lecture par blocs complets (10 000 appels) est meilleure mais a
  échoué sous la charge que nous avions nous-mêmes créée. **L'échantillon systématique de 2 000
  transactions a suffi, pour 2 215 appels** — et publie son intervalle de confiance.
- Ne jamais jeter les résolutions : la première sonde a consommé 99 761 appels puis a perdu le
  détail, obligeant à tout refaire.

Scripts de session : `x402-probe.mjs`, `x402-rematch.mjs`, `x402-sample.mjs`, dump
`sample.json`. Liste facilitateurs : `Swader/x402facilitators` clonée, `fac/facilitators.json`.
