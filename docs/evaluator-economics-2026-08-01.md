# What the evaluator role actually pays — measured 2026-08-01

Second item of the 2026-08-01 decision (doctrine: *Holding the evaluator role*): measure what an
evaluator earns before believing in the revenue. The answer is unambiguous and it is not the one
the decision assumed.

**The role pays nothing. Not "little" — nothing, to anyone, so far.**

---

## The measurement, made first-hand

Virtuals ACP is the reference implementation of ERC-8183 and its agent registry answers on a
public, unauthenticated API. Queried directly on 2026-08-01:

| Query | Result |
|---|---|
| Agents registered with `role = EVALUATOR` | **75** |
| Of those, agents with `revenue > 0` | **0** |
| *Control:* all agents with `revenue > 0` | **1 438** |
| Total agents in the registry | **44 051** |

**The control is the point.** A filter returning zero is worthless until you prove the filter
works — the lesson of 2026-07-30, when a discovery catalogue silently ignored its own filters and
nearly produced a false negative. Running the same `revenue > 0` predicate without the role
constraint returns 1 438. The filter discriminates. **The zero is real.**

The first page of registered evaluators, read the same day: `evaluator_test`, `goku`,
`Research Reviewer`, `dfd`, `YTY`, `Fox`, `Queen fox`, `Queenfox`. Every field for revenue, jobs
and unique buyers is null. This is not an under-served market. It is an empty room with a sign on
the door.

---

## Why it pays nothing — the arithmetic, not the adoption curve

The rate is 5% of the job, in the only place a rate is published (Virtuals' own fee table: 90%
provider / 5% evaluator / 5% protocol, against 95/5 with no evaluator). The standard itself sets
no rate, and — verified in the reference implementation on 2026-08-01 — `evaluatorFeeBP` is an
admin variable that `initialize()` never sets, so its default value is **zero**. ERC-8183 builds
the pipe and puts nothing in it.

Applied to observed job sizes (second-hand, from the same registry: median revenue per job
≈ $0.034, weighted network mean ≈ $1.69), 5% of a median job is about **a sixth of a cent**,
against a settlement gas cost on Base reported in the $0.01–$0.03 range. **The evaluator loses
money on any job below roughly $0.20 gross, which is most of them.**

This is structural, not a phase. Any revenue defined as a percentage of the value transacted in
this market inherits the size of that value, and the value is micro by design.

---

## Where attestation does pay, and why — the transferable lesson

Second-hand, from research not verified line by line here, but consistent across sources:

- **UMA / Polymarket.** A proposer earns $2–5 per resolution; a winning disputer nets ~$375 from
  the loser's bond. That is 20–60× an ACP evaluator's take per act — not because the protocol is
  better, but because the object under judgement is worth thousands of dollars rather than three
  cents.
- **Kleros.** Roughly $375k in juror fees across eight years, of which about $17k in the last
  twelve months, against token emission on the order of $448k per year. The judgement layer is
  funded by inflation at something like 26× its fee income. Its own new escrow-court proposal
  prices a juror at ~$2.80 per case — ten times the average x402 payment of ~$0.26.
- **ERC-8004's validation registry** states that validator incentives are outside its scope, and
  the reported on-chain usage is a handful of requests against ~100k+ registered agents. Unpaid
  verification does not happen.

**The variable is never the rate. It is the size of what is being judged.** And every mature
attestation market prices itself out of micro-transactions on purpose: reality.eth's own
documentation says arbitration is only rational once the stake exceeds the arbitration fee.

---

## What this changes

**It removes the reason the role was wanted, and leaves the role.** The decision of 2026-08-01 was
motivated first by revenue — "une première application qui répond au marché actuel". That
motivation does not survive the measurement: there is no revenue in this role today, and the
percentage-of-escrow structure caps it structurally. Nothing here argues for reversing the
decision; it argues for **taking the role for what it actually gives us, which is evidence
access**, and for not writing revenue into any plan that depends on it.

The evidence rationale is untouched and is now the primary one. An evaluator stands at the exact
instant a matter becomes settled — our own admissibility threshold — with both parties reachable.
The field test of 2026-07-30 found the binding constraint was not a shortage of disputes but a
shortage of reachable parties. The role answers that, at a price of approximately zero in either
direction.

**Two consequences to carry forward.** Our pre-engagement advice is already priced per act rather
than as a share of the deal, which is the structure that survives here; keep it that way. And the
richest thing this measurement surfaced is not the evaluator role at all: it is the distance
between announced and collected figures across this market — headline aGDP in the hundreds of
millions against low single-digit millions actually received, with published dashboards that do
not reconcile with the chain. Measuring that gap is what this project already does.

---

## Provenance

**Verified first-hand on 2026-08-01**, by direct query: the 75/0/1438/44051 counts, the filter
control, and the names and null fields of the registered evaluators; and, in the raw ERC-8183
text, that `evaluatorFeeBP` exists and is admin-set.

**Second-hand, from assisted research and not re-verified here**: per-job revenue distribution and
cumulative network revenue, the Kleros and UMA figures, ERC-8004 validation-registry usage, gas
cost ranges, and the reported subsidy programme for ACP sellers. Directionally corroborated across
independent sources, but any of these should be re-measured before being quoted publicly.

**A caveat that strengthens rather than weakens the conclusion**: `revenue` is a
platform-declared field. Independent on-chain audits of this same registry report dashboard
figures that do not reconcile with settlement wallets. Treat every number here as a ceiling.
