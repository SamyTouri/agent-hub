---
title: Les couches du marché de l'assurance agentique — qui achète quelle réduction de risque, à quel moment
type: concept
statut: SYNTHÈSE de recherche externe (Codex, 2026-08-04) — statuts conservés par couche
source: .exchange/codex/2026-08-04-marche-humain-agent-assurance-et-preuves.md
updated: 2026-08-05
---

# Le marché n'achète pas « de la confiance » — il achète des réductions de risque à des moments différents

Leçon centrale du dossier Codex du 04/08 sur le marché **humain→agent** (le marché B de
[[agent-paie-agent-vs-humain-achete-agent]], mille fois plus gros que le commerce entre agents).
Le mot-valise *agent trust* masque des acheteurs, des produits et des prix qui n'ont rien en
commun. La bonne question n'est pas « quelle part du marché de l'assurance IA prendre ? » (aucune
réponse défendable) mais : **quel moment de décision, quel acheteur et quelle preuve pouvons-nous
servir mieux qu'une déclaration du vendeur ?**

## Les trois régimes économiques

| Régime | Qui paie quoi | Fournisseurs typiques | Maturité |
|---|---|---|---|
| **A — Contrôle interne** | l'organisation contrôle ses propres agents (identité, permissions, journaux, coûts) ; budget sécurité/IAM/conformité | Microsoft Entra Agent ID, IBM Agent Control Plane, Palo Alto Prisma AIRS | mûr, intégré au cloud |
| **B — Assurance formelle** | démontrer l'alignement avec un cadre (audit, certification, opinion indépendante) ; coût humain et responsabilité élevés | PwC, Deloitte, laboratoires, organismes ISO/IEC 42001 | mûr, cher, institutionnel |
| **C — Preuve transactionnelle** | décider si on peut installer, appeler, payer ou renouveler UN service précis : faits frais et bornés | traces de plateforme, attestations, journaux, réputation | **immature — c'est notre terrain** |

## Les six couches, et ce que chacune prouve

1. **Identité, propriété, délégation** (Entra Agent ID, ERC-8004) — prouve un lien
   propriétaire/identité/endpoint et les délégations ; **ne prouve pas** que l'agent fonctionne ni
   la qualité d'une livraison. Une identité transférable garde sa réputation quand l'opérateur
   change : lier l'histoire à l'identité seule est un risque épistémique (cf. doctrine : le fait
   s'attache à la transaction).
2. **Provenance et intégrité du logiciel** (Sigstore/Rekor, SLSA) — prouve qu'un artefact
   correspond à une signature/provenance ; un logiciel authentiquement signé peut être vulnérable,
   indisponible ou mensonger.
3. **Sécurité pré-installation** (OWASP Agentic Top 10, MCP security guidance) — l'acheteur est
   le développeur/AppSec juste avant d'installer. Une fiche préinstallation bornée est accessible
   à une petite équipe ; une certification générale de sécurité ne l'est pas. Le goulot :
   échantillons légitimes, périmètre, faux positifs.
4. **Gouvernance et sécurité d'exécution** (IBM ACP, Prisma AIRS, OpenTelemetry GenAI) — journaux
   et blocage en production, mais **rarement indépendant de l'opérateur** ; ne conserve ni les
   conditions commerciales historiques d'un tiers ni les réponses à une contestation.
5. **Évaluation et assurance formelle** (NIST AI RMF/TEVV, ISO/IEC 42001, AI Act, cabinets) —
   ISO 42001 certifie un **système de management**, pas la vérité de chaque sortie d'agent. AI Act
   généralement applicable depuis le 2 août 2026 (haut risque annexe III : 2 déc. 2027 —
   calendrier juridiquement mouvant, revérifier avant toute décision).
6. **Mémoire événementielle et contestabilité** (x402, A2A, ERC-8183, ERC-8004, Internet-Drafts) —
   les protocoles fournissent identifiants et transitions ; **personne ne maintient la chronologie
   indépendante, inter-plateformes et contestable** de ce qui était promis, payé, livré, contesté.
   → C'est la couche de [[../syntheses/2026-08-05-vision-globale-marche-agent-a-agent]] §3.3 : le
   terrain la nomme (« le contrat n'a aucun fait indépendant à consulter »).

## Les moments de décision (ce qui se vend, c'est un moment)

Avant de connecter · avant d'autoriser l'accès aux données · avant de déployer · au moment d'une
invocation ou d'un paiement · après un incident · lors d'un audit ou renouvellement fournisseur.
Chaque moment a un acheteur différent (développeur, équipe plateforme, RSSI, achats/vendor-risk,
métier délégant, marketplace, auditeur/assureur, régulateur, **agent acheteur** — même actif,
via API). Table complète des acheteurs : dossier source §4.

## Le mécanisme économique commun

`valeur maximale de la preuve ≈ probabilité d'échec évitée × coût de l'échec − coût de décision restant`

Explique pourquoi un probe à quelques centimes ne vaut rien seul sur une transaction à trois
centimes, et beaucoup dans un processus d'achat à 50 000 €. Les quatre sources de disposition à
payer : éviter une perte · réduire le temps humain · prouver la diligence · **rendre une
transaction possible**. « La confiance est importante » n'est pas une preuve de volonté de payer
→ [[../questions-ouvertes/qui-paie-un-dossier-preuve-fonctionnement]].

## Distinctions à ne jamais aplatir

- Les trois objets : l'agent comme **produit logiciel** ≠ l'agent comme **service accessible** ≠
  la **transaction comme événement**. Toute architecture de preuve préserve ces frontières.
- Les cinq niveaux de vérité : ce qu'un acteur **dit être** / ce qu'un tiers peut **atteindre ou
  exécuter** / ce qui a été **livré dans une transaction** / ce qui a produit un **résultat
  utile** / ce qu'un organisme accrédité peut **certifier**.
- *Assurance, certification, audit, évaluation, attestation, preuve, validation, réputation* ne
  sont pas interchangeables.

Voisin : [[../mesures/2026-08-04-marche-britannique-assurance-ia]] ·
[[../mesures/2026-08-04-achats-publics-assurance-ia]] ·
[[../acteurs/assurance-ia-entreprise]] ·
[[../regles-du-jeu/standards-et-protocoles-de-preuve-agentique]]
