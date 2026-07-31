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

## Second measurement, same day — is the floor far below the ceiling?

The figure above is a floor because the index exposes the **token owner** address, while the
address an agent is paid at is declared inside its registration file. If agents routinely
separate the two, the true rate would be far higher and the index worth building. So the
registration files were read at the source: `tokenURI` on the identity contract, then the
document itself. Tool: `scripts/agent-wallet-gap.mts`.

Sample: 200 agents on Base. 154 registration documents read (31 tokenURI unreadable after
retries, 15 documents unreadable).

| | |
|---|---|
| Declaring a payment wallet at all | **19 of 154 — 12 %** |
| …of which same address as the token owner | **17** |
| …of which **different** from the token owner | **2** |
| Addresses the public index would miss entirely | **2** |
| Publishing at least one machine endpoint | **99 of 154 — 64 %** |

**The gap is small, and the index is not worth building.** Among agents that declare a payment
address, **89 % use the same address that already appears in the public index**. Building the
reverse lookup ourselves would add two addresses out of 154 — the floor of 8.6 % is close to the
ceiling, not far below it.

**The real reason the reverse lookup is weak is different from the one assumed.** It is not that
agents separate their wallets. It is that **88 % of registrations never state a payment address
at all.** The registration file is a business card, not a payment directory, so no amount of
reading it harder produces the missing index.

**And the asymmetry is confirmed from the other side.** 64 % publish a machine endpoint that
answers continuously. Once you know *which* agent you want, reaching it is easy. Identification
is the bottleneck; contactability is not.

Two measurement traps were hit and fixed before these numbers, both worth recording. A first
pass returned **zero** declared wallets — caused by our own reader, which treated a `tokenURI`
containing the JSON document inline (rather than a link to it) as unreadable, and the very first
declared wallet we later found was in exactly that form. A second pass lost 180 reads of 220 to
rate limiting on the public RPC and would have reported them as missing documents; spacing the
calls recovers them. Both would have produced a false zero indistinguishable from a finding.

## Consequence for the plan

**Drop the index from the plan.** It was ranked third on the assumption that building it would
turn observed payers into reachable parties. Measured, it would move the resolution rate by two
addresses in 154. The remaining eleven payers in twelve are unreachable because they never
registered anything at all, and no index we build can fix that.

That is not a failure of the bureau, because **notification is not what makes a filing valid**.
A file is admissible on a signature from one of the two addresses of a settled matter; the
counterparty is notified when a channel exists, and when none does the file is published with
the failed notification attached — having no working contact while taking payment is itself a
fact about a party. The measured consequence is simply that this branch will be the common case,
not the exception, and the public method page should say so plainly rather than let a reader
assume the counterparty was usually reached.

**Correction to `docs/buyer-channels-2026-07-30.md`, dated 2026-07-31.** That note stated the
ratio was unknown and the size of channel 1 a guess. It is no longer unknown; the floor is
8.6 %. The note is left standing with this pointer rather than rewritten.

**Correction to this page's own first version, same day.** It was written and committed with
the pilot's 16.3 % as its headline before the wide run finished. That figure stood for about
forty minutes and is superseded by 8.6 %. Recorded rather than rewritten, because a page that
exists to argue against numbers presented as knowledge cannot quietly swap one of its own.
