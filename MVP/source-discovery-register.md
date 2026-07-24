# Source discovery register — working method

The MVP should not begin with a universal list of "trusted sources". It should begin with one real
purchase decision, identify the evidence needed for that case, then record which sources proved
useful. This register is the learning log for that process.

## Candidate source families

| Family | Possible evidence | Common limitation |
| --- | --- | --- |
| Official agent surface | Agent card, declared capabilities, endpoint, operator disclosure | Controlled by the candidate |
| Agent registries | Identity, listing history, protocol metadata | Registration rarely proves operation or quality |
| Marketplaces | Offer, transaction history, buyer feedback, dispute records | Incentive to maximize completed transactions |
| Protocol logs | Requests, responses, attestations, task events | Technical occurrence may not show business outcome |
| Payment records | Payment timing, amount, counterparty binding | Payment does not prove quality or satisfaction |
| Blockchain records | Identity or transaction anchors, versioned attestations | Immutable does not mean truthful or relevant |
| Code repositories | Maintenance, releases, ownership proof, disclosed issues | Activity can be manufactured; private work is invisible |
| Independent audits | Reproduction, security findings, scope-specific validation | Scope, version and reviewer independence matter |
| Buyer reports | Expected versus observed outcome, failures, remedies | Interested source; requires context and corroboration |
| Incident sources | Vulnerabilities, abuse reports, corrections, downtime | Attribution and current-version relevance can be unclear |

## Evaluation fields for every source

- Exact URL, registry key, transaction reference or other stable locator
- Accessed date and evidence date
- Candidate identity and version binding
- Who controls or funds the source
- Incentive and conflict of interest
- Independence from other sources in the dossier
- What the source directly proves
- What is inferred rather than observed
- What the source cannot prove
- Reproducibility or verification method
- Freshness and known superseding evidence
- Public, buyer-supplied, restricted or confidential status

## Learning log

| Case | Candidate | Decision question | Source tested | Useful? | What it established | Failure / gap | Keep for future cases? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Case 001 | `homepage-rewrite-agent-base-usdc` | Buy three homepage hero options for 1 USDC? | Official agent card, OpenAPI, x402 manifest and service descriptor | Yes | Current offer, scope, inputs, price, payment network, recipient and endpoint | Seller-controlled; no performance or identity proof | Yes, as the offer baseline only |
| Case 001 | `homepage-rewrite-agent-base-usdc` | Same | PayanAgent payment URL | Partly | A separate live surface returned an HTTP 402 challenge at 1 USD | No settlement, request binding, delivery or remedy tested | Yes, when the exact listing can be reproduced |
| Case 001 | `homepage-rewrite-agent-base-usdc` | Same | t2000 artifact API plus seller IPFS envelope | Yes | Matching content and hash corroborate that a real-page artifact was delivered outside the seller host | Buyer review, escrow release, timeliness and outcome remain unconfirmed | Yes; preserve lifecycle state separately from artifact existence |
| Case 001 | `homepage-rewrite-agent-base-usdc` | Same | BaseScan token transfers | Limited | The declared address has received a small real USDC transfer | Transfer cannot be attributed to the reviewed service or to buyer satisfaction | Only when a transaction can be bound to the exact order |
| Case 001 | `homepage-rewrite-agent-base-usdc` | Same | uGig related-skill listing | Limited | The related skill existed with observable download and review counts | Different product; zero reviews and downloads at observation time | Only as marketplace context, not service-quality evidence |
| Case 001 | `homepage-rewrite-agent-base-usdc` | Same | Reproduced free clarity-check endpoint | Yes, narrowly | Endpoint availability, current-page parsing and one structural observation | Seller-operated free output does not predict paid quality or conversion | Yes, as a reproducible capability check with explicit limits |

## Research rule

Do not add a registry, marketplace, protocol or blockchain because it is fashionable or because the
project already integrates it. Add it when it can answer a material question in a real decision,
and preserve its limits and incentives next to the evidence it contributes.
