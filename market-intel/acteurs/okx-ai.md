---
title: OKX.AI — la bêta institutionnelle la plus complète, et ses 4 036 dollars de volume
type: acteur
statut: AUDIT Codex du 2026-08-05 (lecture seule) — compteurs = observations de la plateforme, pas vérités économiques indépendantes
source: .exchange/codex/2026-08-05-analyse-okx-ai-marche-agent-a-agent.md
updated: 2026-08-05
---

# OKX.AI : tout le marché agentique dans un seul produit — et presque pas d'économie dedans

Lancé publiquement le 1er juillet 2026. C'est la tentative institutionnelle la plus complète pour
réunir toutes les briques d'un marché agent-à-agent : identité ERC-8004 sur X Layer, catalogue,
publication de tâches, négociation, micro-paiement x402/MPP, séquestre, livraison, acceptation,
réputation et **arbitrage par évaluateurs stakés**. Ce n'est pas une façade : Skills publics avec
machine d'état à onze statuts, documentation dense, cadence de build inhabituelle (avril→août).

> **Verdict de l'audit : une bêta instrumentée de commerce agentique, pas encore un marché
> autonome validé.**

## Les chiffres publics au 05/08 (MESURÉ sur okx.ai — périmètres de plateforme)

| Indicateur | Valeur | Piège de lecture |
|---|---:|---|
| Volume total cumulé | **4 035,77 $** | aucune ventilation par rail (x402 vs séquestre) |
| Tâches publiées | 14 031 | mélange micro-appels x402 et contrats sous séquestre |
| Tâches terminées | 9 394 (66,9 %) | statut applicatif ; auto-acceptation après 3 jours ; pas une preuve d'effet utile |
| Agents « en ligne » | 1 050 | filtre ONLINE ONLY — pas le total enregistré |
| Volume par tâche publiée | **0,288 $** | l'infrastructure est très en avance sur le débit économique |

**Échantillon de 21 fiches publiques : 18 en x402 (0,005–1,50 $), 3 seulement en séquestre A2A**
(non aléatoire — suffit à prouver que le compteur global n'est pas un compteur de contrats A2A).
Cas [PixelBrief](https://www.okx.ai/agents/5421) : 21 705 « sold » — plus que le total des tâches
de la plateforme — pour 54 avis (0,25 %) : « sold » compte des usages selon un périmètre opaque,
et les conditions autorisent des appels de **sampling gratuits** par OKX à fins de curation.

## L'arbitrage par évaluateurs stakés — l'élément le plus original, et son défaut

Règles publiées : ≥ 5 évaluateurs par litige, stake ≥ **100 OKB**, commit/reveal, l'ASP qui
conteste dépose 5 % du montant, la majorité se partage 5 % + pénalités, vote minoritaire = −1 %
du stake, absence = −0,3 % + 24 h d'exclusion. Garde-fous sérieux dans le Skill public (hiérarchie
de preuves, grille de 100 points, anti-injection de prompt).

**Le défaut fondamental : le mécanisme récompense le consensus, pas la vérité.** Un évaluateur
n'est pas pénalisé quand il a tort — il l'est quand il diffère de la majorité. Conséquences :
comportement de Schelling, erreurs corrélées (mêmes modèles sous-jacents), avantage au gros
stake, fuite des cas ambigus. C'est une **finalité procédurale**, pas un oracle de qualité —
même famille de problème que l'asymétrie payé-si-approbation d'ERC-8183
([[../regles-du-jeu/erc-8183-escrow-et-evaluateur]]). Et **aucune donnée agrégée publique** :
nombre de litiges, évaluateurs actifs, stake total, montants distribués — tout est inconnu.

## Décentralisation : hybride

Règlement et identité onchain, séquestre déclaré « open source, ownerless, non-upgradeable »
(⚠️ non confirmé par audit de bytecode — les contrats de tâche/arbitrage n'ont pas été localisés
dans les dépôts publics). Mais OKX contrôle : curation, delisting, sampling, ranking, KYT, l'accès
et le Broker par défaut. **Règlement décentralisé, marché centralisé.** La réputation « qui suit
l'agent partout » est une ancre portable (ERC-8004) avec un score et des règles qui restent OKX.

## Position stratégique

- OKX est **co-auteur d'ERC-8183** avec l'Ethereum Foundation et Virtuals, et veut faire de son
  Agent Payments Protocol (APP : `charge`/`escrow`/`session`/`upto`) une implémentation du
  standard. La convergence est une roadmap, pas un état : plusieurs guides APP sont encore
  « coming soon » alors que le marketplace vertical tourne déjà.
- Scénario central de l'audit (3-6 mois) : croissance des micro-services A2MCP, contrats A2A
  longs encore rares — un marketplace d'APIs agentifiées plus qu'un marché de sociétés d'agents.

## Ce que ça change pour nous

1. **La conclusion du 05/08 est renforcée** : même l'acteur institutionnel le mieux outillé
   plafonne à ~4 k$ cumulés — l'infrastructure est partout en avance sur la demande
   ([[../syntheses/2026-08-05-vision-globale-marche-agent-a-agent]]).
2. **Concurrence directe sur la couche C** : le rôle d'Evaluator OKX chevauche notre métier
   d'évaluateur (distribution, staking, paiement natif). Notre différenciation n'est ni un vote
   majoritaire ni un score : indépendance du marketplace, faits bruts avec provenance, symétrie
   acheteur/vendeur, réponse liée, mémoire inter-protocoles, distinction livraison/satisfaction/
   effet.
3. **L'espace qu'OKX laisse vide est exactement le nôtre** : fiches terminées sans reçu complet,
   « sold » opaque, score qui agrège au lieu de préserver, auto-acceptation qui ne prouve rien,
   arbitrage qui produit une décision sans mémoire contradictoire de la suite. La chaîne
   `promis → autorisé → payé → émis → observé → contesté → corrigé`, comparable entre OKX, ACP et
   x402 direct, n'existe pas chez eux.
4. **À ne pas inférer** : 14 031 tâches ≠ 14 031 prospects ; 4 036 $ ne prouvent aucun budget pour
   la réputation indépendante ; des évaluateurs rémunérés ≠ un marché de l'évaluation.
5. **Expérience recommandée avant toute construction** (sous autorisation de dépense explicite de
   Samy) : acheter un service x402 minime, passer une tâche sous séquestre, tester un rejet
   légitime, et mesurer **ce qui subsiste publiquement** à chaque étape — la profondeur de preuve,
   pas l'interface.

## Le point de bascule à surveiller (série mensuelle)

Payeurs uniques externes en croissance · réachat par les mêmes agents · volume séquestre A2A
significatif · revenu médian vendeur non nul · litiges rares mais résolus · historiques
exploitables hors OKX · transactions sans campagne ni sampling. Les treize signaux détaillés :
dossier source §15.

Voisin : [[virtuals-acp]] · [[qui-tient-le-terrain-de-la-livraison]] ·
[[../regles-du-jeu/2026-08-04-marche-des-evaluateurs-tous-protocoles]]
