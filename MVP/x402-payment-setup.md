# x402 payment capability — setup and operations (testnet-first)

Status: **implemented and validated end to end on Base Sepolia; mainnet remains inactive**.
The paid endpoint still fails closed (HTTP 503, no payment challenge) unless its private runtime
environment explicitly activates it. The Supabase ledger migration is applied. Dedicated CDP
test wallets exist, but their secrets remain only in Bitwarden/DPAPI and no test configuration
was added to `.env.local`, Vercel or the repository.

Companion decision document:
[`payment-rails-analysis-2026-07-23.md`](./payment-rails-analysis-2026-07-23.md).
The Belgian tax/accounting question is recorded but, per the founder's decision, is not a
testnet-engineering blocker; it becomes an explicit operating review trigger before the pilot
can exceed 100 EUR/USDC in gross receipts.

## What was built

| Piece | Where | Role |
| --- | --- | --- |
| Paid endpoint | `app/api/prepurchase/order/route.ts` | `POST /api/prepurchase/order` — x402 v2 challenge (402), verify + settle via facilitator, idempotent order record, stable receipt. `GET` returns machine-readable usage. |
| Domain rules | `lib/prepurchase.ts` | Fail-closed config, strict intake schema, 1 USDC fixed price, 100 USDC stop, idempotency, receipt (never echoes the private contact). |
| Protocol primitives | `lib/x402.ts` | Strict x402 v2 header/payload validation, USDC network constants, buyer-side challenge normalization (v1+v2) and offer evaluation. |
| Private ledger SQL | `db/migration-prepurchase-orders.sql` + `db/schema.sql` | Applied to Supabase on 2026-07-23. RLS enabled, no `anon`/`authenticated` access. Payment, delivery and buyer outcome are separate fact groups. |
| Buyer preflight tool | `scripts/case-001-preflight.mts` | Read-only Case-001 offer verification. Cannot spend by design. |
| Executable Case-001 buyer | `scripts/case-001-pay.mts` | Separately gated CDP wallet preparation, exact 1-USDC spend controls, two explicit payment authorization gates, pre-signature challenge validation and crash-safe replay file. Never executed during this implementation. |
| Official SDK integration | `@coinbase/cdp-sdk` + `@x402/*` | Authenticated CDP facilitator on mainnet and official CDP wallet/payment-payload creation for Case-001. Versions are pinned. |
| Testnet wallets + acceptance | `scripts/prepurchase-testnet-wallets.mts`, `scripts/prepurchase-testnet-e2e.mts`, `scripts/Invoke-PrepurchaseTestnet.ps1` | Zero-secret provisioning/faucet/readback and a fixed Base Sepolia x402 acceptance test with crash-safe replay. |
| Tests | `scripts/prepurchase.test.mts` | 33 payment tests, no network/secrets/DB (`npm run test`). |

The route keeps strict local validation around the official x402 v2 shapes:
`PAYMENT-REQUIRED` / `PAYMENT-SIGNATURE` / `PAYMENT-RESPONSE` (base64 JSON), CAIP-2 networks
and the `exact` EIP-3009 scheme. Verification and settlement now go through the official
`HTTPFacilitatorClient`; mainnet authentication uses the official
`createCdpFacilitatorClient()` JWT integration. Case-001 uses the official
`CdpX402Client` to provision/sign with a named CDP wallet rather than handling a private key.

## Validation performed

- `npm test`: **45/45** pass (33 payment-specific plus the existing representative tests).
- `npm run typecheck`: pass.
- `npx next build` with Next.js 16.2.11: pass; `/api/prepurchase/order` is a dynamic route and
  the build does not require payment secrets or touch the database.
- Local production-runtime smoke: inactive POST returns 503 without a payment challenge; an
  explicitly enabled Base Sepolia POST returns 402 with the exact 1-USDC challenge; oversized
  intake returns 413; payment responses are marked `private, no-store`.
- Production dependency audit after security overrides: **0 high, 0 critical**. Seven moderate
  advisories remain in the pre-existing MCP/OpenAI/Hono dependency chain; npm proposes old-package
  downgrades rather than a safe compatible upgrade, so they were not forced into this MVP change.
- Case-001 live preflight: GO on the observable PayanAgent payment facts, recorded in
  `cases/case-001/preflight-2026-07-23.json`; the seller manifest was unreachable and no order POST
  was made.

Funded Base Sepolia acceptance completed on 2026-07-23:

- private CDP project: `Agent Reputation MVP Testnet`;
- receiver account: `aghub-prepurchase-test-receiver`,
  `0x53f4De7AB936BFd1Be9D4fC5C3B3eee5664FbcBd`;
- buyer account: `aghub-prepurchase-test-buyer`,
  `0xA5f6cA2427F4fc42F01bf4199E62f5dc9eA2085D`;
- faucet funded exactly 1 test USDC; after settlement the buyer balance was `0` and receiver
  balance `1000000` atomic units;
