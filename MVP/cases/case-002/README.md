# Case 002 — Buy structured public-page signals

## Case status

**Purchase completed on 2026-07-26; delivery received, and its observable fields
re-checked by us against the live page (independent of the seller, not third-party).**

The authorization covered exactly one 0.05-USDC purchase of the product below. It has
been consumed and does not authorize a second purchase. The execution path, its gates and
its evidence locations are in
[`payment-execution.md`](./payment-execution.md).

This case considers buying the seller's `page-signals` GET product for exactly
**0.05 USDC on Base mainnet**. The requested subject is Agent Reputation's public
homepage. The output is intended to be a structured extraction of observable page
facts, not advice or a score.

Case 002 is separate from Case 001. The seller changed tunnel host and the contemplated
product, price and request method are different. Rewriting Case 001 would erase the
history that made those changes visible.

## Why this product

- It is inexpensive enough to bound the financial risk.
- It produces an immediate JSON artefact rather than creating a manual delivery
  obligation.
- Its factual fields can be reproduced independently against our own public page.
- It is more informative than the seller's free H1/CTA check.
- It avoids starting with a subjective diagnostic from a provider whose offer overlaps
  our own decision-support positioning.

## Current decision boundary

The read-only preflight may resolve the seller's current endpoint, read public
descriptors and obtain an unsigned HTTP 402 challenge. It may not create a payment
payload, sign, transfer funds, contact the seller or publish a verdict.

A GO preflight is not a purchase authorization. The separate buyer revalidates the whole
offer in the payment session itself and stops before signing on any changed host ambiguity,
product, method, resource, price, network, asset or recipient.

Delivery, correctness and buyer judgment remain separate from settlement, and no verdict or
communication is published automatically by the purchase.

## Case files

- [`evidence-dossier.md`](./evidence-dossier.md) — current facts, source classes and gaps.
- [`pre-purchase-decision-memo.md`](./pre-purchase-decision-memo.md) — contextual recommendation.
- [`purchase-brief.md`](./purchase-brief.md) — acceptance test and evidence to preserve.
- [`payment-execution.md`](./payment-execution.md) — authorization boundary, gates, run commands,
  evidence locations and the recovery limit.
- [`purchase-evidence-2026-07-26.json`](./purchase-evidence-2026-07-26.json) — sanitized
  transaction, delivery, reproduction and buyer-assessment facts.
- `preflight-YYYY-MM-DD.json` — generated read-only evidence when the current preflight runs.
