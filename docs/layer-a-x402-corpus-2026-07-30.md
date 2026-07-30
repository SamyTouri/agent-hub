# Couche A — premier corpus d'offres x402 payantes

*Capture manuelle du 30 juillet 2026, bornée à une session comme le prévoit le plan terrain.
Chaque ligne rapporte ce que le vendeur a **annoncé** à une date donnée, avec la publication
d'origine, et ce que sa surface répondait **le 30 juillet 2026** à une requête en lecture
seule, sans paiement ni authentification. Les termes annoncés ne sont ni corrigés ni
interprétés : ils sont recopiés tels que publiés, y compris quand ils sont incomplets.*

Les publications sont citées par leur identifiant Moltbook,
`https://www.moltbook.com/api/v1/posts/<id>`. Toutes lues le 30/07/2026.

## Offres relevées

| Seller | Announced | Announced terms | Asset / network | Surface | Probe 2026-07-30 | Source post |
|---|---|---|---|---|---|---|
| satoshi_ln | 2026-04-21 | $0.001/call (x402); 10 sats/call (L402) | USDC on Base; Lightning | dispatches.mystere.me | 200 | `3eca5128-089d-491a-8073-6c13147464bf` |
| tiamat-entity | 2026-04-10 | $0.005–0.01/call, 5 endpoints | USDC, Base mainnet | the-service.live | no answer (15s) | `29e59764-71aa-44ed-bc6a-498a3df98ee6` |
| merc-registry | 2026-03-18 | $0.02 / $0.08 / $0.15 / $0.35 by tier | USDC on Base | march-madness-sim.vercel.app | 404 | `eeb5b962-d236-4981-bcd3-c5914d6c47cd` |
| WesleyCashBot | 2026-02-24 | $0.03/request, Dutch auction, then at floor = free | x402 | synthai.online/intel/ai-pulse | 402 challenge | `17c38c0b-c323-4181-bded-4ca200bc9366` |
| TheTarotOracle | 2026-02-24 | $0.05 / $0.005 / $0.03 / $0.002 by route | USDC on Base | api-proxy-x402.guillermo-857.workers.dev | 404 | `82ddbaea-1d65-4187-99a3-5c2968d70600` |
| integrity_molt | 2026-03-17 | 0.01 USDC/call; 0.50 USDC/call deep audit | USDC on Solana | 185-227-111-100.nip.io | no answer (15s) | `6d2aea37-7df6-4a6e-b634-a14dc010350b` |
| x402markdownscraperagent | 2026-07-25 | 0.005 USDC/call, recipient address published | USDC, Base 8453 | x402-markdown-agent…workers.dev | 200 | `cce62cda-e595-4574-92b4-cb9ded7862c6` |
| globalchat | 2026-04-16 | 0.10 USDC/call on /api/feeds/directory | USDC, Base L2 | global-chat.io | 200 | `97237484-80cf-4be2-97a2-f0d41233ea9f` |
| quillagent | 2026-03-14 | $0.01/call, signed receipt valid 24h | — | wasiai.io | host 200, service route not probed | `d7b9522a-3b45-485e-bdc5-0f8c50e956e1` |
| hypergrowth | 2026-06-18 | live buyer test, buy route published | x402 | hyper-growth.xyz | 200 | `f26ea71b-668d-444b-a6ee-e7794d0affb5` |
| ClawGig (via AutoPilotAI) | 2026-03-23 | 10% platform commission, 5% client fee; catalogue described as browsable without auth | USDC | clawgig.ai/api/v1/gigs | **402 challenge** | `126804c2-fc51-4fb1-bf99-1935f79f92e4` |
| AutoPilotAI | 2026-04-13 | per-call price illegible in the source text | USDC on Avalanche | app.wasiai.io | not probed | `3051c216-83bf-4ae6-9832-6e3bd4834ac8` |
| markus_dropspace | 2026-05-01 | $0.55/launch after 5 free launches per month | USDC on Base | dropspace.dev | not probed | `9e29f873-8f00-4b5e-b921-b7f58408381b` |
| openclaw-frankops | 2026-05-07 | $0.01/call, 23k events captured | USDC on Base | — | not probed | `499ee8a9-3320-4425-842b-bfb92bea6ac4` |
| gatefare-official | 2026-05-02 | paid x402 APIs exposed as an MCP tool | — | — | not probed | `38a8d543-3646-4858-a33e-d0d8e405c1ab` |
| obolos_agent (buyer account) | 2026-03-04 | $0.10/call image API, settled instantly | USDC on Base | — | not probed | `23a84cff-ade3-4c2e-b03a-548835852e5c` |
| Maya | 2026-01-29 | recipient address published, dual-rail | USDC on Base and Solana | proxies.sx | not probed | `82295637-79fc-4764-af16-7816b028693c` |
| Claw Earn (via AutoPilotAI) | 2026-04-06 | tasks up to 20 USDC, 48h auto-approve, stake 30% then 10% after 3 ratings | USDC on Base | — | not probed | `cc4f7db8-2c59-4b6c-9f2f-df7f3f209169` |

## Ce que ce tableau établit

**Quatre offres payantes sur les onze interrogées ne mènent plus à rien** — deux pages absentes,
deux silences — entre trois et cinq mois après leur annonce, alors que les annonces restent
lisibles, au présent, prix compris. Aucun avis, aucune rétractation, aucune date de retrait
nulle part.

**Un terme commercial a changé sans le dire.** Le catalogue de missions décrit en mars comme
librement consultable répond aujourd'hui par une exigence de paiement sur la même route. Le
changement est réel, il est daté ici, et il ne l'est nulle part ailleurs.

**Une seule offre publie son adresse bénéficiaire dans son annonce.** C'est la donnée qui
permettrait à un acheteur de savoir qui il paie, et elle est presque toujours absente.

## Ce que ce tableau ne dit pas

Une surface qui ne répond pas aujourd'hui n'est pas nécessairement morte : un hébergeur peut
filtrer, un domaine peut être en transit, une requête peut être bloquée en amont. Ce qui est
établi, c'est qu'un acheteur qui suivrait l'annonce aujourd'hui n'obtiendrait rien — ce qui est
exactement la question que la couche A doit trancher. Les lignes marquées « not probed » n'ont
pas été vérifiées, faute de point d'accès public cité dans l'annonce ou parce que la borne d'une
journée était atteinte.
