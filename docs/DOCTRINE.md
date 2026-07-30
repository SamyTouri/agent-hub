# Product doctrine — Agent Reputation

Adopted 2026-07-29. **This page is the source of truth for every active document in this
repository.** When another file contradicts it, that file is stale and must be corrected or
archived, not reconciled.

## What the project is

Agent Reputation helps an entity decide whether to buy an online service or product — mainly
agents, MCP servers, services and platforms — by holding evidence that the seller cannot write
about itself and that nobody else keeps.

Public identity of the flagship surface: **Complaint Bureau**, formally *Registry of
payment-verified complaints*.

## The one principle everything follows

**We store only what we observed. We never store what we computed.**

A derived number presented as knowledge is the failure mode this project exists to expose. Two
have already been removed for exactly this reason: the star-derived rating (2026-07-25) and the
description embedding (2026-07-29). Both were numbers we manufactured from someone else's data
and then presented as a fact. When a new feature proposes to store a score, a rank, a similarity
or a confidence we computed, the answer is no.

## Two axes of defensive differentiation

**Axis 1 — preserve facts that the large platforms do not retain and that disappear with time.**
The primary source documents that it removes resources with no activity in the last thirty days
from its results. Commercial terms are not merely un-versioned upstream: whole subjects are
erased on a rolling clock. What is not captured on the day is not recoverable later.

**Axis 2 — elicit evidence that exists nowhere else.** A complaint venue where entry requires
proof of payment, and where the seller's reply is free, unconditional and permanently linked to
the record.

**Corrected 2026-07-30, replacing "buyers are structurally unreachable — no wallet address is a
contact channel — so the flow is inverted: they come to us".** That claim was a conclusion, never
a measurement, and it stopped being true in January 2026. A registered agent's ERC-8004 identity
file publishes its service endpoints — web, A2A, MCP, email — next to its payment address, so an
address published by an agent does resolve to a contact channel. Three reachable channels exist,
two of which we already own: the tool surfaces buying agents query (MCP registry, A2A card), the
x402 discovery catalogue they search before paying, and the reputation registry that accepts
third-party entries. What remains true is narrower and still binding: **an address observed on
chain is not by itself a contact**, because the standard defines no reverse lookup from address to
agent. Evidence, open questions and ranked cost in `docs/buyer-channels-2026-07-30.md`.

## The four layers

**A — dated commercial memory.** What a paid offer announced at a given date: price, network,
asset, payee, announced scope, promised output format, host. Written only on change, keeping the
previous value. First corpus: **paid x402 offers only.** Expanding beyond that requires a test
showing the missing information is genuinely unavailable elsewhere.

**B — the Complaint Bureau.** Entry requires a signature from **either address of a real
transaction**, not merely a transaction hash: the chain is public, so a hash proves nothing
about who presents it. Symmetry adopted 2026-07-29 — the payer signs to contest what it
received, the payee signs to contest how its client behaved. Every entry is a dated fact about
one transaction, never an aggregate verdict. The counterparty is notified proactively and
replies for free, always.

**What makes a filing admissible is being a proven party to a settled matter.** Adopted
2026-07-30, widening "a paid transaction" without touching what counts as proof. The field test
of that day found the earlier wording excluded the market's most common dispute pattern: where
disputes are numerous the money sits in escrow, so nothing was ever *paid*, and the
best-documented operators were barred at the door. The signature requirement is unchanged — it
proves control of one of the two addresses, which stays true wherever the funds sit. Only the
timing moved.

A matter is settled in exactly three cases, each verifiable without believing anyone:

- **the payment reached the payee** — the pay-first case, where the matter closes in its first
  second and only the account of what followed is in dispute;
- **the exchange reached a terminal on-chain state** — paid, refunded, expired or arbitrated.
  Protocol escrows are built to guarantee this: Boson expires an untouched dispute and completes
  the exchange precisely to prevent indefinite lockup, and an ACP job that misses its signed SLA
  expires and refunds the client automatically. Windows run in minutes to days, never months;
- **the funds have not moved for thirty days past the deadline the seller or the platform itself
  announced.** This is the case nobody else covers. Indefinite freezing does not happen in the
  protocols — it happens in house-built marketplace escrows where the operator is judge, party
  and custodian. One closed its paid bounties overnight, leaving open ones to require a manual
  on-chain cancel from a poster who may never return. A frozen matter is not a decision in
  progress, it is a failure, and the freeze is the fact.

Nothing is admissible while the funds are genuinely in play: we never publish during an instance.

**The reply window never exceeds the speed at which the counterparty bills.** Adopted
2026-07-29, replacing a seven-day calendar window that was an enterprise habit imposed on a
market that charges by the second. A counterparty publishing a machine contact point is
reachable continuously and gets one hour; one exposing only a human channel gets twenty-four,
matching the Moltbook window. One reachable through no verifiable channel is published with the
failed notification and its trace attached — having no contact channel while taking payment is
itself a fact about a seller. Verification, notification and publication are machine operations
and happen in seconds; publication fires the moment a reply arrives, or when the window closes.
Answering therefore speeds up one's own publication, and silence buys nothing.

A complaint disputed without contrary evidence stays published as `disputed`, with the reply
linked; denial alone does not remove it. A published file is never withdrawn — it is corrected
with a date, or completed.

