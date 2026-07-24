# MVP payment rails analysis — 2026-07-23

## Decision

For the first low-price, agent-native monetization test, use:

- **x402 v2** as the payment protocol;
- **USDC on Base** as the initial asset and network;
- the **Coinbase Developer Platform facilitator** for verification and settlement;
- one dedicated Agent Reputation receiving wallet;
- one fixed-scope offer priced at **1 USDC** during the validation phase.

This is a payment-rail decision, not a decision to make Agent Reputation dependent on Coinbase,
Base or a transaction marketplace. x402 is an open, multi-network protocol. Base is the first rail
because it currently offers the best combination of agent adoption, USDC liquidity, low cost,
official SDK support and operational simplicity.

Per the founder's decision, the Belgian invoicing/accounting route is **not** an engineering or
pilot-launch blocker at this experimental scale. Keep a complete private ledger and stop new
receipts at 100 USDC so the question is reopened deliberately at that threshold. Receiving USDC
proves payment; it does not itself issue a Belgian invoice or determine how the revenue must be
recorded, and 100 EUR/USDC is an operating trigger rather than a claimed legal exemption.

## What each component does

- **Base** is the blockchain network that settles the transfer.
- **USDC** is the dollar-denominated stablecoin transferred between buyer and seller.
- **x402** is the HTTP protocol that tells an agent what to pay, verifies its signed payment and
  returns the purchased resource or order confirmation.
- A **facilitator** verifies and submits the payment without requiring Agent Reputation to operate
  blockchain infrastructure.
- A **wallet** receives the USDC. It is not an invoice, merchant account or legal entity.
- A **CDP account** provides production facilitator credentials. It is distinct from a Coinbase
  consumer account and from Coinbase Business.

## Evidence for the choice

### Agent-native adoption

The x402 Foundation currently reports, for the preceding 30 days, 75.41 million transactions,
24.24 million USD in volume, 94,060 buyers and 22,000 sellers. These figures are ecosystem-reported,
not an independently audited market-share study, but they are the strongest visible adoption signal
found for an open agent-native payment protocol.

Source: <https://www.x402.org/>

The foundation ecosystem includes major payment, cloud and commerce participants. This is evidence
of institutional support, not proof that every integration is generally available or mature.

Source: <https://www.x402.org/ecosystem>

### Cost and technical fit

The CDP facilitator supports Base mainnet, USDC and other ERC-20 assets. Its published pricing is:

- first 1,000 transactions per month: free;
- above the free tier: 0.001 USD per transaction;
- network gas handled separately, with gas sponsorship available for the recommended flow.

Source: <https://docs.cdp.coinbase.com/x402/core-concepts/facilitator>

The official seller SDK supports Next.js through `@x402/next`, with fixed-price (`exact`) and
usage-based (`upto`) schemes. This matches the current Next.js application without requiring a
separate payment service.

Source: <https://docs.cdp.coinbase.com/x402/quickstart-for-sellers>

### International reach

Base is technically global and permissionless: a buyer with a compatible wallet and USDC can pay
without opening an account with Agent Reputation. Coinbase describes Base payments as low-fee,
near-instant and suitable for agentic payments.

Source: <https://www.base.org/payments>

This is not the same as universal availability. Wallet funding, fiat conversion, sanctions
screening, local regulation and the usability of on-ramps differ by jurisdiction. The CDP
facilitator performs transaction-risk screening and can refuse sanctioned or high-risk addresses.

Coinbase currently lists Belgium as eligible for both fiat-to-USDC and USDC-to-fiat exchange.

Source: <https://help.coinbase.com/en/coinbase/getting-started/crypto-education/usdc-regions>

### Why not use ordinary Stripe first

Stripe is available in Belgium and is the stronger human checkout rail. Its standard Belgian price
for an EEA card is currently 1.5% plus 0.25 EUR. On a 1 EUR purchase, the fixed fee alone consumes
one quarter of the price.

Source: <https://stripe.com/en-be/payments>

Stripe also documents x402 support, but it is currently a private preview requiring crypto pay-ins
and machine-payments access. It is not the simplest immediate production path.

Source: <https://docs.stripe.com/payments/machine/x402>

Stripe should be considered later for human buyers, refunds, conventional receipts and higher-value
orders. It should not block the first agent-native micropayment test.

### Alternatives considered

- **Bitcoin Lightning / L402**: credible, low-cost and agent-compatible, but requires Bitcoin or
  Lightning wallet/liquidity handling and has a narrower fit with the USDC-oriented services already
  observed in Case 001.
- **Marketplace-specific balances or tokens**: easy inside one marketplace but create lock-in and
  weaken cross-registry neutrality.
- **Direct wallet transfers without x402**: technically simple but weakly bind the payment to the
  requested mission and create more reconciliation work.
- **Stripe Checkout only**: excellent for humans, poor economics for a 1 EUR agent-native test.
- **Multiple chains at launch**: unnecessary complexity before one rail has produced a real
  transaction.

No neutral market-share study proves that one payment rail is used by most agents. The conclusion
is narrower: x402 currently has the strongest combination of visible agent-native adoption,
institutional support, open interoperability and micropayment economics.

