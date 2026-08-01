# The ERC-8183 evaluator role — what the standard actually says

Read and verified 2026-08-01, the day Samy decided to take the role (doctrine: *Holding the
evaluator role*). This report answers the third item of that decision — check the standard before
claiming anything publicly — and it changes one thing about *how* the role can be taken.

**Method.** The normative text was downloaded raw from
`https://raw.githubusercontent.com/ethereum/ERCs/master/ERCS/erc-8183.md` (41 976 bytes, read
2026-08-01) and read locally, line by line. Line numbers below refer to that file. Every claim in
the section *The finding that matters* was verified first-hand against the source, not taken from
a summary. Deployment addresses and repository dates come from an assisted search and are marked
as such; they are second-hand and would need first-hand confirmation before being quoted publicly.

---

## Status: Draft, and frozen

Frontmatter, read 2026-08-01: `status: Draft`, `created: 2026-02-25`, `requires: 20`. Authors
include Davide Crapis (Ethereum Foundation) and three Virtuals contributors. Discussion at
`https://ethereum-magicians.org/t/erc-8183-agentic-commerce/27902`.

Second-hand, from repository history: two commits only — the initial merge 2026-03-05 and a
reference-implementation link update 2026-03-13. **No status change in four and a half months**,
while the implementation ships weekly. An open issue (#1616, filed 2026-03-22 by an external
reviewer, reported unanswered) lists seven HIGH-severity structural findings, one of which is
named below because we verified it independently.

**Our 2026-07-28 note — "ERC-8183 reste Draft et ne prévoit ni accréditation ni liste blanche" —
holds, and can now be dated.** Verified by exhaustive term search on the raw file: `accredit` 0
occurrences, `slash` 0, `bond` 0. `whitelist` appears 8 times, **all of them about hooks, none
about evaluators** — a distinction our public texts must not blur.

---

## The role, as specified

**The evaluator holds rights, never duties.** Every clause describing it uses `MAY`. It is the
only address that may call `complete(jobId, reason, optParams?)` once a job is Submitted, and it
may call `reject` from Funded onwards (L94-97).

**It is chosen by the client alone, at job creation, and cannot be changed.** `createJob` sets it
and "SHALL revert if `evaluator` is zero" (L85); the provider has no say and no veto beyond
refusing to deliver. There is no `setEvaluator` anywhere in the document.

**Its attestation may be empty.** `reason` is "an optional attestation commitment (e.g. `bytes32`
hash of off-chain evidence)" (L103, read 2026-08-01). An evaluator may complete or reject with no
on-chain trace of any reasoning whatsoever.

**Nobody can contest it.** Security Considerations, verbatim (read 2026-08-01):

> "Evaluator is trusted for completion and rejection once the job is Submitted; a malicious
> evaluator can complete or reject arbitrarily. Use reputation (e.g. ERC-8004) or staking for
> high-value jobs." (L717)

> "No dispute resolution or arbitration; reject/expire is final." (L719)

The staking suggestion is advice in Security Considerations. Nothing in the protocol implements
it. The one reputation hook the standard offers is a delegation to ERC-8004 — the registry whose
weakness is the reason this project exists.

---

## The finding that matters: the evaluator is paid if and only if it validates

The normative prose says nothing about paying an evaluator: the Fees section (L106-108) describes
only an optional platform fee. But the **reference implementation published inside the same
document** pays one, and its payout logic is asymmetric. Verified line by line, 2026-08-01:

- `complete()` — L640-651: `evalFee = (amount * evaluatorFeeBP) / 10000`, then
  `net = amount - platformFee - evalFee`, then `safeTransfer(job.evaluator, evalFee)` and
  `emit EvaluatorFeePaid`.
- `reject()` — L662-687: the full `job.budget` is refunded to the client. **There is no fee
  transfer of any kind in this path.** The evaluator receives nothing.
- `claimRefund()` (expiry) — L689 onwards: full budget to the client. The evaluator receives
  nothing.

