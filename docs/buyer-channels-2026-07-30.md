# How a buying agent is actually reachable — field note, 2026-07-30

*Written after Samy refused the doctrine's claim that buyers are structurally unreachable.
He was right to refuse it: that sentence was a conclusion, never a measurement. Every source
below carries the URL and the date it was read, per the operating rule adopted 2026-07-28.*

## What the doctrine said, and why it was wrong

The doctrine stated that no wallet address is a contact channel, and concluded that buyers
cannot be reached, so the flow must be inverted — they come to us. The second half does not
follow from the first, and the first stopped being true in January 2026.

## Channel 1 — the identity registry that publishes contact points next to payment addresses

ERC-8004 went live on Ethereum mainnet in January 2026. Its identity registry mints one
ERC-721 token per agent, whose URI points at a **publicly readable registration file**. That
file carries a `services` array of connection points — `web`, `A2A`, `MCP`, `OASF`, `ENS`,
`DID` and **email** — each with a `name` and an `endpoint`, alongside an `agentWallet`
metadata key holding the payment address, plus `x402Support` and an `active` flag.
Read 2026-07-30: <https://eips.ethereum.org/EIPS/eip-8004>.

So an agent that registers publishes, by its own hand, both an address and a way to reach it.
The claim that an address is never a contact channel is false for every registered agent.

**The gap that makes this worth work.** The standard provides no reverse lookup: you can go
from an agent id to its payment address, never from an address to the agent that owns it. That
index does not exist, and it is exactly the one needed to turn an observed payer address into a
reachable counterpart. Public explorers already index every registration and let you search by
address — 8004scan (AltLayer) showed **379 109 agents** on 2026-07-30, and QuickNode's explorer
covers 15 EVM networks including Base with an x402-priced REST API and no signup.
Read 2026-07-30: <https://8004scan.io/agents>,
<https://www.quicknode.com/blog/the-quicknode-erc-8004-stack-a-public-window-into-onchain-agents>.

**Unverified, and it decides how much this channel is worth.** Whether an agent pays *from* the
same address it publishes for *receiving* is unknown. A single-wallet agent will; a
properly-separated one will not. Until that ratio is measured on real payer addresses, the size
of this channel is a guess.

> **Measured 2026-07-31, and this paragraph is now out of date.** On 1 071 distinct payer
> addresses observed on Base against thirty-five announced receiving addresses, **92 resolve to
> a registered agent — 8.6 %, and that is a floor**, because the public index exposes the token
> owner address and not the `agentWallet` inside the registration file. So about one observed
> payer in twelve is already reachable with no index of ours, and eleven in twelve are not.
> A first pilot on twelve sellers returned 16.3 %; the wider sample halved it, which is itself
> worth knowing about the precision available here. Method, guards and limits:
> `docs/payer-identifiability-2026-07-31.md`. Left standing rather than rewritten, per the
> dated-corrections rule.

## Channel 2 — posting into the reputation registry the buyer already queries

The same standard's reputation registry accepts feedback from **any address that is not the
agent's owner or an approved operator**, through `giveFeedback()`. Entries take an `int128
value` with `uint8 valueDecimals`, plus optional `tag1`, `tag2`, `endpoint`, `feedbackURI` and
`feedbackHash`. More than 73 000 feedback events were logged in the standard's first 90 days.
Read 2026-07-30: <https://eips.ethereum.org/EIPS/eip-8004>.

This reaches a buyer at the exact moment it checks a seller before paying — the moment this
whole project exists to serve. `feedbackURI` can carry a pointer to a published complaint file.

**But it demands a number, and we refuse to publish numbers we computed.** The registry has no
shape for "a dated fact exists, read it here" without a numeric value attached. That is a
doctrinal decision for Samy, not an implementation detail, and it should be taken deliberately
rather than by writing whatever satisfies the type.

## Channel 3 — the catalogue buying agents actually query

The x402 Bazaar is the discovery layer of the payment rail: buyers, including agents, call
discovery endpoints to list or semantically search a catalogue, inspect pricing and schemas,
then pay and call. Read 2026-07-30: <https://docs.cdp.coinbase.com/x402/bazaar>.

Getting listed has **no registration step and one hard prerequisite**: a service is indexed the
first time a payment **settles** through the CDP facilitator with `paymentPayload.resource` set.
Verification alone is not enough — "ensure at least one successful settlement has completed
through the CDP Facilitator". Routes must declare Bazaar metadata: an input schema with
described properties, an output schema with realistic examples, and a natural-language
description capped at 500 characters. Ranking uses three signals over the last thirty days —
distinct buyers served, successful payment count, and recency — recomputed every six hours.
The catalogue exposes no buyer identity or contact: it is discovery, not correspondence.
Read 2026-07-30: same source.

**What that means for us, concretely.** Our paid endpoint runs on Base Sepolia, so we are absent
from the mainnet catalogue that buyers query. One real settled payment on mainnet puts us in it.
Binance runs an equivalent layer with the same opt-in-by-settlement design, indexing within
about thirty seconds of the first confirmed settle carrying the metadata blob.
Read 2026-07-30: <https://developers.binance.com/docs/onchainpay-x402/b402-bazaar>.

## The channel we already own and chose not to use

The stack buying agents run is layered: MCP for tool discovery, x402 for payment. We are
already published in the official MCP registry and serve an A2A card. The Complaint Bureau is
deliberately absent from both — decided on 2026-07-30 while the first files are handled by hand.
That decision was correct for verification load and is now the main thing standing between the
bureau and the buyers it was built for. It is a reversible choice, and reversing it costs a
tool definition, not a rebuild.

## What is not a channel

Broadcasting on the agent social network. The 2026-07-21 survey measured that terrain: karma is
anti-correlated with rigour, there is effectively no negative signal, five comment farms produce
around a third of the volume, and ten accounts carry 68% of the main space. An announcement does
not travel there; a first-hand fact does. That holds for sellers, and there is no reason it
holds better for buyers.

## Ranked, by cost against reach

1. **Expose the bureau to the agents already querying us** — reversing a decision we made ten
   hours ago, in the two places buyers already look.
2. **Settle one mainnet payment** so the paid endpoint enters the catalogue buyers query, with
   its 500-character description doing the work.
3. **Build the address-to-agent index nobody publishes**, then measure how often a payer address
   is a published one. Largest asset, largest effort, and the one that turns an on-chain trace
   into a reachable party.
4. **Decide the reputation-registry question** — whether a numeric field we do not believe in is
   an acceptable price for standing where buyers check sellers.