- x402 settlement transaction:
  `0x260964077697000869504f80c539e4a0da6c5dbca7df3a3459251d211a343680`;
- private order: `apo_bd068726617fd05532cc`, `payment_status=settled`;
- replay returned the same order id and transaction; Supabase independently showed exactly one
  row for the payment nonce;
- `delivered_at` and `buyer_outcome` remain unset, correctly preserving the distinction between
  payment, delivery and outcome.

The test used a deliberately non-deliverable fixture contact. It therefore validates payment and
ledger semantics, not a real delivery or buyer satisfaction. No Case-001 seller contact occurred.

## Environment variables (server-side only, never committed)

| Variable | Required | Meaning |
| --- | --- | --- |
| `PREPURCHASE_ENABLED` | yes | Must be exactly `true`. Anything else → offer inactive (503), no challenge issued. |
| `PREPURCHASE_PAY_TO` | yes | Dedicated Agent Reputation receiving address (`0x…`). Never a personal day-to-day wallet. |
| `PREPURCHASE_NETWORK` | no | `eip155:84532` (Base Sepolia, **default**) or `eip155:8453` (Base mainnet, gated below). Any other value → inactive. |
| `PREPURCHASE_FACILITATOR_URL` | no | Defaults to `https://x402.org/facilitator` on testnet and the authenticated CDP URL on mainnet. Mainnet refuses any non-CDP facilitator. |
| `PREPURCHASE_MAINNET_ACK` | mainnet only | Must be exactly `I-UNDERSTAND-THIS-ACCEPTS-REAL-USDC-ON-BASE-MAINNET`. |
| `CDP_API_KEY_ID` / `CDP_API_KEY_SECRET` | CDP wallet/test client; CDP mainnet facilitator | Server-side CDP credentials. Never committed or logged. |
| `CDP_WALLET_SECRET` | CDP wallet writes/signing | Authenticates non-custodial wallet operations. Never committed or logged. |

Fixed in code, deliberately not configurable: price **1 USDC** (`1000000` atomic), gross-revenue
stop **100 USDC**, delivery deadline **24 h**, scheme `exact`/EIP-3009, USDC contract per network
(Circle official addresses).

## Reproducible testnet sequence (Base Sepolia)

The migration and first funded run are complete. For a deliberate rerun, use the repository
wrapper; do not copy secrets into `.env.local` or a terminal command:

1. Keep the CDP API key and Wallet Secret in the Bitwarden entry mapped by
   `C:\Dev\scripts\GET-SECRET.ps1`.
2. Build without private environment values:
   `pwsh -File scripts\Invoke-PrepurchaseTestnet.ps1 -Action Build`.
3. Provision/read the fixed named accounts:
   `pwsh -File scripts\Invoke-PrepurchaseTestnet.ps1 -Action Provision`.
4. Fund the buyer from the CDP **Base Sepolia** faucet only when a new test payment is intended:
   `pwsh -File scripts\Invoke-PrepurchaseTestnet.ps1 -Action Fund`.
5. Execute the funded acceptance:
   `pwsh -File scripts\Invoke-PrepurchaseTestnet.ps1 -Action E2E`.
   The wrapper injects secrets only into child-process environment variables, stops the local
   server, clears those variables and removes the generated `.next` cache afterward.
6. Read back the public account addresses and balances without a transaction:
   `pwsh -File scripts\Invoke-PrepurchaseTestnet.ps1 -Action Inspect`.

The acceptance performs:

- local production server startup and exact challenge verification:
  - `GET http://localhost:3000/api/prepurchase/order` → `active: true`, `accepts_preview` on
    `eip155:84532`;
  - `POST` with a valid JSON body and no payment header → HTTP 402, `PAYMENT-REQUIRED` header
    present, `amount` = `1000000`, `asset` =
    `0x036CbD53842c5426634e7929541eC2318f3dCF7e`;
- CDP official x402 client signing with an EOA restricted to the fixed Base Sepolia network,
  Circle test USDC contract, one-USDC cumulative maximum and the dedicated receiver;
- first POST → 402; signed retry → 200 with `order_id`, payment transaction, evidence cutoff,
  delivery deadline and `PAYMENT-RESPONSE`;
- exact signed-payload replay → same `order_id` and same transaction;
- sanitized recovery proof after success (the replayable signature is overwritten);
- exactly one private `prepurchase_orders` row and independent CDP balance readback.

**Delivery drill (not performed by this payment fixture)** — deliver one manual brief to the
`delivery_contact` of a separately authorized test order, then fill
`delivered_at`/`delivery_reference` (and later `buyer_outcome`) by hand. These fact groups stay
separate from payment on purpose.

## Mainnet gate (do NOT cross casually)

Mainnet activation requires **all** of:

