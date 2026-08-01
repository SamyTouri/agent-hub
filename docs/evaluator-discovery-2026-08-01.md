# How a buyer finds an evaluator today

Asked on 2026-08-01: the methods must exist, find them. They do not. This records what was
verified first-hand rather than asserting an absence from a failed search.

**The short answer: buyers do not find evaluators. Of the three modes the reference SDK
documents, two remove the third party altogether, and the third requires already knowing the
address.**

---

## The three documented modes, verbatim from the SDK

Read 2026-08-01 from `src/examples/basic/buyer.ts` in `Virtual-Protocol/acp-node-v2`, the
reference implementation's own buyer example. The file names the modes in a header comment:

> "Evaluation modes (chosen via `opts.evaluatorAddress` on createJobFromOffering):
> • **Self-evaluation** — `evaluatorAddress: buyerAddress` (this example). The buyer also acts as
> evaluator […]
> • **Third-party eval** — `evaluatorAddress: <other wallet>`. The buyer only sees
> `job.completed`/`job.rejected`; an independent process on the evaluator wallet must handle
> `case "job.submitted"`.
> • **Skip evaluation** — omit `evaluatorAddress` (defaults to zero address). The contract
> auto-completes the job on submit […] Use only with trusted providers — there's no quality gate
> between submission and payout."

Self-evaluation is not merely available, it is the recommended entry point. The example's README
(read 2026-08-01) opens: "Basic example — manual control, self-evaluation. **The default flow.**
[…] Start here." The LLM example does the same thing — `{ evaluatorAddress: buyerAddress }`.

For the third-party mode, the documentation explains the technical obligation — a process must
run on the evaluator wallet and handle `job.submitted` — and says nothing whatsoever about where
the wallet comes from. `<other wallet>` is the entire guidance.

**There is no evaluator example in the SDK.** The examples directory covers basic,
fund-transfer, llm, subscription, subscription-fund-transfer and two Solana variants. Nothing
shows how to be an evaluator or how to hire one.

---

## The asymmetry, which is the real finding

Discovery exists in this SDK. It is just not offered for evaluators.

From the same buyer example (read 2026-08-01), resolving a **provider** has a documented discovery
path with reputation ranking:

> "(a) Discovery — browse the registry by keyword. Best when you don't know the seller in advance
> and want to pick by reputation/rating."

```
buyer.browseAgents("<search query>", {
  sortBy: [AgentSort.SUCCESSFUL_JOB_COUNT, AgentSort.SUCCESS_RATE],
  topK: 5,
})
```

There is no `browseEvaluators`, and the lifecycle header lists `browseAgents()` as step 1 for
finding *a provider*. The buyer is expected to shop for the party doing the work and to already
know the party checking it.

**And the generic path would not rescue it.** The registry does hold entries with `role =
EVALUATOR` — 75 of them, queried directly on 2026-08-01. But every ranking field the discovery
call sorts on is empty for them: revenue, job count and unique buyers are all null on every
evaluator sampled, and none has any revenue at all
(`docs/evaluator-economics-2026-08-01.md`). Even routed through the generic browse, there is
nothing to sort by. The sort keys that make seller discovery work do not exist on this side.

---

## So what is actually used

Three methods, in descending order of what the tooling steers you toward:

1. **The buyer evaluates itself.** Documented default, shipped in two of the examples. The escrow
   still functions; the third-party attestation simply is not there.
2. **No evaluator at all.** Omitting the parameter auto-completes on submit. The SDK warns to use
   it "only with trusted providers", which concedes that the mode removes the quality gate.
3. **Prior acquaintance.** If a third party is used, its address is known out of band — from an
   integration, a team, a counterparty already trusted. That is not a discovery method; it is the
   absence of one.

---

## What this changes for us

**Do not wait for the evaluator seat to become a business.** It is not empty for want of a
directory; it is empty because it is a worse deal than selling the same judgement directly, and
agents selling exactly that judgement are already earning real money on the same rail. If we want
revenue from verification in this market, the observed path is to sell it as a service, not to
hold an escrow key. That costs nothing to act on: layer C already prices per act rather than as a
share of a deal, which is the structure that works here.

**Keep the role anyway, for the reason established earlier**: it puts us at the instant a matter
becomes settled with both parties reachable, which is the constraint the 2026-07-30 field test
identified. The doctrine already forbids treating it as revenue. This sweep is the evidence for
that prohibition, not an argument against the role.

**And a directory is a later question, not a next one.** A discovery surface for a role nobody is
paid to hold solves the second problem while the first stands; our own doctrine says catalogue
breadth is not a moat. What would be ours is narrower: the signals that would rank an evaluator —
how often it approves versus rejects, whether its attestations carry retrievable evidence, whether
any file was ever opened against one — are observed facts of the kind we already keep, and they
are precisely the fields sitting null today. Samy set this aside as "à construire, mais pas tout
de suite", and nothing here argues for moving it forward.

**One clock worth watching.** The dispute-adjudication layer this project already decided not to
contest is targeting mainnet in Q4 2026. It rules after the fact and needs material to rule on;
choosing and sizing the commitment *before* the job is outside its announced scope. That remains
our position, and it does not depend on the evaluator seat ever filling.

---

## The inversion: verification sells, the escrow role does not

Added later the same day, after a further sweep answered the informal-channel question this report
had left open. It changes the conclusion more than it confirms it.

