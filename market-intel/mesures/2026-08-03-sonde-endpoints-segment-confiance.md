---
title: J'ai frappé à la porte des vendeurs de confiance — deux sur trois ne répondent pas
type: mesure
statut: MESURÉ (sonde de première main)
date: 2026-08-03
updated: 2026-08-03
---

# Deux endpoints sur trois ne répondent pas, et parmi ceux qui répondent, beaucoup ne sont pas les leurs

**La mesure que la base attendait.** [[date-de-plateforme-est-une-declaration]] disait que la
seule méthode fiable pour savoir si un agent vit est de **frapper à sa porte**. C'est fait, sur le
segment qui nous concerne directement : les agents qui vendent de la vérification, de l'audit, du
score de risque et de la réputation.

## Méthode

Quatre-vingt-deux points d'accès, publiés par les agents eux-mêmes dans leur fiche de la
plateforme. Une requête **en lecture seule**, dix secondes de délai, une seule tentative par
adresse, en s'annonçant. Aucun paiement, aucune écriture, aucune charge.

Corpus des agents : instantané du **2026-08-01**. Sonde exécutée le **2026-08-03**.

## Le résultat

| | Endpoints | Part |
|---|---|---|
| **Ne répondent pas** | **55** | **67 %** |
| Répondent | 27 | 33 % |

Le détail des muets : 28 en échec de connexion pur, 10 en page introuvable, 6 en requête
invalide, 4 en erreur, plus des passerelles mortes et un accès refusé.

## Les deux plus gros du segment sont tous les deux hors service

**AgentPulse**, 81 318 $ — le plus gros revenu de tout le segment confiance, et le concurrent le
plus proche de notre produit. **Échec de connexion.** Voir [[agentpulse]].

**Tolena Frequency**, 18 437 $ — deuxième revenu du segment. Son point d'accès publié est :

```
https://example.com/strategic-analysis-example
```

**`example.com`.** Le domaine réservé par l'IANA pour servir d'exemple dans la documentation
technique. Cet agent a encaissé dix-huit mille dollars en publiant comme adresse de service le
nom de domaine qui existe précisément pour ne désigner aucun service.

## Le motif que la sonde révèle et qu'aucun compteur ne montre

Parmi les 27 qui répondent, **dix ne répondent pas depuis leur propre infrastructure** :

| Agent | Ce qu'il publie comme point d'accès |
|---|---|
| MakeAgentRiskScan · CryptoQuickScan · AgentGuard | **le même** `api.gopluslabs.io` — une API de sécurité tierce |
| DeFiPulseAgent · blocknuri | `yields.llama.fi` — l'API publique d'un agrégateur tiers |
| HoneypotKiller · ShieldAI | **le même** `api.honeypot.is` |
| MutualClaw · Connectouch | `acpx.virtuals.io` — **la plateforme elle-même** |
| Producer by Suede Labs | `app.virtuals.io` — la plateforme elle-même |
| blocknuri · NanoUtility | `api.coingecko.com`, `api.alternative.me` |

Trois agents qui vendent de l'analyse de risque pointent tous vers **la même API tierce**. Ce ne
sont pas trois offres concurrentes : c'est le même service revendu trois fois sous trois noms.

**Et le plus parlant : quatre agents publient `httpbin.org`** — BaseRiskScout, NanoUtility
Micro-API, SignalForge, TraceSage. C'est un service public d'**écho HTTP**, l'outil dont on se
sert pour tester qu'une requête part bien. Quatre agents ont mis leur outil de test en production
et l'ont laissé là.

## Le compte réel

Sur 82 points d'accès annoncés par des agents qui vendent de la confiance :

- **55 ne répondent pas**
- **10 répondent, mais depuis l'infrastructure de quelqu'un d'autre**
- **4 pointent vers un service d'écho de test**
- **Il reste treize adresses qui sont un service fonctionnel appartenant à l'agent.**

Treize sur quatre-vingt-deux. **Seize pour cent.**

## Pourquoi c'est le cœur de notre position

Le registre affiche pour ce segment 463 agents et 679 310 $. Tout cela est déclaré, indexé,
consultable, et rien de tout cela n'atteste que le service existe. Il a suffi d'une requête en
lecture par adresse — quelques minutes, aucun coût — pour que deux tiers du segment cesse de
répondre.

**Personne ne fait cette requête.** Les annuaires indexent la déclaration
([[2026-08-01-annuaires-le-meme-objet-compte-neuf-fois]]), les tableaux de bord comptent le volume
([[volume-brut-nest-pas-revenu]]), les places de marché affichent des dates qui ne prouvent rien
([[date-de-plateforme-est-une-declaration]]). Frapper à la porte est la seule opération qui
transforme une déclaration en observation, et elle est à la portée de n'importe qui.

C'est exactement ce que ce projet dit vouloir être, et c'est reproductible en une commande.

## Réserves

- Un endpoint muet aujourd'hui n'est pas forcément un service mort : panne temporaire, filtrage
  d'adresse, route exigeant un paiement ou un jeton. **Une sonde unique n'est pas un verdict** —
  c'est une observation datée, et il faudra la répéter pour distinguer la panne de l'abandon.
- Certaines routes sont conçues pour refuser une requête non payée. Un code d'erreur peut donc
  signifier « le service marche et te demande de payer ». Les codes sont conservés tels quels
  plutôt qu'interprétés.
- Pointer vers une API tierce n'est pas illégitime en soi — un intermédiaire a le droit d'exister.
  Ce qui est mesuré ici, c'est que **rien dans le registre ne permet de le savoir**.

Voisin : [[2026-08-01-segment-confiance-encore-actif]] · [[2026-08-01-metiers-de-la-confiance]] ·
[[agentpulse]]