1. Samy's explicit go decision.
2. `PREPURCHASE_NETWORK=eip155:8453` **and** the exact `PREPURCHASE_MAINNET_ACK` sentence —
   mainnet is never inferred from `NODE_ENV`/`VERCEL_ENV`/deployment environment (tested).
3. CDP credentials in server-only environment variables. The route uses the official
   authenticated CDP facilitator client and refuses any other mainnet facilitator.
4. Re-verify on-chain the USDC EIP-712 domain (`name`/`version`) used in `extra` before the first
   mainnet challenge (`lib/x402.ts`, `USDC_NETWORKS`).
5. The funded Base Sepolia seller test is complete. Any minimal mainnet transaction still needs
   a new, separate authorization.

The pilot keeps complete payment records and stops at 100 USDC. Belgian tax/accounting
work is therefore treated as a follow-up trigger at that boundary, not as a blocker for
testnet engineering. This is an operating choice, not a claim that 100 EUR is a legal exemption.

## 100 USDC stop condition

`processPaidOrder` refuses any **new** settlement once settled orders plus conservative
capacity reservations would exceed 100 USDC (99 reserved/settled + 1 = 100 is the last
accepted order). The reservation is inserted under a PostgreSQL transaction-scoped advisory
lock before `settle`, so concurrent Vercel functions cannot both cross the boundary. A
reservation whose settlement result is uncertain remains counted until retry or manual
reconciliation: the system may stop early, but it fails closed rather than overshooting.
Replays of already-settled payments remain honored after the stop.

## Private delivery contact / approved email

- The founder-approved private email is **never** written to the repo, logs or public responses.
- Seller side: the buyer supplies their own `delivery_contact` in the paid POST; it is stored
  only in the private RLS ledger, never echoed in the receipt, never logged.
- Buyer side (Case-001): supply it at execution time via the `CASE001_DELIVERY_CONTACT`
  environment variable (e.g. exported from Bitwarden in the shell session); the preflight tool
  masks it in every report it prints or saves.

## Buyer side — Case-001 preflight

```
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types scripts/case-001-preflight.mts
```

Default mode is **read-only** (seller manifest + observable 402 challenge; no POST to the order
endpoint, per dossier constraint M-007). It re-verifies scheme/network/asset/price ceiling/
recipient against the documented Case-001 expectations and prints a GO / NO-GO evidence report
(`--save <file>` to preserve it). `--probe-post` (opt-in, creates seller-side state) submits the
intake without payment.

The actual buyer is a separate script:

```text
scripts/case-001-pay.mts
```

It also has a **wallet-only preparation mode**. This is an external CDP account write, so it has
its own exact `CASE001_WALLET_PREPARE` sentinel. When deliberately executed with
`--prepare-wallet`, it provisions or retrieves the fixed named CDP wallet and prints only its
public Base address plus the exact 1-USDC funding requirement. It does not contact the seller,
sign a payload, move funds or authorize a later payment. This mode exists so the address can be
funded before the real purchase rather than discovering an empty wallet mid-payment.

Operational order:

1. Create the CDP project and keep `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET` and
   `CDP_WALLET_SECRET` in the private environment only.
2. Set `CASE001_WALLET_PREPARE` to the exact sentinel printed by the script, then deliberately run
   `case-001-pay.mts --prepare-wallet`. This creates/retrieves the named wallet but cannot pay.
3. Send exactly the intended test funding (1 USDC on Base; no ETH is required for the buyer's
   EIP-3009 signature) to the printed EVM address and confirm it independently.
4. Clear the preparation sentinel. A later payment still requires the completely separate gates
   below; possession of a funded wallet is not payment authorization.

It remains inert unless all of these are simultaneously supplied:

- `--execute`;
- `--i-authorize-case-001-payment`;
- the exact `CASE001_EXECUTE` sentinel printed by the script;
- the private `CASE001_DELIVERY_CONTACT`;
- `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET` and `CDP_WALLET_SECRET`.

Before signing, it POSTs the real intake without payment and refuses any challenge that is not
**exactly** 1 USDC, Base mainnet, native USDC and the documented recipient. The CDP client then
applies redundant spend controls for the same amount, network, asset and payee. The signed
one-use authorization is written just before submission to
`.exchange/codex/case-001-payment-pending.json` so a lost HTTP response can be retried with
`--resume-pending` without creating a second authorization. After success, that file is
overwritten with a sanitized receipt: signature and private contact are removed.

The script has been tested only in its inert and pure-validation paths. Its wallet-preparation
mode has not been executed: it has **not** provisioned a wallet, contacted the seller, signed or
paid.

## Neutrality boundary (product rule, enforced in copy and data model)

Payment buys a contextual pre-purchase analysis for the **buyer**. It never buys a rating, a
ranking, a verdict, or any treatment of any seller on Agent Reputation. The ledger keeps
settlement, delivery and buyer outcome as separate facts; none of them feeds any public
reputation surface.