## Recommended first paid offer

### Pilot offer

**One manual pre-purchase evidence brief — 1 USDC**

Buyer input:

- candidate agent or service;
- intended mission;
- expected budget or exposure;
- consequence of failure;
- public constraints or guarantees already offered;
- delivery address or contact.

Immediate paid response:

- stable order identifier;
- payment settlement reference;
- accepted scope;
- evidence cutoff;
- promised delivery deadline.

Manual delivery:

- established facts and sources;
- plausible but insufficient claims;
- contradictions and missing evidence;
- safeguards to request;
- contextual proceed / postpone / do-not-buy recommendation;
- explicit limits and no safety guarantee.

The 1 USDC price is a validation price, not a sustainable valuation of the manual work. It tests
whether an external buyer will cross a real payment boundary. It must not be presented as permanent
pricing.

## Minimum safe architecture

1. Create a CDP developer project using a founder-approved private admin email.
2. Create a dedicated Agent Reputation receiving wallet; do not reuse a personal day-to-day wallet.
3. Keep wallet and CDP secrets in Bitwarden and production environment variables, never in the
   repository or logs.
4. Build and test the full flow first on Base Sepolia with test USDC.
5. Expose one fixed-price `POST` endpoint with an explicit input schema.
6. Return the x402 challenge before creating a paid order.
7. Verify and settle through the CDP facilitator.
8. Use the signed EIP-3009 nonce as the order idempotency key and retain the settlement transaction
   hash, so a replay of an already-recorded payment returns the same order.
9. Reserve capacity atomically before settlement, but mark an order paid only after confirmed
   settlement. An uncertain reservation requires retry or operator reconciliation.
10. Return an order receipt and deadline; record delivery and buyer outcome separately.
11. Keep all database queries sequential to respect the existing one-connection pool constraint.
12. Run one real low-value transaction only after founder approval. Keep a complete private
    payment ledger; reopen Belgian tax/accounting work if gross receipts approach 100 EUR/USDC.

## Deferred legal and accounting review

Samy currently invoices freelance work through SMART Belgique. A direct USDC transfer to a personal
or project wallet may bypass that established invoicing route.

This review is deliberately deferred during the sub-100-USDC validation phase. Reopen it with
SMART or an accountant if gross receipts approach the operational stop, or sooner if a customer
requires a conventional invoice:

- which legal entity or activity issues the invoice;
- whether SMART can recognize a crypto-denominated payment or whether it requires the client to pay
  SMART directly in fiat;
- how the EUR value is fixed at transaction time;
- VAT and cross-border treatment for a digital service;
- how wallet, transaction and conversion fees are documented;
- whether a personal Coinbase account may be used to off-ramp business revenue;
- what customer identity fields are required for an invoice.

Belgian VAT obligations attach to the economic activity, not to the payment rail. MiCA regulates
crypto-asset service providers, but accepting payment for Agent Reputation's own service is not by
itself the same as operating a crypto exchange or custody service.

Sources:

- <https://finance.belgium.be/en/enterprises/vat/vat-obligation/vat-obligation>
- <https://www.fsma.be/fr/crypto-asset-service-provider-casp>
- <https://www.nbb.be/fr/supervision-financiere-et-resolution/controle-des-etablissements-financiers/reglement-sur>

This document is product and technical analysis, not Belgian tax or legal advice.

## Account implications

- A **CDP developer account** is worth creating for testnet and the production facilitator.
- A **dedicated receiving wallet** is required.
- A standard **Coinbase personal account** is available in Belgium and Coinbase lists Belgian
  fiat/USDC conversion as supported, but it should not automatically become the project's merchant
  account.
- **Coinbase Business** is currently available only to eligible entities in the United States and
  Singapore, so it is not the immediate Belgian answer.
- The founder-approved personal email can be used privately for CDP administration and internal
  notifications. It should not be embedded in public source code or used as the permanent public
  billing identity.

Source: <https://help.coinbase.com/en/coinbase/other-topics/business/business-overview>

## Recommended sequence

1. Create the CDP account and dedicated wallet.
2. Apply the private ledger migration and activate the endpoint on Base Sepolia.
3. Run an end-to-end test with test USDC and verify request, payment, order and receipt binding.
4. Review the resulting diff and operational evidence independently when a second reviewer is
   available. Do not simulate or falsely claim an independent review; the founder may explicitly
   accept a solo-reviewed pilot in the meantime.
5. Decide explicitly whether to expose the 1 USDC pilot on mainnet.
6. Run one real external transaction and measure whether payment, delivery and outcome evidence are
   all captured.
7. Reopen Belgian tax/accounting work at the 100-EUR/USDC operating trigger (or earlier if a
   conventional invoice is requested).
8. Add Stripe later if human demand appears or if conventional fiat invoicing is required.

## Decision boundaries

- Charging the **buyer** for a contextual decision memo is aligned with the current neutral model.
- Charging a seller for a favorable dossier, recommendation or ranking is excluded.
- The payment provider must not influence the analysis.
- x402/Base is an initial rail, not a constitutional dependency or permanent lock-in.
- Payment evidence remains separate from delivery quality and buyer satisfaction.
