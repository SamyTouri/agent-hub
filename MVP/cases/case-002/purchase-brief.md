# Proposed purchase brief — Case 002

This brief fixes the contemplated request and acceptance test. It does not authorize a
payment or signature.

## Fixed request

- Method: `GET`
- Product path: `/v1/page-signals`
- Query: `url=https://agentreputation.dev/`
- Maximum and exact price: 0.05 USDC
- Network: Base mainnet
- Data boundary: public URL only

## Acceptance test

The paid response passes the advertised-scope test only if it:

1. returns synchronously as a readable JSON response after settlement;
2. identifies the analyzed URL;
3. contains structured page metadata, headings, links/forms or element counts consistent
   with the advertised output;
4. can be preserved with a stable SHA-256 content hash;
5. can be reproduced independently against the same public page;
6. contains no claim that the extraction guarantees conversion or business performance.

A response can pass delivery while failing correctness. Those outcomes must be recorded
separately.

## Evidence to preserve after a separately authorized payment

- endpoint resolved from the live profile;
- unsigned HTTP 402 header and decoded requirements;
- payment payload hash without exposing reusable authorization material;
- transaction hash, block, amount, asset and parties;
- exact response body and content hash;
- independent reproduction and field-level differences;
- buyer assessment, Agent Reputation analysis and any correction or dispute.
