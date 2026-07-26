# Evidence dossier — working template v1

This remains an evolving product schema. Its purpose is to make repeated real cases comparable
without forcing unlike facts into one score.

The dossier records evidence. It does **not** recommend a purchase by itself.
One dossier is bound to one candidate, one product or mission, one buyer context and one dated
evidence cutoff. A successful micro-test must never become a seller-wide endorsement.

## 1. Subject and scope

- Candidate agent:
- Service or product under review:
- Buyer and analyst:
- Case ID:
- Relevant handle(s), version(s) and endpoint(s):
- Dossier opened:
- Last evidence check:
- Evidence cutoff:
- Maximum authorized exposure:
- Authorization status: not requested / granted / consumed / withdrawn
- Prepared for: public example / specific buyer case
- Scope exclusions:

## 2. Identity map

| Element | Observed value | Source | Observed on | Status / limits |
| --- | --- | --- | --- | --- |
| Primary handle |  |  |  |  |
| Linked identities |  |  |  |  |
| Declared operator |  |  |  |  |
| Proven control channel |  |  |  |  |
| Blockchain address / identity |  |  |  | State exactly which fact is anchored and whether control was proven |
| Protocols / endpoints |  |  |  |  |

Identity continuity, authorization and service quality are separate questions. Evidence for one
must not be presented as proof of the others.

## 3. Claim ledger

Use one row per material claim. Status is provisional: `unverified`, `partially corroborated`,
`corroborated`, `contradicted`, `outdated` or `not assessable`.

| ID | Claim | Made by | Source + date | Status | Independent evidence | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| C-001 |  |  |  |  |  |  |

## 4. Observed work and outcomes

| ID | Mission | Date + version | Payment state | Delivery state | Correctness / outcome | Evidence | Independence / conflicts |
| --- | --- | --- | --- | --- | --- | --- | --- |
| O-001 |  |  | not attempted / failed / settled | not observed / failed / delivered | not assessed / pass / partial / fail |  |  |

Keep the provider's report, buyer's report and third-party analysis distinct.

## 5. Source register

| ID | Source | Source type | Who controls it? | Incentive / conflict | Freshness | What it proves | What it cannot prove |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S-001 |  |  |  |  |  |  |  |

Possible source types include official agent cards, registries, marketplaces, protocol logs,
payment receipts, blockchain attestations, code repositories, independent audits, incident records,
buyer reports and reproducible tests. Inclusion is case-specific; no source type is automatically
authoritative.

## 6. Transaction, delivery and artifact evidence

| Evidence class | Reference | Subject / version binding | Verified independently? | Interpretation | Limits |
| --- | --- | --- | --- | --- | --- |
| Unsigned payment terms |  |  |  | What was offered before signing | Not a payment |
| On-chain transaction |  |  |  | Value movement | Not delivery or quality |
| Delivery receipt |  |  |  | What response arrived | Not correctness |
| Content hash |  |  |  | Which artifact was assessed | Not truth |
| Independent reproduction |  |  |  | Which observable fields matched | Not future reliability |
| Buyer assessment |  |  |  | Mission-specific interpretation | Conflict must be disclosed |

Record payment or blockchain evidence only when it is relevant. A transaction proves that a
transaction occurred; it does not automatically prove quality, independence or satisfaction.

## 7. Incidents, corrections and recent changes

| Date | Event / change | Source | Agent response | Resolved? | Relevance to current service |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |

## 8. Contradictions

| ID | Statements / evidence in conflict | Sources | Materiality | Current state |
| --- | --- | --- | --- | --- |
| X-001 |  |  |  | Open |

Do not force consensus. Preserve a contradiction until stronger evidence or a clearly documented
scope difference resolves it.

## 9. Missing information and unanswered questions

| ID | Missing information | Why it matters | Who could answer? | Attempt made | Status |
| --- | --- | --- | --- | --- | --- |
| M-001 |  |  |  |  | Open |

## 10. Public-claim boundary

Write the narrowest public sentence supported by the case:

> [Supported public sentence]

Then state explicitly what must **not** be inferred:

- [Unsupported inference]

Every number must have a date and a denominator. An endpoint that stayed silent is not a dead
agent. A wallet is not a legal identity. A payment is not a delivered outcome.

## 11. Dossier limits

- Sources unavailable or inaccessible:
- Evidence supplied by interested parties:
- Version uncertainty:
- Tests not reproduced:
- Confidential information deliberately excluded:
- Other limitations:

## 12. Machine-readable sidecar

For a paid or technically reproduced case, preserve a sanitized JSON sidecar containing:

- exact product, target, network, asset, amount and parties;
- transaction, receipt status and block reference;
- delivery status, content type, byte count and content hash;
- independent checks and their dates;
- buyer assessment separated from general seller reliability;
- hashes of private evidence files without publishing replayable authorizations or full paid output.

## 13. Change log

| Date | Change | New source / reason | Author |
| --- | --- | --- | --- |
|  |  |  |  |
