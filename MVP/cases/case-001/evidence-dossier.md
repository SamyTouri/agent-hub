# Evidence dossier — Case 001

This dossier records evidence for one contemplated purchase. It does **not** recommend the
purchase by itself and is not a general score or trust label.

## 1. Subject and scope

- Candidate agent: `homepage-rewrite-agent-base-usdc`
- Service under review: **Three Homepage Hero Options**
- Relevant endpoint: `POST https://transform-balanced-trunk-remedies.trycloudflare.com/v1/homepage-hero-order`
- Payment network and asset: Base (`eip155:8453`), USDC
- Advertised price: 1 USDC
- Intended subject page: <https://agentreputation.dev/>
- Dossier opened: 2026-07-22
- Last evidence check: 2026-07-22 17:50 Europe/Brussels
- Prepared for: a specific internal buyer case
- Scope exclusions: seller security audit, legal identity verification, wallet custody review,
  code review, paid endpoint execution, and any general endorsement of the seller

## 2. Identity map

| Element | Observed value | Source | Observed on | Status / limits |
| --- | --- | --- | --- | --- |
| Primary handle | `homepage-rewrite-agent-base-usdc` | [Agent Reputation profile](https://agentreputation.dev/agents/homepage-rewrite-agent-base-usdc) | 2026-07-22 | Claimed native profile; claim is labelled self-asserted, not independently verified. |
| Service name | Homepage Messaging Kit Agent | [Service descriptor](https://transform-balanced-trunk-remedies.trycloudflare.com/service.json) | 2026-07-22 | Seller-controlled declaration. |
| Declared operator | Autonomous software; no named legal operator on reviewed surfaces | [Complete-kit disclosure](https://transform-balanced-trunk-remedies.trycloudflare.com/complete-homepage-messaging-kit) | 2026-07-22 | Legal identity and accountability channel remain unresolved. |
| Contact | Public service email declared in the agent card and service descriptor | [Agent card](https://transform-balanced-trunk-remedies.trycloudflare.com/.well-known/agent-card.json) | 2026-07-22 | Existence observed; control was not tested. |
| Proven control channel | None independently established | Reviewed public sources | 2026-07-22 | The Agent Reputation profile explicitly distinguishes claiming from verification. |
| Protocols / endpoints | A2A, MCP, REST/OpenAPI and x402 declared | [Agent card](https://transform-balanced-trunk-remedies.trycloudflare.com/.well-known/agent-card.json), [OpenAPI](https://transform-balanced-trunk-remedies.trycloudflare.com/openapi.json) | 2026-07-22 | Public descriptors were reachable. A paid execution was not attempted. |
| Payment recipient | One Base address declared consistently in seller descriptors | [x402 manifest](https://transform-balanced-trunk-remedies.trycloudflare.com/.well-known/x402) | 2026-07-22 | Consistency does not establish the human or legal owner. |

Identity continuity, authorization and service quality are separate questions. The evidence above
must not be used to collapse them into one conclusion.

## 3. Claim ledger

| ID | Claim | Made by | Source + date | Status | Independent evidence | Limits |
| --- | --- | --- | --- | --- | --- | --- |
| C-001 | The exact service costs 1 USDC on Base. | Seller | [x402 manifest](https://transform-balanced-trunk-remedies.trycloudflare.com/.well-known/x402), accessed 2026-07-22 | Corroborated | The [PayanAgent purchase URL](https://payanagent.com/x402/kh77taf99avt46753np9b0ktjn8azhsy) returned HTTP 402 with `priceUsd: 1`. | Confirms a live payment challenge, not delivery or refund behavior. |
| C-002 | The order produces exactly three page-specific headline, supporting-line and CTA combinations. | Seller | [OpenAPI](https://transform-balanced-trunk-remedies.trycloudflare.com/openapi.json), accessed 2026-07-22 | Partially corroborated | A prior artifact with exactly three such directions is retrievable from the [t2000 API](https://api.t2000.ai/v1/job/spec/5836f87cbfc1a7eba3f61480d482ef6c74d8f02921a1c2ef86c7f57ddf80def5). | One prior artifact does not establish consistent future delivery. |
| C-003 | Delivery occurs within 12 hours after complete intake. | Seller | [OpenAPI](https://transform-balanced-trunk-remedies.trycloudflare.com/openapi.json), accessed 2026-07-22 | Unverified | None found. | The prior artifact exposes content and inspection time, not accepted-order and delivery timestamps. |
| C-004 | The service is currently online. | Seller | [Service descriptor](https://transform-balanced-trunk-remedies.trycloudflare.com/service.json), accessed 2026-07-22 | Corroborated | Seller homepage, descriptors and free endpoint responded successfully during this review. | The current host is a temporary-looking `trycloudflare.com` URL; continued availability is unknown. |
| C-005 | A real funded hero delivery has already been produced for t2000. | Seller | [Seller-published IPFS proof](https://ipfs.io/ipfs/Qmdhv64UGVJzP2bKXcNGunb7ttzoucFrfDTBj7Mnmh33xX), accessed 2026-07-22 | Partially corroborated | The same content and SHA-256 identifier are exposed by the [t2000 API](https://api.t2000.ai/v1/job/spec/5836f87cbfc1a7eba3f61480d482ef6c74d8f02921a1c2ef86c7f57ddf80def5). | Funding, buyer acceptance, escrow release and satisfaction were not independently confirmed. The seller itself says buyer review is pending. |
| C-006 | The service produces commercially effective copy. | Implied by the offer category | Seller surfaces | Not assessable | No independent review, outcome report or conversion evidence found. | Copy quality and business outcome remain judgment-dependent. |
| C-007 | The mission can be completed using only a public URL and buyer-supplied context. | Seller | [Service descriptor](https://transform-balanced-trunk-remedies.trycloudflare.com/service.json), accessed 2026-07-22 | Corroborated for intake design | Required fields in the OpenAPI schema contain no credential or private-access field. | The seller's internal handling and retention practices were not audited. |
| C-008 | The payment address has received real USDC activity. | Public ledger observation | [BaseScan token transfers](https://basescan.org/address/0x2906E0CDDB5FF4754D639AbfBE65c6cA708aC27E#tokentxns), accessed 2026-07-22 | Corroborated | One incoming transfer of 0.04998 USDC was visible. | It cannot be safely attributed to this service or to a satisfied buyer. It is not a 1 USDC purchase. |

## 4. Observed work and outcomes

| ID | Mission / transaction | Date + version | Reported by | Observed outcome | Evidence | Independence / conflicts |
| --- | --- | --- | --- | --- | --- | --- |
| O-001 | Fictional complete homepage messaging kit | Current public sample on 2026-07-22 | Seller | Structured deliverable with explicit fact placeholders and claim-safety notes | [Public sample](https://transform-balanced-trunk-remedies.trycloudflare.com/samples/complete-homepage-messaging-kit.md) | Seller-controlled and explicitly fictional; useful for format only. |
| O-002 | Three homepage hero options for t2000 | Inspected 2026-07-22 at 07:24 UTC | Seller and t2000 API | Exactly three directions with headline, supporting line, CTA, rationale and unsupported-claim notes | [t2000 API artifact](https://api.t2000.ai/v1/job/spec/5836f87cbfc1a7eba3f61480d482ef6c74d8f02921a1c2ef86c7f57ddf80def5), [IPFS envelope](https://ipfs.io/ipfs/Qmdhv64UGVJzP2bKXcNGunb7ttzoucFrfDTBj7Mnmh33xX) | External API corroborates artifact and hash. Buyer review and escrow release remain pending; no outcome evidence. |
| O-003 | Free structural check of Agent Reputation | Generated 2026-07-22 at 15:50:46 UTC | Seller endpoint, reproduced by reviewer | Detected the current title and H1, found no action label, and proposed making the action explicit | [Free clarity-check endpoint](https://transform-balanced-trunk-remedies.trycloudflare.com/v1/free-homepage-clarity-check?url=https%3A%2F%2Fagentreputation.dev) | Directly reproduced, but deterministic, seller-operated and not evidence of paid-delivery quality or conversion impact. |

No completed buyer review, accepted outcome, refund, dispute or independently measured business
result was found.

## 5. Source register

| ID | Source | Source type | Who controls it? | Incentive / conflict | Freshness | What it proves | What it cannot prove |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S-001 | [Agent Reputation profile](https://agentreputation.dev/agents/homepage-rewrite-agent-base-usdc) | Registry profile | Agent Reputation; profile data supplied or claimed by candidate | This case is prepared by Agent Reputation for its own contemplated purchase | Live on 2026-07-22 | Handle, current listing, claim state, declared protocols, absence of native ratings | Legal identity, control, quality or suitability |
| S-002 | [Agent card](https://transform-balanced-trunk-remedies.trycloudflare.com/.well-known/agent-card.json), [OpenAPI](https://transform-balanced-trunk-remedies.trycloudflare.com/openapi.json), [x402 manifest](https://transform-balanced-trunk-remedies.trycloudflare.com/.well-known/x402), [service descriptor](https://transform-balanced-trunk-remedies.trycloudflare.com/service.json) | Official agent surfaces | Seller | Direct commercial interest | Live on 2026-07-22 | Declared offer, inputs, outputs, price, payment address and interfaces | Truth of performance claims, operator identity, buyer satisfaction |
| S-003 | [PayanAgent purchase URL](https://payanagent.com/x402/kh77taf99avt46753np9b0ktjn8azhsy) | Payment marketplace / proxy | PayanAgent | Benefits from payment activity; listing may originate with seller | HTTP 402 observed 2026-07-22 | Current 1 USD payment challenge exists | Whether settlement yields the promised deliverable or recourse |
| S-004 | [uGig skill listing](https://ugig.net/skills/draft-homepage-hero-options) | Marketplace listing | uGig and seller | Marketplace and seller both benefit from activity | Observed 2026-07-22 | Related skill was listed with 0 downloads and 0 reviews at observation time | Performance of the separate 1 USDC custom service |
| S-005 | [t2000 API artifact](https://api.t2000.ai/v1/job/spec/5836f87cbfc1a7eba3f61480d482ef6c74d8f02921a1c2ef86c7f57ddf80def5) | External protocol / task artifact | t2000 | t2000 is the apparent buyer or task platform | Live on 2026-07-22 | Exact delivered content and stable content identifier | Payment, acceptance, timeliness, satisfaction or business outcome |
| S-006 | [IPFS delivery envelope](https://ipfs.io/ipfs/Qmdhv64UGVJzP2bKXcNGunb7ttzoucFrfDTBj7Mnmh33xX) | Content-addressed seller publication | Content published by seller; hosted through IPFS | Seller wants to demonstrate prior work | Retrieved 2026-07-22 | Seller's disclosure and content hash | Independent acceptance or truth of lifecycle claims |
| S-007 | [BaseScan address](https://basescan.org/address/0x2906E0CDDB5FF4754D639AbfBE65c6cA708aC27E#tokentxns) | Blockchain explorer | Base ledger; explorer presentation by BaseScan | No identified transaction-specific conflict | Observed 2026-07-22 | Token transfers to the declared address | Service attribution, quality or buyer satisfaction |
| S-008 | Reproduced free clarity check | Direct functional observation | Endpoint controlled by seller; test executed by reviewer | Seller commercial funnel promotes paid next steps | Executed 2026-07-22 | Public endpoint was responsive and parsed the current page | Paid-order behavior or copy effectiveness |

## 6. Transaction and technical evidence

| Evidence | Reference | Subject / version binding | Verified at source? | Interpretation | Limits |
| --- | --- | --- | --- | --- | --- |
| x402 price manifest | [Manifest](https://transform-balanced-trunk-remedies.trycloudflare.com/.well-known/x402) | Exact `/v1/homepage-hero-order` path | Yes, live GET | Seller currently declares 1 USDC on Base | Seller-controlled |
| Independent payment challenge | [PayanAgent URL](https://payanagent.com/x402/kh77taf99avt46753np9b0ktjn8azhsy) | Named marketplace link from seller descriptor | Yes, HTTP 402 with 1 USD observed | A separate payment surface recognizes the price | No settlement attempted; payload binding and receipt behavior untested |
| Prior content hash | `5836f87c...f80def5` | Exact t2000 artifact | Yes, seller IPFS envelope and t2000 API content match | Stronger evidence that an artifact was delivered outside the seller's own host | Does not prove who paid, timeliness, acceptance or quality |
| Incoming USDC activity | Declared payout address on BaseScan | Address binding only | Yes | Address has received at least one small real USDC transfer | Amount was 0.04998 USDC and cannot be linked to the reviewed service |

A transaction proves only the transaction facts bound to it. None of the observed ledger activity
proves that the 1 USDC service has been bought or accepted before.

## 7. Incidents, corrections and recent changes

| Date | Event / change | Source | Agent response | Resolved? | Relevance to current service |
| --- | --- | --- | --- | --- | --- |
| 2026-07-22 | The current homepage foregrounds a broader 50 USD complete kit, while older case notes focused on the 1 USDC offer. | [Seller homepage](https://transform-balanced-trunk-remedies.trycloudflare.com/), [service descriptor](https://transform-balanced-trunk-remedies.trycloudflare.com/service.json) | The seller still exposes the 1 USDC service in its current descriptors and homepage entry link. | Yes, as a scope distinction | The old price assumption was revalidated rather than trusted. The 1 USDC entry offer is still current. |
| 2026-07-22 | Prior t2000 delivery is marked delivered with buyer review and escrow release pending. | [IPFS envelope](https://ipfs.io/ipfs/Qmdhv64UGVJzP2bKXcNGunb7ttzoucFrfDTBj7Mnmh33xX) | Disclosure explicitly says it is not buyer-acceptance or outcome proof. | Open | Material evidence of production, but not of satisfactory completion. |

No public incident or correction specific to this service was found in the targeted searches. That
absence is not proof that none exists.

## 8. Contradictions

| ID | Statements / evidence in conflict | Sources | Materiality | Current state |
| --- | --- | --- | --- | --- |
| X-001 | The seller calls the prior t2000 work a funded delivery, but the public envelope says buyer review and escrow release are still pending. | Seller homepage, IPFS envelope, t2000 API | Medium | Open. Artifact delivery is corroborated; funding settlement and acceptance are not. |
| X-002 | The seller declares the service `online`, but its public endpoint uses a temporary-looking Cloudflare tunnel hostname. | Service descriptor and endpoint host | Medium | Not a direct contradiction. It creates availability and continuity uncertainty that must be rechecked immediately before payment. |

The 50 USD complete kit and the 1 USDC hero service are different scopes, not contradictory prices.

## 9. Missing information and unanswered questions

| ID | Missing information | Why it matters | Who could answer? | Attempt made | Status |
| --- | --- | --- | --- | --- | --- |
| M-001 | Independent buyer review or acceptance of a comparable custom order | Best available indicator of delivery quality and reliability | t2000 buyer or another buyer | Public sources searched; seller says review pending | Open |
| M-002 | Independently proven operator identity and control | Determines accountability if delivery fails | Seller / registry / control-proof service | Public profile and descriptors reviewed | Open |
| M-003 | Refund, cancellation and failed-delivery remedy for the 1 USDC route | x402 payment may be irreversible | Seller / payment intermediary | OpenAPI and manifests reviewed; no clear term found | Open |
| M-004 | Exact receipt and request-payload binding after payment | Needed to connect money, requested mission and eventual artifact | Seller / PayanAgent | No payment attempted | Open |
| M-005 | Delivery contact selected by the buyer | Required input for the order | Samy | A private email was approved on 2026-07-23; it is deliberately excluded from the repository | Resolved for execution |
| M-006 | Buyer wallet readiness and total execution friction | A nominal 1 USDC test is not low-cost if funding or setup is disproportionate | Samy | No wallet inspection or signature requested | Open |
| M-007 | Whether the paid endpoint accepts the proposed request before settlement | Prevents paying against an invalid or mis-scoped request | Seller endpoint | No POST sent to avoid creating an external request before authorization | Open |

## 10. Dossier limits

- Targeted public research was used; this was not an exhaustive internet investigation.
- Seller-controlled sources make most offer and timing claims.
- The prior t2000 artifact is corroborated externally, but its buyer has not publicly accepted it.
- No payment, authenticated call, POST request, contact attempt or delivery test was performed.
- No private buyer or operator information was accessed.
- The service can change after the evidence cutoff, particularly because the endpoint host is not a
  stable seller-owned domain.
- No conclusion is made about legal compliance, cybersecurity, custody safety or conversion impact.

## 11. Change log

| Date | Change | New source / reason | Author |
| --- | --- | --- | --- |
| 2026-07-22 | Opened dossier and performed live source checks | First real MVP purchase decision | Codex |
| 2026-07-22 | Added prior-delivery corroboration and its acceptance limit | Matching t2000 API artifact and seller IPFS envelope | Codex |
