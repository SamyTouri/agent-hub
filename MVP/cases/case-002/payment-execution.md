# Case 002 — authorized payment execution

## Authorization boundary — consumed

Samy authorized, on 2026-07-26, **exactly one** purchase:

| Element | Authorized value |
| --- | --- |
| Product | `GET /v1/page-signals` |
| Query | `url=https://agentreputation.dev/` (public page only) |
| Price | exactly `50000` atomic units — 0.05 USDC |
| Network | Base mainnet (`eip155:8453`) |
| Asset | native Circle USDC `0x8335…2913` |
| Recipient | `0x2906E0CDDB5FF4754D639AbfBE65c6cA708aC27E` |
| Buyer wallet | `aghub-prepurchase-mainnet-buyer` (already provisioned and funded; **no new account**) |

Anything else — another product, method, resource, price, network, asset or recipient — is a
**new purchase decision**, not a retry. The code fixes these values; none is configurable by
flag or environment variable.

The purchase completed on 2026-07-26. This authorization is consumed and does not permit
running `Pay` again. The completed recovery record contains no replayable signature, and
the tracked payment guard is now permanently closed even if the local record is removed.

## Components

| Piece | Where | Role |
| --- | --- | --- |
| Pure payment guards | `lib/case002-payment.ts` | Authorization gates, spend controls, same-session revalidation, post-signature validation, recovery validation, bounded summary. No network, no secrets, no signing. |
| Executable buyer | `scripts/case-002-pay.mts` | The only path that can spend. Inert unless every gate is satisfied. |
| Secret-blind wrapper | `scripts/Invoke-Case002.ps1` | `-Action Preflight | Pay | Resume`. Loads CDP values from Bitwarden/DPAPI straight into the child process environment and clears them afterwards. |
| Fail-closed tests | `scripts/case-002-payment.test.mts` | 18 tests, no network/secrets/wallet. Wired into `npm run test`. |

## Gates that must all hold before a cent moves

1. `--execute` **and** `--i-authorize-case-002-payment` on the command line.
2. `CASE002_EXECUTE` exactly equal to
   `I-AUTHORIZE-EXACTLY-0.05-REAL-USDC-FOR-AGENT-REPUTATION-CASE-002`. A Case-001 sentinel, a
   lowercase variant or a trailing space is refused (tested).
3. `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, `CDP_WALLET_SECRET` present in the process
   environment — supplied only by the wrapper, never printed or persisted.
4. **Same-session revalidation**, always, including on recovery: the seller host is resolved
   from the live Agent Reputation profile (never from a stored URL), the manifest must still
   declare `GET /v1/page-signals` at `$0.05` to the expected recipient, and the unsigned GET
   must return HTTP 402 with a v2 `exact` challenge bound to the exact resource URL, at exactly
   50,000 atomic native USDC to that recipient. Any mismatch stops **before** signing.
5. Redundant CDP spend controls: max per payment and max cumulative both 50,000 atomic over a
   24 h window, restricted to Base mainnet, native USDC and the seller's address.
6. Post-signature local validation of the payload, plus a check that the signing wallet address
   equals the signed payer.

## Running it

```powershell
pwsh -File scripts\Invoke-Case002.ps1 -Action Preflight   # read-only, no secrets, no spend
pwsh -File scripts\Invoke-Case002.ps1 -Action Pay         # spends 0.05 USDC, once
pwsh -File scripts\Invoke-Case002.ps1 -Action Resume      # replays the SAME signature only
```

## Evidence locations (all gitignored, under `.exchange/codex/`)

| File | Content |
| --- | --- |
| `case-002-payment-pending.json` | Before submission: the one-use signed authorization, for recovery only. Written with an exclusive create — if it already exists the run **refuses** rather than signing a second authorization. After submission it is overwritten with a completed record that carries the transaction, the response hash and no replayable signature. |
| `case-002-paid-response.json` | The exact paid response, preserved verbatim with its SHA-256, alongside the payment facts, with `correctness` and `buyer_judgment` deliberately left null. |

The terminal prints only a bounded sanitized summary (600-character body preview, hash, byte
count). The full artefact stays in the evidence file.

## Recovery limit — stated honestly

On a paid GET, payment and delivery travel in the **same** HTTP response. `Resume` replays the
identical signed authorization and never creates a second one, but the EIP-3009 nonce is already
consumed, so the seller may legitimately decline to serve the content again. A lost response can
therefore cost 0.05 USDC without yielding the artefact. That outcome must be recorded as
**paid-without-delivery**, which is itself a real evidence class — not written off as an
unexplained failure. The buyer exits with code 4 and a warning when the paid response is not 200.

## Facts that stay separate

Settlement, delivery, correctness, buyer judgment and public claims are five distinct facts. The
evidence file keeps `correctness` and `buyer_judgment` empty on purpose: they are filled by a
separate human assessment — reproducing the extracted fields independently against the public
page and judging them against the acceptance test in `purchase-brief.md`. **Nothing is published
automatically from this run**, and no verdict about the seller follows from a successful payment.
