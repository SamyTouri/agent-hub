# Can an observed payer address be resolved to a reachable agent? — measurement, 2026-07-31

*The question left open by `docs/buyer-channels-2026-07-30.md`, answered on real data instead
of estimated. Every figure below comes from a run of `scripts/payer-identifiability.mts`; the
tool is in the repository so the measurement can be repeated and contradicted.*

## Why this number decides a build

Reaching an agent you have **identified** is easy: ERC-8004 registration files publish `web`,
`A2A`, `MCP` and `email` endpoints next to the payment address, and a machine endpoint answers
continuously with no gatekeeper. What does not exist is the reverse direction — from an address
seen on chain to the agent holding it. The standard defines no reverse lookup.

Building that index is the heaviest item on the ranked channel list. It is only worth building
if observed payer addresses are resolvable at all. That ratio had never been measured; the
2026-07-30 note said so explicitly and called it a guess.

## Method

Real x402 resources were taken from the CDP discovery catalogue and filtered **client-side** to
Base mainnet — that facilitator ignores its own `payTo`/`network`/`type` filters, measured
2026-07-30, so no restriction is delegated to it. For each announced receiving address, USDC
`Transfer` logs arriving at that address were read from the public Base RPC; the senders are the
payers. Each distinct payer was then looked up in the public ERC-8004 agent index (8004scan).

Two guards, both from earlier failures. A log range that fails is counted and reported, so an
incomplete window can never read as "few payers". And every index hit is re-checked client-side
against the requested address: an unrecognised filter on that index returns the **whole list**
instead of an error, measured 2026-07-31, so a non-matching answer is scored `inconclusive`,
never `unknown`.

## Result — pilot run

| | |
|---|---|
| Catalogue entries scanned | 100 of 14 795 announced |
| Distinct Base receiving addresses sampled | 12 |
| Block window | 49 307 672 → 49 347 672 (40 000 blocks, ≈22 h) |
| Failed log ranges | 0 |
| Distinct payer addresses observed | 190 |
| Resolved to a registered agent | **31** |
| Not found in the index | 159 |
| Inconclusive | 0 |
| **Share of decided lookups that resolve** | **16.3 %** |

The 31 matches are 31 distinct addresses carrying 31 distinct agent names — `garciaclaw`,
`collateral-flux-engine`, `vostro-correspondent`, `dorsa-batch-clerk` and so on. They are not one
shared relayer counted repeatedly, which was the failure mode most likely to inflate this figure.

## What the number means, and what it does not

**It is a lower bound, and the gap is structural.** The index exposes the address that *owns the
agent token*, not the `agentWallet` declared inside the registration file. An agent paying from a
properly separated service wallet is counted here as unknown. The true resolution rate is at
least 16.3 % and cannot be below it.

**Roughly one payer in six is already identifiable from its address alone** — and each one, being
registered, publishes machine endpoints that answer continuously. For that sixth, the chain from
an observed payment to a reachable counterpart is complete today, with no index of ours.

**What it does not say.** A payer address may be a human wallet, a relayer or a facilitator
rather than a buying agent; the name in the index is a self-declared label, not a verified
identity; and 22 hours of one day on twelve sellers is an order of magnitude, not a census.

## Consequence for the plan

The heavy build was ranked third on the assumption that the reverse index had to be created
before an observed payer could be reached. That assumption is now partly false: for a
non-trivial share of payers, a public index already answers, free and without a key.

What remains genuinely missing is narrower — resolving the payment wallets that are *not* the
token owner, which requires reading registration files rather than querying the existing index.
That is a smaller and better-defined piece of work than the one the plan described, and it
should be scoped against a measured gap rather than an assumed one.

**Correction to `docs/buyer-channels-2026-07-30.md`, dated 2026-07-31.** That note stated the
ratio was unknown and the size of channel 1 a guess. It is no longer unknown; the floor is
16.3 %. The note is left standing with this pointer rather than rewritten.
