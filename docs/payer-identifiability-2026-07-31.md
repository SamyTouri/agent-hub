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

## Result

Two runs, and **the second is the one to quote**. The first was a pilot on twelve sellers over
roughly a day; it returned 16.3 % and that figure was wrong to rely on. Widening the sample to
thirty-five sellers over about four days more than halved it. Both are recorded here because a
number that moved by a factor of two under a wider sample is a fact about how much this
measurement can be trusted, and deleting the pilot would hide it.

| | Pilot | **Wide run — quote this one** |
|---|---|---|
| Base receiving addresses sampled | 12 | **35** |
| Block window | 40 000 (≈22 h) | **150 000 (≈3.5 days)** |
| Failed log ranges | 0 | **15** |
| Distinct payer addresses observed | 190 | **1 071** |
| Resolved to a registered agent | 31 | **92** |
| Not found in the index | 159 | **979** |
| Inconclusive | 0 | **0** |
| **Share of decided lookups that resolve** | 16.3 % | **8.6 %** |

So roughly **one payer in twelve**, not one in six. The matches carry distinct agent names —
`ShengWang_Trade_AI`, `garciaclaw`, `inkstone-router`, `cyclops-oracle`, `thrum-settler` — so
they are not one shared relayer counted repeatedly, which was the failure mode most likely to
inflate the figure. Zero lookups were inconclusive in either run.

Fifteen log ranges failed in the wide run out of 525, so some payers were missed. That
understates the payer count; whether it moves the ratio is unknown, since a missed payer is as
likely to be registered as not.

## What the number means, and what it does not

**It is a lower bound, and the gap is structural.** The index exposes the address that *owns the
agent token*, not the `agentWallet` declared inside the registration file. An agent paying from a
properly separated service wallet is counted here as unknown. The true resolution rate is at
least 16.3 % and cannot be below it.

**Roughly one payer in twelve is already identifiable from its address alone** — and each one,
being registered, publishes machine endpoints that answer continuously. For that twelfth, the
chain from an observed payment to a reachable counterpart is complete today, with no index of
ours. Eleven in twelve remain unreachable from the address, which is the majority and should be
stated first in any summary of this page.

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
8.6 %. The note is left standing with this pointer rather than rewritten.

**Correction to this page's own first version, same day.** It was written and committed with
the pilot's 16.3 % as its headline before the wide run finished. That figure stood for about
forty minutes and is superseded by 8.6 %. Recorded rather than rewritten, because a page that
exists to argue against numbers presented as knowledge cannot quietly swap one of its own.
