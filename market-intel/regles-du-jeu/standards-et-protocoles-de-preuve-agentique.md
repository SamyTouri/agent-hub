---
title: Standards et protocoles de preuve agentique — carte de consommation, pas projet de normalisation
type: regle-du-jeu
statut: RAPPORTÉ/DÉCLARÉ selon la ligne (sources primaires relues par Codex le 2026-08-04)
source: .exchange/codex/2026-08-04-marche-humain-agent-assurance-et-preuves.md §8
updated: 2026-08-05
---

# Ce que chaque norme prouve, ne prouve pas, et comment nous les consommons

Règle stratégique : **ne pas inventer une certification universelle**. Publier une
**correspondance versionnée** — « tel événement observé remplit tels champs de telle norme ». Si
la norme change, la trace historique reste vraie et le mapping est corrigé. Cohérent avec la
doctrine (on stocke l'observé, jamais le calculé).

## La carte

| Référence | Statut | Objet | Preuve utile pour nous | Limite à ne jamais oublier |
|---|---|---|---|---|
| NIST AI RMF / GenAI Profile | cadre volontaire | gestion des risques | vocabulaire Govern/Map/Measure/Manage | pas une certification, pas transactionnel |
| NIST TEVV | programme | test, évaluation, vérification, validation | méthode, jeux d'essai, répétabilité — rejoint notre discipline | ne décide pas les critères d'un achat |
| ISO/IEC 42001 | norme | système de management IA | gouvernance organisationnelle | certifie le management, **pas chaque sortie d'agent** |
| EU AI Act | règlement | obligations selon rôle et usage | logs, documentation, supervision — généralement applicable depuis le 02/08/2026 ; haut risque annexe III : 02/12/2027 | classification par l'usage, calendrier mouvant — revérifier avant toute décision |
| OWASP Agentic Top 10 | guide | menaces agentiques | taxonomie de scénarios de test | pas une attestation d'un service précis |
| MCP security guidance | spec/guide | autorisation d'outils | permissions, audience, consentement, sandbox | ne prouve pas que l'outil livre une valeur |
| Sigstore/Rekor | infrastructure | signature, transparence | provenance d'artefact | authenticité ≠ sûreté ni qualité |
| SLSA | cadre | provenance de build | intégrité de la chaîne logicielle | ne couvre pas le service vivant |
| OpenTelemetry GenAI | conventions | télémétrie agents/outils | format d'événements | vocabulaire encore mouvant |
| A2A | protocole | messages, tâches, états | identifiants et chronologie d'exécution | un état `completed` est **déclaré par le service**, pas une vérité indépendante |
| x402 | protocole | paiement HTTP | preuve de paiement et parties | **paiement ≠ livraison** |
| ERC-8004 | ERC **Draft** | identité, feedback, validation | ancres et événements composables | Sybil, inscription ≠ fonctionnement |
| ERC-8183 | ERC **Draft** | commerce sous séquestre | états funded/submitted/completed/rejected | incitations de l'évaluateur ([[erc-8183-escrow-et-evaluateur]]) |
| Internet-Drafts agentiques | propositions individuelles | audit trail, provenance d'intention/délégation, « passeports » | veille + antériorité technique | **aucune approbation IETF**, peuvent expirer |

URLs complètes : dossier source §14.

## Les invariants (à répéter dans toute fiche qui cite ces standards)

1. Paiement, règlement et statut `completed` sont des faits **nécessaires mais insuffisants** —
   ils ne prouvent pas l'utilité ([[../concepts/couches-assurance-agentique]], trois niveaux :
   livraison technique / conformité / effet utile).
2. Un endpoint 200 ne prouve que la réponse de la route testée au moment testé
   ([[../mesures/2026-08-03-sonde-endpoints-segment-confiance]]).
3. Les Drafts (ERC, IETF) ne confèrent aucune accréditation — les citer avec leur statut.
4. Compter ensemble ERC-8004 + A2A + x402 + ERC-8183 comme « agents certifiés » ou parts de
   marché est invalide : primitives composables, pas dénominateurs.

Voisin : [[2026-08-04-marche-des-evaluateurs-tous-protocoles]] · [[x402-crypto-seulement-ou-pas]]
