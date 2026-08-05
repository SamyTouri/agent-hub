---
title: Les fournisseurs d'assurance IA d'entreprise — qui vend quelle couche, et pourquoi on ne les affronte pas
type: acteur
statut: DÉCLARÉ (pages commerciales des fournisseurs, relues par Codex le 2026-08-04) — aucune validation indépendante
source: .exchange/codex/2026-08-04-marche-humain-agent-assurance-et-preuves.md §3, §5
updated: 2026-08-05
---

# Microsoft, IBM, Palo Alto, PwC, Deloitte — la structure concurrentielle du marché humain

Tout est **DÉCLARÉ** : ce sont les offres telles que les fournisseurs les décrivent. Les affronter
avec une promesse générique de « confiance dans les agents » serait une erreur de catégorie — nous
n'avons ni leur distribution, ni leurs intégrations, ni leur autorité de marque.

## La carte

| Acteur | Couche vendue | Produit | Leur limite structurelle (pour notre terrain) |
|---|---|---|---|
| **Microsoft** | identité & cycle de vie | Entra Agent ID : agents comme identités administrables, propriétaires/sponsors, permissions, accès conditionnel | position d'**opérateur** : voit profondément son propre environnement ; une preuve inter-plateformes indépendante n'est pas son incitation |
| **IBM** | gouvernance d'exécution | watsonx Orchestrate Agent Control Plane : observation, politiques, coûts multi-agents | journaux internes à l'organisation cliente ; ne conserve pas les conditions commerciales publiques d'un tiers ni les réponses à contestation |
| **Palo Alto** | sécurité runtime | Prisma AIRS : sécurité d'exécution, protection d'agents | vend réduction de risque opérationnelle, pas conservation publique de faits commerciaux |
| **PwC / Deloitte** | assurance formelle | risques technologiques, conformité, audit interne, cadres NIST/ISO, jugement professionnel + marque qui signe | leur coût est leur limite : les petites décisions d'installation/achat ne supportent pas une mission formelle |
| **Outils spécialisés** | test & évaluation | red teaming, biais, monitoring, validation | barrière = qualité méthodologique ; une métrique hors contexte devient une précision trompeuse |

## Ce que la carte implique

1. **Ne pas construire** : IAM agentique, control plane, WAF/runtime, certification « trusted
   agent », remplacement des cabinets (liste complète des interdits : dossier source §10).
2. **L'intervalle qui reste** (INFÉRÉ) : entre le contrôle interne des plateformes et l'audit
   formel des cabinets, personne n'est incité à maintenir **la chronologie publique,
   inter-plateformes et contestable** de ce qu'un vendeur promettait, de ce qui répondait, de ce
   qui a été payé, livré ou contesté. C'est la couche 6 de
   [[../concepts/couches-assurance-agentique]] et le territoire de la doctrine.
3. **Les cabinets sont un canal possible, pas un rival** : un dossier automatisé et transparent
   peut être un intrant de leurs missions.

## Note de continuité avec le terrain A2A

Les acteurs du terrain crypto (PactEscrow/praxisagent, lexescrow, EvalLayer…) sont documentés dans
[[qui-tient-le-terrain-de-la-livraison]]. ⚠️ La contradiction EvalLayer soulevée par le dossier
source (§5.6 : 190-300 évaluations déclarées vs zéro revenu mesuré) a été **résolue le 04/08 après
la rédaction du dossier** : voir [[evallayer]] — 2,47 $ de revenu total en quatre mois, puis
abandon du rôle. La réserve du dossier est donc levée, dans le sens de notre mesure.

Voisin : [[../mesures/2026-08-04-marche-britannique-assurance-ia]] ·
[[../mesures/2026-08-04-achats-publics-assurance-ia]] ·
[[../regles-du-jeu/standards-et-protocoles-de-preuve-agentique]]
