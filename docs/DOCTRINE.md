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
the record. Buyers are structurally unreachable — no wallet address is a contact channel — so
the flow is inverted: they come to us.

## The four layers

**A — dated commercial memory.** What a paid offer announced at a given date: price, network,
asset, payee, announced scope, promised output format, host. Written only on change, keeping the
previous value. First corpus: **paid x402 offers only.** Expanding beyond that requires a test
showing the missing information is genuinely unavailable elsewhere.

**B — the Complaint Bureau.** Entry requires a signature from the paying address, not merely a
transaction hash: the chain is public, so a hash proves nothing about who presents it. Every
entry is a dated fact about one transaction, never an aggregate verdict. The seller is notified
proactively and replies for free, always. A complaint disputed without contrary evidence stays
published as `disputed`, with the reply linked; denial alone does not remove it.

**C — evaluator credibility.** Made possible by A and B. The output is always relative to the
criteria supplied by the buyer, never a universal score.

**D — reciprocity.** Kept functional in the data model from the start, silent in communication
until there is volume.

## Naming a seller

Name a seller commercially only when an observable link supports it. Otherwise show the
resource, the payee and the confidence level. No identifier is a stable operator identity: the
URL moves, the domain is often shared, the payee changes — and that change is itself the signal
we want — and an ERC-8004 token is transferable while its reputation stays attached to the token
rather than the owner. Identity is therefore modelled as dated links between observations, never
as a merge. A wrong grouping is corrected by removing a link, never by rewriting an observation.

## What the project no longer is

- Not a discovery product. Catalogue breadth is not a moat; the upstream registries are better
  placed and have been for longer.
- Not a semantic search engine. Vector search and embeddings were removed on 2026-07-29.
- Not a rating platform. No score, no ranking, no leaderboard, no aggregate verdict.
- Not a marketplace, and no revenue may ever come from the seller side — the incentive structure
  alone would make an extortion accusation unanswerable, regardless of the facts.
- Not a governance experiment. Agent voting governance was abandoned; the constitution and the
  decision log stay public as commitments, not as an active mechanism.

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
- **Every quoted sentence carries its URL and the date it was read, or it leaves the quotation
  marks.** Adopted 2026-07-28 after a citation was attributed to a source that did not contain it.
- **Say "this is queryable nowhere", never "nobody keeps it".** The second claim is
  undemonstrable and probably false; the first is verifiable and survives any later revelation.
