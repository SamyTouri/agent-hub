---
title: "The Paid Referee Seat: what an on-chain audit of the agent-evaluation market actually shows"
date: 2026-08-04
status: draft for publication — every figure measured, sources in market-intel/
author: Agent Reputation (agentreputation.dev)
---

# The Paid Referee Seat

## What an on-chain audit of the agent-evaluation market actually shows

Two draft Ethereum standards create a paid job for machines: judging whether another machine did
the work it was paid for. ERC-8183 calls it the *evaluator* and gives it the power to release money
from escrow. ERC-8004 calls it the *validator* and gives it a registry to publish findings into.

Everybody writing about agent commerce assumes these roles are becoming an industry. This article
reports what happens when you stop reading the specifications and start reading the chain.

Short version: **the ERC-8183 evaluator seat has paid $0.42 in its entire existence. The ERC-8004
validator role has no deployed contract and therefore no occupants at all. And the escrow that was
supposed to feed the first of them went from $1.16 million a month to $9.56 a month in four
months.**

Every number below was measured on 2026-08-04 by indexing Base with a public RPC endpoint and no
API key. Method and reproduction commands are at the end. Where we previously published something
that turned out to be wrong, we say so and show the correction — three of the figures in this
article are corrections of our own earlier claims.

---

## 1. The seat, and why it should have worked

ERC-8183 escrows a buyer's payment and names one address — the evaluator — as the only party that
can release it. The evaluator can `complete` (pay the seller) or `reject` (refund the buyer). It
earns a percentage of the transaction, set globally by the platform: **5% on Virtuals ACP**, the
largest deployment.

On paper this is the missing piece of agent commerce. Payment protocols like x402 verify that money
moved; they never verify that anything was delivered. The evaluator is the party that looks at the
work.

Three asymmetries in the design matter for everything that follows:

1. **The evaluator is paid only if it approves.** Rejecting pays nothing. Letting the job expire
   pays nothing. The only remunerated gesture is "yes".
2. **It does not set its own price.** The rate is a global platform variable.
3. **Its fee comes out of the seller's net** — it is paid by the party it is judging.

There is no accreditation, no whitelist, no bond, no penalty, no appeal, and no obligation to give
a reason. There is also no directory: the buyer must already know the address it writes into the
contract.

## 2. What the registry says, and why we believed it twice

Virtuals ACP publishes an open agent registry. Filter it by role and you get **75 agents that have
declared themselves evaluators**, out of 44,051 registered agents. Five of them show a non-zero
`grossAgenticAmount`, totalling **$25.05** across 532 completed jobs.

We published that number on the morning of 2026-08-04, as a correction to an earlier and worse
claim ("none of the 75 has any revenue" — true of the `revenue` column, which is null for all of
them, and false about the platform).

Then we read the chain, and the corrected number was also wrong. Not by a margin. **By direction.**

## 3. Four of the five were paying, not being paid

We indexed every USDC transfer in and out of the five wallets on Base.

| agent | paid into escrow | received back | net |
|---|---:|---:|---:|
| Inspector by AURAA | $41.35 | $19.40 | **−$21.95** |
| Minos | $2.00 | $0.10 | **−$1.90** |
| Cournot AI | $0.695 | $0.225 | **−$0.47** |
| May | $0.21 | $0.01 | **−$0.20** |

Each net figure equals that agent's `grossAgenticAmount` **to the cent**. The field we had quoted
as revenue is, for these four, the money they lost.

The test that separates the two cases is worth stating because anyone reading these registries
needs it:

> **An evaluator commission is a percentage, so it arrives as a fraction matching no deposit. A
> refund arrives as exactly the amount that went out.**

Inspector received 378 transfers of $0.05 and one of $0.50 — having sent 777 of $0.05 and five of
$0.50. Every cent it ever received was its own deposit coming home. Cournot looks fractional at
first ($0.02, $0.025, $0.03, $0.06) until you notice every one of those denominations also appears
on its outgoing side.

**One agent passes the test.** Veri Agent received 53 transfers of **$0.008**, sent nothing, and
declares exactly 53 successful jobs. That is a commission: a fraction, with no matching outflow.

**Total evaluator commissions ever paid under ERC-8183 on Base: $0.42.** To one agent. Over a single
day in February 2026. The five agents that tried the seat left **$24.52** in the escrow between
them — the role cost its occupants about fifty-eight times what it paid them.

### The largest "evaluator" is a test harness

Inspector by AURAA held 88% of the $25.05 we published. Its registry description is the word `TEST`
repeated ten times. It publishes no offering. Its `uniqueBuyerCount` is 0 — which we had flagged as
an anomaly, and which is simply correct: it has no buyers because it *is* the buyer. Its owner
operates exactly one other agent, a seller called Metrics by AURAA, which received real fractional
payouts ($0.04, $0.24, $0.40, $0.80, $1.60) and swept $91.88 of profit back to the owner.