**Verified first-hand on 2026-08-01**, by direct query of the same registry:

| Agent | Role | Revenue | Jobs | Offerings |
|---|---|---|---|---|
| ArAIstotle (fact-checking) | HYBRID | **$22 344.59** | 87 938 | 5 |
| WachAI ("the security layer of ACP") | PROVIDER | **$5 548.76** | 6 137 | 5 |
| Cybercentry (verification offerings) | HYBRID | **$3 152.73** | 13 526 | 9 |
| **All 75 agents registered `role = EVALUATOR`** | EVALUATOR | **$0** | — | 30 of them publish offerings |

Scanned across all three pages of the evaluator role: 75 agents, **45 with no offering at all,
none with any revenue**. Thirty of them do publish offerings — they are trying to sell — and still
earn nothing.

So the market for judging work is **not** absent. It is worth tens of thousands of dollars and
hundreds of thousands of jobs, and it is transacting today. It simply does not flow through the
escrow evaluator role. The same work — checking whether something is true, sound, safe — sells
fine as an ordinary service bought like any other. What does not sell is holding the escrow key.

That reframes the gap found above. The evaluator seat is not empty because buyers cannot find a
candidate; it is empty because **the seat is worse than the alternative for everyone involved**.
Its occupant must be named at job creation and can never be changed, is paid only if it approves,
at a rate it does not set, out of the provider's net, with no recourse if it is wrong and no
obligation if it stays silent. A buyer who wants an opinion can simply buy one.

## What the community sweep found, and what it could not reach

Second-hand and **not re-verified line by line**; treat as leads, not facts.

**Supply exists and is being ignored.** At least six third parties have publicly pitched
themselves as evaluators — bonded verdicts with slashable deposits, reasoning-quality checks
before settlement, trust oracles priced at a few cents per call. Several posted directly on the
reference implementation's own repositories. The recurring detail is that **none received a
reply**: issues with zero comments, a pull request open for months without review.

**Demand is not weak, it is close to absent.** The sweep found essentially one public request
resembling "let me choose an evaluator", and it concerns selecting an internal evaluation module,
not a third-party address that releases an escrow. The standard's own discussion forum, where the
role was debated, contains no proposal for a registry or a discovery mechanism at all.

**A field measurement worth having, and worth doubting.** One third-party write-up reports that
across the escrow's jobs on Base, a sampled set showed the buyer named as its own evaluator in 29
cases, one left blank, and **zero using an independent third party**. The direction matches what
the SDK documents and what the revenue figures show. But the sweep itself flags that this
write-up was authored through Claude Code on an unrelated repository, so its provenance is
uncertain and its numbers are **not corroborated**. Do not cite the figures; the direction stands
on the first-hand evidence above without them.

**What could not be reached at all**: the project's Discord and Telegram, which need an account
and have no public mirror. Informal hiring may well happen there. This report does not know.

**One trap to name.** The published agent counters across this ecosystem disagree wildly with each
other — figures in the tens of thousands, hundreds of thousands and low millions all circulate,
with no published scope or method. That is the shape of the "15 000+ agents" claim we had to
retract publicly. **No number from this family may be repeated without its source and its scope**,
and a widely-quoted example of an "independent evaluator service" turns out to be a fictional
illustration from a vendor blog post rather than a real operator.

## The neighbours have the same hole

A bounded check of two adjacent protocols, done first-hand after two assisted searches stalled.
It is not a survey, but the pattern in both is the same one found above.

**Boson Protocol**, where a seller must designate a dispute resolver at offer creation. Its
dispute-resolver interface (`IBosonDisputeResolverHandler.sol`, read 2026-08-01) exposes exactly
three read functions: `getDisputeResolver(uint256 id)`, `getDisputeResolverByAddress(address)`,
and `areSellersAllowed(...)`. **There is no enumeration** — no list, no count, no way to walk the
set. A caller can only retrieve a dispute resolver it can already name.

**Kleros / ERC-792.** The arbitration standard makes the arbitrator a constructor parameter of the
arbitrable contract, and its stated virtue is that a dapp can switch arbitration services or let
users pick their own. That is interface flexibility, not discovery: the arbitrator interface
documentation (read 2026-08-01) describes only the functions an arbitrator must implement and
gives no mechanism, registry or guidance for obtaining an address in the first place.

So the shape repeats across three independent designs: **the role is specified, the interface is
specified, and where the address comes from is left to somebody else.** Kleros does solve the
selection problem one layer down — jurors are drawn at random from a staked pool, which removes
the choice rather than informing it — but the choice of *arbitrator* remains outside the protocol.

## Provenance

**Verified first-hand on 2026-08-01**: the three evaluation modes and their wording, the
"default flow / start here" framing, the absence of any evaluator example in the SDK tree, the
`browseAgents` discovery path with its reputation sort keys for providers, and the null ranking
fields on registered evaluators.

Also verified first-hand: the Boson dispute-resolver read interface and the Kleros arbitrator
interface documentation, both read 2026-08-01.

**Not established here**: whether informal channels — Discord, Telegram, direct solicitation —
carry evaluator hiring in practice. Three assisted searches were commissioned for this and all
three stalled before completing, so the question was not answered rather than answered in the
negative. **The absence of a documented method is not proof that no informal one exists**, and
this report does not claim a vacuum it did not measure. The neighbour comparison above is two
protocols checked by hand, not a survey.
