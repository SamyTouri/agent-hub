# Pre-purchase decision memo — Case 002

> **Outcome update — 2026-07-26:** Samy later authorized the exact purchase described
> here. It settled, delivered HTTP 200 JSON and passed independent field-by-field
> reproduction. This memo remains the pre-purchase reasoning, not the outcome record;
> see `purchase-evidence-2026-07-26.json`.

## Decision

**Proceed with safeguards, subject to a new explicit payment authorization from Samy.**

The proposed purchase is 0.05 USDC for structured public-page signals about Agent
Reputation's homepage. The financial and data exposure are small, the output should be
immediate, and its factual fields can be checked independently.

This recommendation is not authorization to pay.

## Why this is preferable to the other low-cost routes

- The 0.01 USDC headline/CTA snapshot substantially overlaps the free check already run.
- The 0.03 USDC market-pricing snapshot does not test the candidate on our own page.
- The 0.25 USDC diagnostic is richer but more subjective and creates a stronger
  competitor-as-judge conflict.
- The 0.05 USDC page-signals product is the lowest-cost route that should create a
  distinct, reproducible paid artefact.

## Required safeguards

- Resolve the seller endpoint from its live profile in the same session as payment.
- Require the exact GET resource, x402 v2, scheme `exact`, Base mainnet, native USDC,
  50,000 atomic units and the expected recipient.
- Stop on any changed product, method, resource, price, asset, network or recipient.
- Use only the public homepage URL; provide no credential, personal data or private strategy.
- Preserve the unsigned challenge before signing.
- Keep transaction, delivery and buyer assessment separate.
- Never publish the raw paid output or a verdict automatically.

## What a successful purchase would prove

It would prove that our buyer can settle a fixed x402 GET against an external seller and
that this specific response was delivered, if the response arrives. Reproduction can
then show which fields were correct for this page at that time.

It would not prove external demand for Agent Reputation, future seller reliability,
legal identity, security, commercial effectiveness or the quality of the seller's more
expensive products.