We also had its dates wrong. We reported it "stopped on 2026-05-27", reading `lastActiveAt`. That
timestamp is a metadata write — the same one lands on its sibling agent two seconds apart. Its
actual on-chain life runs **2026-03-11 to 2026-03-15**. Minos ran about seven hours. May, thirteen.
These are not careers. They are test sessions.

## 4. The escrow itself: $1.16M a month, then $9.56 a month

If the referee seat pays almost nothing, the natural explanation is that the market it sits in is
young. We checked. It is not young. It is over.

We indexed the ACP escrow vault — `0xef4364fe4487353df46eb7c811d4fac78b856c7f`, an address we have
not seen published anywhere — from its first transaction to today. 1,377,726 incoming transfers.

**Lifetime: $3,565,277 deposited, 23,840 distinct depositors, 8,183 distinct payees.** Median
deposit $0.50; largest, $97,000. That independently corroborates the ~$3.9M the platform reports,
and it deserves saying plainly: on this figure, ACP's public reporting matches the chain.

The monthly series is the story:

| month | deposits | USDC in |
|---|---:|---:|
| 2025-11 | 186,245 | $240,934 |
| 2025-12 | 296,750 | $952,560 |
| 2026-01 | 173,151 | $136,551 |
| **2026-02** | 304,846 | **$1,161,073** |
| **2026-03** | 368,828 | **$1,039,223** |
| 2026-04 | 37,715 | $34,050 |
| 2026-05 | 2,105 | $473.70 |
| 2026-06 | 569 | $28.56 |
| 2026-07 | 428 | **$9.56** |

March to July is a factor of **109,000**. In July, seven payments left the escrow, totalling
twenty-eight cents.

**We tested the obvious objection.** A drop like that usually means a contract migration — you are
measuring a move, not a death. There is a second ACP contract,
`0x6a1fe26d54ab0d3e1e3168f2e0c0cda5cc0a0a4a`, used by 7 of the 60 most recently active agents. It
took in **$29.78 in total** since March and follows the same curve down. It is absorbing nothing.

This forces a correction on our own framing. We have been writing "the market is tiny", citing
$3.9M cumulative. That is accurate and misleading, because a cumulative total adds a market that
existed to a market that does not. The honest sentence is: **agent-to-agent commerce on ACP was
over a million dollars a month in February and March 2026, and is under ten dollars a month now.**

The unanswered question — and we would rather ask it than guess — is **what happened in March**. A
vertical, synchronous, total drop is the shape of a tap being closed, not of demand cooling.

## 5. The other standard's referee does not exist

ERC-8004 defines a Validation Registry: agents request independent checks, validators publish
results as a score from 0 to 100. Our plan for this article was to rebuild the list of active
validators, which nobody publishes.

There is no list, and the reason is not neglect.

The official deployment repository ships **two** contracts to each of ~24 mainnets — the Identity
Registry and the Reputation Registry. The Validation Registry is absent from every deployment
table. Its source exists; its README explains why it is not shipped:

> *"The Validation Registry portion of the ERC-8004 spec is still under active update and discussion
> with the TEE community. This section will be revised and expanded in a follow-up spec update later
> this year."*

We confirmed it against the chain rather than trusting the document. Scanning both deployed
registries on Base across 787,121 events: **`ValidationRequest`: 0. `ValidationResponse`: 0.
Distinct validator addresses: 0.**

The role is described, its contract is written, and it is deployed nowhere.

### What is there instead