**So the only act that pays the evaluator is approving the delivery.** Rejecting it pays zero.
This is a structural incentive to validate, written into the reference implementation of a
standard whose entire purpose is to make delivery trustworthy. The external audit issue #1616
flags a weaker version of this ("paid per-evaluation regardless of quality, incentivizing volume
over accuracy"); the asymmetry we verified is sharper than that — it is not volume over accuracy,
it is **approval over rejection**.

Two further consequences of the same code:

**The fee is not ours to set.** `evaluatorFeeBP` is a single global contract variable, settable
only by `ADMIN_ROLE` (L444, L501-508), capped so that platform + evaluator ≤ 10 000 bp. It is not
negotiated per job and not chosen by the parties. On any given deployment, an evaluator takes the
rate the platform operator decided, or does not participate.

**The fee is borne by the provider, not the client.** `net = amount - platformFee - evalFee`: the
client pays its budget either way; the seller receives less. An evaluator's income comes out of
the pocket of the party it is judging.

Virtuals' product documentation (second-hand, whitepaper read 2026-08-01) applies 5% to the
evaluator, against 90% provider and 5% protocol — versus 95/5 with no evaluator.

---

## Silence, and what actually happens

There is **no timeout specific to the evaluator**. The only clock is the job's `expiredAt`: once
past it, anyone may call `claimRefund`, the full escrow returns to the client, and the provider
who delivered is not paid (L99). An evaluator that simply stops answering therefore produces a
default outcome that is free for the client and total for the seller.

A constant named `EVALUATOR_GRACE_PERIOD` is reported to exist in the deployed contract's ABI
while the word "grace" has zero occurrences in the standard (verified for the standard;
**the deployed-contract claim is second-hand and its value and semantics are unverified**). If it
is what it sounds like, it is the production answer to evaluator silence, and it lives outside the
document. To confirm before any public use.

---

## The gap the standard leaves wide open

**There is no way for a client to find an evaluator.** No registry, no directory, no matching
mechanism, no discovery surface — not in the standard, and none found in the implementation
documentation. The client must already know the address it writes into `createJob`. Meanwhile the
Extensions section suggests hooks could perform "dynamically selecting evaluators based on
reputation", which is **not implementable in the model as defined**: with no `setEvaluator`, no
hook can change an evaluator after creation. That sentence is aspirational.

Reported divergences between specification and shipped code (all second-hand, worth
first-hand confirmation before use): the `fund()` signature in the ERC's own reference
implementation lost the front-running guard its prose specifies; and the production SDK defines a
zero-address "no evaluator" sentinel — **the default when the parameter is omitted** — where a
successful submit auto-completes and releases funds, directly contradicting "SHALL revert if
`evaluator` is zero" (L85) and "Evaluator: MUST be set at creation" (L723).

---

## What this changes for us

Nothing in the decision to take the role. Three things in how it is taken.

**One correction to our own record.** Our 2026-07-28 note is wrong by omission where it implies
the standard does not pay an evaluator: it does, through its reference implementation and through
the contract in production. Saying otherwise publicly would earn a correction.

**Being cheaper is not available as a lever here.** Samy's commercial intent — undercut the market
— cannot be executed inside this standard's fee mechanism, which is a platform-wide admin
parameter. Whatever differentiates us as an evaluator, it will not be price.

**The incentive we would be stepping into is the one this project exists to name.** Being paid
only when we approve is, structurally, the seller-side revenue we refused on 2026-07-29 for
exactly this reason: the incentive alone makes the accusation unanswerable regardless of the
facts. The doctrine's answer is already written and applies without amendment — publish observed
counts, never a verdict on our own work. Concretely, and to be decided before the first mission:
publish our completed-to-rejected ratio as an evaluator, always write a real `reason` commitment
where the standard makes it optional, and treat a complaint about one of our attestations exactly
like any other file. The first two are cheap; the third is already doctrine.

The unoccupied space is not the role. It is that **no one can find an evaluator at all** — no
registry exists, in a market where we already operate a registry and publish tool surfaces buying
agents query.
