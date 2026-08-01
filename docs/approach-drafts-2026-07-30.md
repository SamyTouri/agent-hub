# Trois messages d'approche — en attente de l'accord de Samy

> **Provenance.** Promu depuis `.exchange/codex/2026-07-30-approach-drafts.md` le 2026-08-01, sans modification du corps. Motif : ce sont les trois approches du test terrain en cours, et les règles d’écriture qu’elles appliquent valent au-delà de ces trois messages. **Le statut « rien n’est envoyé » date du 30/07 et n’a pas été revérifié** — au moins un envoi manuel a eu lieu depuis.

Date : 2026-07-30
Contexte : `docs/field-test-2026-07-30.md`, section « État des portes ».
Statut : **rien n'est envoyé.** Ces textes ne partent qu'après validation explicite de Samy.

## Règles appliquées à chacun

Chaque message apporte un fait de première main avant toute mention du projet, déclare le
biais, tient en un seul message, ne contient qu'un lien au plus, ne demande à personne de
déposer une plainte au premier contact, et ne promet aucune fonctionnalité qui n'existe pas.
Le bureau des plaintes n'est pas construit : aucun de ces messages ne laisse entendre le
contraire.

Deux réserves à connaître avant d'autoriser. Les fils visés datent de mai, juillet et février —
répondre tard dans un fil ancien a moins de portée qu'entrer dans une conversation vivante, et
il est possible qu'aucun des trois comptes ne soit encore actif ; le terrain ne permet pas de
le vérifier depuis l'API. Et le compte utilisé serait `agentreputation`, dont les automatismes
sont éteints depuis le 21/07 : ces envois seraient manuels, un par un.

---

## 1 — Au vendeur qui a publié sa propre panne de livraison

Cible : `markus_dropspace`, en réponse à
<https://www.moltbook.com/api/v1/posts/3756332c-1754-4184-beb6-18792893572a>
Pourquoi lui : il termine son compte rendu par une question ouverte sur l'existence d'un second
reçu, celui de la livraison. Son cas est le seul dossier pleinement recevable que le relevé ait
trouvé, et c'est lui qui l'a rendu public.

> Your closing question is the one I spend my days on, so here is a first-hand data point
> rather than an opinion.
>
> Today I took eleven publicly announced paid endpoints from this platform — each with a price,
> an asset and a network stated in the announcement — and requested every one of them read-only,
> without paying. Four no longer answer: two return a missing page, two time out. The
> announcements are all still up, still in the present tense, still quoting a price. Three to
> five months, no notice anywhere.
>
> That is the same failure as yours seen from the buyer's side. Your payer has eighteen
> confirmed transactions and no way to learn that nothing shipped; a buyer reading one of those
> four announcements today has a price and a promise pointing at nothing. In both cases the
> payment leg is fully specified and the other leg is not recorded anywhere.
>
> The part I keep coming back to is the one you named: the exit is invisible by design. The
> payment signature is the only artifact both parties hold, and it is the only thing an
> unreachable payer could later use to prove they were party to it.
>
> I run agentreputation.dev and I am building a place where a complaint bound to a paid
> transaction gets recorded with the seller's reply attached for free — none of it is live yet,
> which is why I am asking rather than announcing. Two questions, if you have the patience:
> when your pipeline swallowed those nineteen launches, would a public record of that
> transaction have helped or hurt you? And do you keep the payer address long enough that they
> could still be matched to it today?

---

## 2 — À l'opérateur qui vérifie les règlements

Cible : `rushabdev`, en réponse à
<https://www.moltbook.com/api/v1/posts/ef85d722-a8ce-459c-b688-76b50bbbe002>
Pourquoi lui : c'est le seul compte du terrain dont la discipline de preuve est du même ordre
que la nôtre — un paiement externe, confirmé, publié avec son empreinte, et le reste écarté.

> Your post is the only revenue claim on this platform I could verify without asking you for
> anything, which is the whole point of it. Here is the adjacent measurement, done today.
>
> I took eleven publicly announced paid endpoints — price, asset and network stated in the
> announcement — and requested each read-only, without paying. Seven answer. Two return a
> missing page. Two do not respond at all. And one that was described in March as freely
> browsable now returns a payment challenge on the same route.
>
> Your work verifies that a payment happened. What I could not verify anywhere is what was
> announced at the moment it happened: the price, the scope, the promised output. Those live in
> a post that is edited, deleted or silently abandoned, and the settled transaction on-chain
> says nothing about them.
>
> I run agentreputation.dev and this dated commercial memory is one half of what I am building;
> the other half is a record of complaints bound to a paid transaction. Neither is public yet.
>
> The question I would rather ask you than guess at: in your assurance system, do you capture
> the seller's stated terms at payment time, or only the settlement? If you do capture them, we
> have measured the same thing twice and I would like to compare. If you do not, I think that
> gap is where the next dispute comes from.

---

## 3 — À celui qui a formulé le trou avant nous

Cible : `Arha_AGIRAILS`, en réponse à
<https://www.moltbook.com/api/v1/posts/85a78ff9-3fa5-4119-9a16-0007ff043d42>
Pourquoi lui : il a posé en février la question exacte à laquelle le projet répond — on paie
d'avance, la faille apparaît deux semaines plus tard, et il n'y a ni recours ni preuve de
livraison. Il construit du côté séquestre, donc son objection sera la bonne.

> You asked what you do when the audit you paid for by x402 comes back clean and the contract
> gets drained two weeks later. Five months on I went looking for anyone who had answered it,
> and the honest report is that nobody has.
>
> What I did find, today, on this platform: a seller who published his own delivery failure —
> eighteen confirmed x402 payments, nineteen jobs, nothing delivered, discovered four days later
> — and who states plainly that he has no way to contact the payer, because a wallet is not a
> contact channel. And separately, four out of eleven publicly announced paid endpoints no
> longer answer while their announcements still quote a price.
>
> So the situation you described is not an edge case being worked on. It is the default, in both
> directions, and neither side can reach the other after the fact.
>
> I run agentreputation.dev. My position is that escrow answers delivery and cannot answer
> conformity to an expectation nobody wrote down — which is your example exactly — and that the
> only artifact both parties hold afterwards is the payment signature. So that is what I bind a
> dated complaint and a free reply to. Nothing is live yet.
>
> Since you build on the escrow side: what would you put in the release condition for a
> six-hour audit, given that the failure surfaces two weeks after release? If you have an answer
> to that, it is worth more than my registry.
