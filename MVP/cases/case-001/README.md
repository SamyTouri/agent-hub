# Case 001 — Buy three homepage hero options

## Case status

**Pre-purchase review complete; purchase not yet authorized or executed.**

This case starts from a real decision: whether Agent Reputation should spend **1 USDC on Base**
to buy exactly three homepage hero directions from `homepage-rewrite-agent-base-usdc` for the
current public homepage at <https://agentreputation.dev/>.

The buyer is Samy Touri acting for the Agent Reputation MVP. The purchase is useful only if Samy
would genuinely consider using a strong delivery. It is not a simulated order.

## Why this is the first case

- The offer is currently reachable and has a fixed price and deliverable.
- The financial exposure is deliberately small.
- The mission uses only public information and requires no credentials or private access.
- The result can be assessed against an explicit acceptance test.
- The seller already has several relevant evidence surfaces, including a prior delivered artifact,
  but important uncertainty remains. This makes the purchase decision non-trivial.

This internal purchase can test the MVP's evidence and decision process end to end. It **cannot**
validate external demand for Agent Reputation's own service.

## Decision question

Should Agent Reputation buy the seller's **Three Homepage Hero Options** service for 1 USDC, given
the available evidence, the limited exposure, and the lack of an independently confirmed buyer
review?

## Proposed course of action

**Proceed with safeguards**, subject to a separate explicit authorization from Samy immediately
before payment. The recommendation, evidence and conditions are in
[`pre-purchase-decision-memo.md`](./pre-purchase-decision-memo.md).

No purchase, wallet signature, contact message, production edit or automatic use of the eventual
copy is authorized by this document.

## Case files

- [`evidence-dossier.md`](./evidence-dossier.md) — source-linked facts, claims, observed work and gaps.
- [`pre-purchase-decision-memo.md`](./pre-purchase-decision-memo.md) — contextual recommendation.
- [`purchase-brief.md`](./purchase-brief.md) — proposed request and acceptance test for a later order.
- [`preflight-2026-07-23.json`](./preflight-2026-07-23.json) — preserved read-only
  revalidation of the live x402 challenge (GO on payment facts; seller manifest unreachable).
- [`../../x402-payment-setup.md`](../../x402-payment-setup.md) — inactive seller setup and the
  separately gated executable buyer prepared for this case.

## Evidence boundary

- Review opened: 2026-07-22
- Last live evidence check: 2026-07-23 12:07 Europe/Brussels
- Evidence type: public sources and reproducible read-only checks
- Seller contacted: no
- Payment attempted: no
- Private information used: no

## Protected boundaries for the case definition

- No change to the constitution.
- No change to `Communication/`.
- No application code change was made while defining or deciding the case. A separate,
  later x402 work step has now prepared inactive testnet payment code.
- No commit or push.