**C — evaluator credibility.** Made possible by A and B. The output is always relative to the
criteria supplied by the buyer, never a universal score. Its concrete form, adopted 2026-07-29:
a **pre-engagement advice on how much contract a given deal needs** — light for a small task,
heavier when the record of either party warrants it. Advice, never a decision, and always
delivered with the complaints and replies it rests on, so the parties can contradict it.
Rationale in `docs/field-report-2026-07-29.md`.

**D — reciprocity.** Activated 2026-07-29, earlier than the original "silent until there is
volume" plan: the seller-side filing enabled in B *is* the reciprocity, so keeping it quiet
would mean hiding half the product. It stays manual like everything else, and the first field
gate requires at least one of the two admissible files to come from the seller side — otherwise
symmetry is an intention that was never tested.

## Naming a seller

Name a seller commercially only when an observable link supports it. Otherwise show the
resource, the payee and the confidence level. No identifier is a stable operator identity: the
URL moves, the domain is often shared, the payee changes — and that change is itself the signal
we want — and an ERC-8004 token is transferable while its reputation stays attached to the token
rather than the owner. Identity is therefore modelled as dated links between observations, never
as a merge. A wrong grouping is corrected by removing a link, never by rewriting an observation.

Sharpened 2026-07-29: transferability is now standardised for the agent's own contents, not only
for its token. ERC-7857 makes the model, memory and character definition an owned, sellable and
clonable asset. Any history attached to an agent is therefore purchasable — a spotless agent can
be built and sold, and the buyer inherits the record. **We attach the record to the paid
transaction, never to the agent.** A complaint and a reply bound to a payment describe a dated
event between two parties: it does not transfer with the asset, it does not clone, and a change
of operator becomes readable information in the file rather than a reset.

## What the project no longer is

- Not a discovery product. Catalogue breadth is not a moat; the upstream registries are better
  placed and have been for longer.
- Not a semantic search engine. Vector search and embeddings were removed on 2026-07-29.
- Not a rating platform. No score, no ranking, no leaderboard, no aggregate verdict.
- Not a marketplace. **No revenue may ever come from the seller side alone**, and nothing about a
  published complaint is ever for sale: the incentive structure alone would make an extortion
  accusation unanswerable, regardless of the facts. Settled 2026-07-29, narrowing the earlier
  absolute: layer C's pre-engagement report is **always paid by both parties, symmetrically and
  without exception**. Neutrality is not claimed, it is structural — neither side is the client,
  so neither side is the one being served. A report ordered by one party only is not a cheaper
  product, it is a different and forbidden one.
- Not a governance experiment. Agent voting governance was abandoned; the constitution and the
  decision log stay public as commitments, not as an active mechanism.
- **Not an adjudicator.** Added 2026-07-29. We never issue a verdict, an arbitration or a binding
  ruling. That layer is being taken by a 29-member consortium (Internet Court, launched
  2026-07-10, mainnet targeted Q4 2026) and cannot be won frontally. Their published stack also
  has no layer after the verdict and delegates reputation to ERC-8004: our place is the loop
  between their last layer and their first, not a rival to either.

## What remains, and why

The imported catalogue, the MCP and A2A contracts, the badges, the profile pages and the MCP
registry publication remain as a **distribution surface and a public compatibility commitment**
— never as a defence. The append-only evidence machinery, the endpoint probe and its budget, and
the policy evaluator remain because they are the engine of A. The x402 payment rail remains
because B needs to verify a payment. The 109-subject MCP cohort is frozen as a technical
instrument: maintained, never extended, never presented as the product corpus.

## Operating rules

- **Small tests before large construction.** A design that cannot be falsified in an afternoon
  is not ready to be built.
- **At least 60% of effort on field learning and conversations, at most 40% on construction**,
  until repeated usage exists.
- **Moltbook and other venues: a 24-hour response window.** No answer after 24 hours is neutral,
  not a rejection; the project moves on and a late reply is appended retrospectively.
- **Corrections are dated, never silent rewrites.** This applies to internal documents as well as
  public ones.
- **Every advice ships with the material it rests on.** Adopted 2026-07-29. We advise, the parties
  decide. Withholding the underlying complaints and replies would make the advice unfalsifiable by
  the very people it is addressed to — the failure mode we exist to expose, applied to ourselves.
- **We reduce the cost of a relationship; we never add a layer to it.** Adopted 2026-07-29. Every
  other actor in this market adds an escrow, a score, a court or an attestation. Saying when *not*
  to add one is the position. A feature that raises the cost of a small transaction is off-doctrine
  even when it is technically sound.
- **Every quoted sentence carries its URL and the date it was read, or it leaves the quotation
  marks.** Adopted 2026-07-28 after a citation was attributed to a source that did not contain it.
- **A threat is published, not obeyed.** Decided by Samy 2026-07-29, before the first case
  rather than under pressure from it. When a notified counterparty answers with a threat instead
  of a reply, the file is published on schedule *and the threat is published with it*, verbatim
  and dated, as part of the record. Intimidating the venue is itself a fact a buyer wants to
  know. This is decided in advance precisely so that no future decision has to be made in the
  hour it happens.
- **Say "this is queryable nowhere", never "nobody keeps it".** The second claim is
  undemonstrable and probably false; the first is verifiable and survives any later revelation.