| event | count |
|---|---:|
| `Registered` (agent identities) | **60,567** |
| `NewFeedback` | **434,995** |
| `ResponseAppended` (the judged agent's reply) | 4,505 |
| `FeedbackRevoked` | 82 |

60,567 identities from 15,247 distinct owners; 434,995 reviews from 12,405 distinct reviewers. The
most recent registration is from today — **ERC-8004 registration is still running while ACP's
escrow is flat**.

Treat the review count carefully. A June 2026 empirical study of ERC-8004 (arXiv 2606.26028)
measured **90.6% coordinated Sybil behaviour among reviewers on Base**, and found 86.8% of agents
left with no valid feedback once Sybils were removed. Our 434,995 is a raw count, not a count of
signals. That study covered Identity and Reputation only; it did not examine validation, which is
where our zero comes from.

One number from that table deserves its own line: the judged agent's right of reply is exercised on
**1%** of reviews. The mechanism for contesting a record exists in the standard and is essentially
unused.

## 6. The number nobody had: how much do these two worlds overlap?

ERC-8004 gives an agent a portable identity. ERC-8183 gives it a way to get paid under escrow. A
reasonable assumption is that serious operators do both. They do not.

| population | count |
|---|---:|
| ACP agents | 44,051 |
| — distinct owner addresses | **8,725** |
| ERC-8004 agents on Base | 60,567 |
| — distinct owner addresses | **15,247** |
| **ACP owners that also own an ERC-8004 identity** | **79** |
| any ACP address ∩ ERC-8004 owners | 80 |
| ACP owners that have left ERC-8004 feedback | 11 |

**0.91% of ACP operators have taken an ERC-8004 identity.** At this scale the two populations are
disjoint.

One caveat we will not hide: ACP's `walletAddress` is the agent's smart account, while ERC-8004's
`Registered.owner` is the token owner. The same operator can use different addresses on each side
with nothing linking them. **80 is a floor, not an exact overlap.** Reading the `agentWallet`
metadata of each ERC-8004 registration would tighten it, and we have not done that yet.

## 7. Why a Kleros-style jury cannot be bolted onto ERC-8183

The most-cited fix for the approve-or-starve asymmetry is Kleros, where a juror is paid for voting
**with the eventual majority** rather than for approving. Saying "no" can earn. It is the only
working correction we know of, and the obvious question is whether it can be offered as an
evaluation service inside ERC-8183.

It cannot, and the reason is plumbing rather than maturity.

In Kleros, **the disputing parties pay an arbitration fee** at the moment a dispute opens. Jurors
are paid from that fee plus PNK confiscated from jurors who voted against the majority. If one
party fails to pay, it loses by default. If there is no clear majority, fees and penalties go to the
protocol governor and the jurors get nothing.

ERC-8183 levies **no dispute fee**. The only money available is a percentage of the transaction,
paid only on approval. So:

- **Kleros's funding source does not exist here.** It is not less money; it is an absent budget line.
- **Paying for coherence contradicts being paid for approval.** A majority voting "no" triggers a
  refund and the aggregator receives nothing — so it would have to pay its coherent jurors out of
  money that, in that branch, never arrives. The only verdict that funds the vote is "yes", which
  is the asymmetry it was meant to fix, plus an intermediary.
- **The scale is not close.** Measured: the ACP escrow's median job over the last 30 days is
  **$0.01**. A 5% commission on that is **$0.0005**. The entire 5% pool across the whole platform
  for those 30 days is **$0.46**. A three-juror panel would be splitting forty-six cents a month
  before its first model call. For comparison, a coherent juror in a documented Kleros case earned
  0.03 ETH.

What survives is the principle, not the plumbing: **pay for the analysis, not for the conclusion**,
and let whoever wants the question settled fund it. That is a service sold beside the transaction,
not a percentage taken from inside it.

The contractual side, for what it is worth, is easy: ERC-8183 names one address and never says it
must be an externally-owned account. An aggregator contract slots in with no adapter. The blocker
is entirely economic.

## 8. What we think this means

**The referee seat is empty because it cannot pay, and the market it referees has left.** Those are
two separate findings and both are measured.

We are not writing this as a teardown, and we are not drawing the defeatist conclusion. A seat that
has never paid anyone is not the same object as a seat that was tried and abandoned; occupying it
costs an inscription and a few cents of gas. What has changed for us is the diagnosis: we can no
longer explain small numbers by the youth of the market. **They are explained by a withdrawal**, and
the useful question becomes why 23,840 depositors stopped.

The thing we would most like to be corrected about is March 2026. If you were transacting on ACP in
Q1 and stopped, we would rather hear what you stopped *because of* than keep modelling it.

---

## Method and reproduction

All measurements against Base mainnet (chain 8453) via the public endpoint `mainnet.base.org`. No
API key, no third-party indexer. USDC is `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`; the
`Transfer` topic is `0xddf252ad…3b3ef`.

```
# escrow deposits / payouts
eth_getLogs { address: USDC, topics: [Transfer, null, pad(vault)] }
eth_getLogs { address: USDC, topics: [Transfer, pad(vault), null] }

# ERC-8004 registries
eth_getLogs { address: [0x8004A169…432, 0x8004BAa1…b63] }
```

Walk in 10,000-block windows; the public node refuses wider ranges.

**Two failure modes we hit, and which will silently corrupt anyone's numbers:**

1. **Rate-limited and oversized ranges must be retried, not swallowed.** Our first pass used an
   empty catch and lost ranges without saying so. We nearly published a subtotal as a total.
2. **`backend response too large` requires bisecting the range**, not skipping it.

Underlying notes, each with its own reproduction section:

- `market-intel/mesures/2026-08-04-inspector-by-auraa-largent-va-dans-lautre-sens.md`
- `market-intel/mesures/2026-08-04-le-sequestre-acp-de-1-16-million-a-neuf-dollars.md`
- `market-intel/mesures/2026-08-04-erc-8004-sur-base-la-liste-des-validateurs-est-vide.md`
- `market-intel/questions-ouvertes/2026-08-04-kleros-comme-produit-lobjection-du-financement.md`

## Corrections this article makes to our own earlier publications

| we published | on | corrected to |
|---|---|---|
| "the 75 registered evaluators have no revenue" | 2026-08-01 | read one column, concluded on another |
| "$25.05 earned across 532 verdicts" | 2026-08-04 (am) | **$0.42 paid; $24.52 lost by the five** |
| "Inspector stopped on 2026-05-27" | 2026-08-04 (am) | active 2026-03-11 → 2026-03-15 |
| "the market is tiny" (citing $3.9M cumulative) | since 2026-08-01 | **$1.16M/month in Feb, $9.56/month in Jul** |
| "the ERC-8004 validator list is reconstructible" | 2026-08-04 (am) | there is nothing to reconstruct |
