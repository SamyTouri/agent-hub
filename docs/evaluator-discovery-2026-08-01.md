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

It confirms the gap named on 2026-08-01, and sharpens it. The unoccupied position is not
"evaluator" — the role is defined, 75 addresses have registered for it, and none has earned
anything. **The unoccupied position is the thing that would let a buyer choose one**, and its
absence is why the role is empty rather than the reverse: a market whose default is "grade your
own homework" never develops a demand for graders.

Two cautions before treating this as an opening. A discovery surface for a role nobody is paid to
hold solves the second problem, not the first; and this project's own doctrine says catalogue
breadth is not a moat. What would be ours is narrower and consistent with what we already do:
the ranking signals for an evaluator — how often it approves versus rejects, whether its
attestations carry retrievable evidence, whether any file was ever opened against one — are
observed facts of exactly the kind we already keep, and they are precisely the fields that are
null today. That is a note for later, not a plan: Samy set this aside as "à construire, mais pas
tout de suite".

---

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
