# Proposed purchase brief — Case 001

This document makes the contemplated mission concrete. It is **not** an order and does not authorize
a payment, message, wallet signature or production change.

## Proposed order inputs

- `url`: `https://agentreputation.dev/`
- `primaryBuyer`: Autonomous agents and their human operators who are deciding whether to buy a
  service from an AI agent.
- `offer`: Independent, source-linked evidence dossiers and manual pre-purchase decision analysis for
  a real contemplated AI-agent purchase. The service exposes facts, claims, contradictions, missing
  evidence and safeguards without turning them into a universal score or safety guarantee.
- `desiredAction`: Bring one real contemplated purchase to Agent Reputation for a manual
  pre-purchase review.
- `replyTo`: **A private delivery email has been approved by Samy. Insert it only at execution time;
  do not commit or publish it in this case file.**
- `claimConstraints`:
  - Do not call listed agents verified, safe or trustworthy by default.
  - Do not claim that the analysis guarantees safety, quality or a successful outcome.
  - Do not invent customer counts, market traction, buyer results or conversion gains.
  - Keep evidence, inference and missing information visibly distinct.
  - Describe the current service as a manual MVP, not a fully automated product.

## Acceptance test

A delivery passes the advertised-scope test only if it:

1. arrives within 12 hours after a complete, paid intake is acknowledged;
2. contains exactly three meaningfully distinct directions;
3. gives one headline, one supporting line and one CTA for each direction;
4. clearly reflects the supplied buyer, offer and desired action;
5. respects every claim constraint above;
6. is returned in readable Markdown or structured text that can be preserved with the order record.

Rationales and claim-safety notes are desirable and appeared in the prior t2000 artifact, but they
should not be treated as guaranteed unless the final payment flow includes them in the purchased
scope.

Passing this test proves only that the promised deliverable arrived in scope. Samy must separately
judge whether the copy is useful. No option will be inserted into `Communication/` or the public site
without a new decision.

## Same-session preflight before any payment

1. Confirm the official endpoint still responds and still declares the same service.
2. Confirm the price is exactly 1 USDC on Base and the payment recipient matches the current official
   seller manifest.
3. Insert the founder-approved private delivery email without storing it in the repository or logs.
4. Submit only the fields above and inspect the returned x402 challenge before signing.
5. Stop if the price, network, recipient, scope, data request or terms materially differ.
6. Confirm that the wallet already has the safely available funds; do not create disproportionate
   setup work merely to preserve this case.
7. Ask Samy for a final explicit authorization tied to the displayed transaction.

## Evidence to preserve if authorized later

- Final request body, excluding any private data from public case files
- HTTP 402 payment requirements and endpoint version
- Transaction hash and amount
- Order or request identifier
- Acceptance timestamp and promised deadline
- Complete delivery and its content hash
- Buyer's pass/fail assessment against the acceptance test
- Any response, correction, refund or dispute
