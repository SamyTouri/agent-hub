# Who actually earns in the agent economy — measured 2026-08-01

Commissioned by Samy on 2026-08-01: get a global view of the market before choosing a direction.
Every figure below was measured first-hand the same day against the public, unauthenticated agent
registry of the escrow standard's reference implementation, by paginating it in full. The method
is one endpoint and a group-by; anyone can reproduce it.

**No ecosystem headline counter is repeated here.** Published agent counts for this market
disagree with each other by an order of magnitude and none states its scope. That is the shape of
the "15 000+ agents" claim this project had to retract publicly on 2026-07-25, and the rule that
came out of it applies to other people's numbers too.

---

## The shape of the market

| Measure | Value |
|---|---|
| Agents registered | **44 051** |
| Agents with any revenue at all | **1 438** (3.3%) |
| Total service revenue recorded | **$3 923 557** |
| Top 1 agent | 17.9% of all revenue |
| Top 10 | 57.0% |
| Top 50 | 91.7% |
| Top 100 | 97.0% |
| Agents with ≥100 distinct buyers (117 of them) | **85.5% of all revenue** |
| Agents with ≤10 distinct buyers (940 of them) | 3.6% |
| Agents with **exactly one** distinct buyer | **408** |

Two readings, and both matter.

**There is a real economy, and it is about a hundred agents wide.** A hundred and seventeen agents
have a hundred or more distinct buyers and hold six sevenths of the money. That is a genuine
market with genuine repeat demand, not a mirage.

**Below that line it is mostly one party paying one agent.** Four hundred and eight agents have
exactly one buyer. Nearly two thirds of everyone earning anything has ten buyers or fewer, and
that whole population shares 3.6% of the revenue. Any strategy that assumes a long tail of small
paying customers is assuming something this registry does not show.

---

## The trust and verification segment is real, and larger than a sample suggested

Filtering the revenue-positive population on trust vocabulary in name, description and offering
titles — verification, audit, fact-check, fraud, risk, compliance, security, attestation,
validation, screening and neighbours:

**463 agents, $679 310, or 17.3% of all revenue in this market.**

This corrects an earlier impression, formed from three sampled names, that the segment was a
handful of fact-checkers. It is not: roughly one dollar in six recorded here is paid for some form
of checking, and the work spans security scanning, auditing, risk scoring and fact-checking rather
than one activity.

The caveat that keeps it honest: this is a keyword segmentation over self-written descriptions, so
it over-counts agents that merely mention trust and under-counts those that sell it without using
the vocabulary. It is a magnitude, not a census.

---

## The paid referee seat, and why it stays empty

The escrow standard defines an evaluator: the single address permitted to mark a job complete and
release the money.

- **75 agents registered for that role. None has any revenue.**
- **The control is what makes the zero worth stating**: the same `revenue > 0` filter without the
  role constraint returns 1 438. The filter discriminates, so the zero is a measurement and not a
  broken query — the failure mode that nearly produced a false negative on 2026-07-30.
- Of those 75, **45 publish no offering at all**; the other 30 do publish and still earn nothing.
- The reference SDK documents three evaluation modes and calls **self-evaluation "the default
  flow"**, telling developers to start there. A third mode omits the evaluator entirely and
  auto-completes on submit.
- In the reference implementation the evaluator is paid **only on approval**: `complete()` pays
  its fee, `reject()` refunds the client and pays it nothing, expiry pays it nothing.

Detail and line references in `docs/erc-8183-evaluator-role-2026-08-01.md` and
`docs/evaluator-discovery-2026-08-01.md`.

**So judgement sells and the referee seat does not.** The same work — checking whether something
is true, sound or safe — earns real money when sold as an ordinary service, and nothing at all
when performed from the seat that holds the escrow key. The seat is not empty for want of a
directory; it is a worse deal than the alternative, for everyone.

---

## One pattern that is not explained

Grouping the revenue-positive population by distinct-buyer count, one value stands out.

**Eleven agents have exactly 201 distinct buyers each.** Their names span unrelated domains: four
named after the escrow standard, one after escrow mediation, one after venture capital, one after
marriage guidance. They were created inside a thirteen-day window in March 2026. Their combined
revenue is **$224 857**. A single owner address holds five of them, including all four named after
the standard.

**This is recorded as an observation and not as a conclusion.** Ordinary explanations exist and
are more likely than the interesting one: a shared cohort in an incentive programme, a common
integration, a fleet exposed to the same buyer set. What makes it worth writing down is that an
identical buyer count across unrelated services is the sort of coincidence one would want
explained before pricing anything off those figures — and that it is queryable nowhere that could
be found. The question has been put publicly to the operators, with an undertaking to publish
their answer unedited.

The four agents named after the standard are also the reason a naive reading of this registry
would conclude that escrow evaluation pays: they show revenue in the $28k range each. They are
registered as ordinary providers, not as evaluators, they sit in this cluster, and one of their
neighbours describes the standard's name as a token-launch narrative rather than a service
category. They are not evidence of a paid evaluator market.

---

## What the venue thinks, sampled the same day

A search of the public forum where this market argues with itself shows the payment-versus-delivery
gap is a live and independently rediscovered topic, not a position this project holds alone.
Several operators raise dispute handling, partial completion and automatic refund on provider
disappearance without prompting. One states plainly that clearing payment should not automatically
clear delivery. At least one team is building deterministic work verification on another chain and
is drawing engagement.

One adjacent thesis is worth keeping in view because it goes a step further than ours: an operator
measuring their own output reports that a large majority of the information they sell is
delivered, acknowledged and then acted on by nobody, and argues the missing layer is not "was it
delivered" but "did delivery change anything". That is a harder claim to evidence than ours and it
is not our layer, but it is the direction the more thoughtful part of this venue is pointing.

**The implication for positioning**: the gap is recognised. Being early to name it is no longer
the advantage; being the one who measures it with reproducible method may be.

---

## Provenance

**First-hand, 2026-08-01**: every figure in the tables and the cluster observation, from full
pagination of the registry; the evaluator role counts and the filter control; the SDK's three
documented modes; the payout asymmetry, read in the standard's raw text.

**Not established**: what the 201 is. Whether the keyword segmentation matches how those agents
would describe themselves. Whether the `revenue` field, which is platform-declared, matches
settlement on chain — independent audits of this same registry report dashboards that do not
reconcile with wallets, so **treat every revenue figure here as a ceiling rather than a truth**.
