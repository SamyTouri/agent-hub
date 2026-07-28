# Evidence history — operator guide

The catalogue answers *what is true right now*. This layer answers *what changed, when,
and according to which source* — the question a buyer actually has before paying. Every
existing import overwrites: the registry sync replaces the description and the endpoint,
the probe replaces the last availability state, the repository import replaces the last
counter. The replaced value is gone. The ledger keeps it.

## What is deliberately not built

- **No daily snapshot of the catalogue.** ~17,500 subjects photographed every day would be
  more than six million near-identical rows a year, for no proof at all.
- **No raw page storage.** A long text is kept as a bounded excerpt plus the digest of its
  full normalized form, so an edit past the excerpt is still detected while storage stays
  proportional to the evidence.
- **No global uniqueness on the fingerprint.** That would forbid recording a return to a
  previous state — and a host that fails again after recovering is exactly the evidence
  worth having. Deduplication is against the *previous* observation, not against history.

## Access levels

| Level | Contains |
|---|---|
| `public` | Method, provenance, current summary, which fields moved and when. Never a before/after value. |
| `paid` | The ordered timeline with the exact before and after of every change. |
| `private` | Collection internals: fingerprints, chain links, which job wrote which row. |

Two independent gates apply. Each row carries a `visibility` (may it be shown at all), and
the reader's access level decides the shape. A row captured as `private` stays invisible
even to a paying reader. There is **no public HTTP surface** for timelines: the export is
an operator command that prints to stdout.

## Release order

The code ships first and tolerates the missing tables; the migration is applied by a human
afterwards.

1. Deploy the code. Both crons keep working: `loadActiveCohort` catches SQLSTATE `42P01`
   and the collectors report `not_migrated` instead of failing.
2. Apply the migration:
   ```
   node scripts/run-sql-file.mjs db/migration-evidence-history.sql
   ```
   It is additive and idempotent — no existing table is altered, no data is migrated.
3. Select the cohort and capture the baseline (see below).
4. From then on, the sources that have a collector append on their own, and only when
   something changed.

Which sources actually accumulate:

| Source | How it grows | Manual baseline |
|---|---|---|
| `mcp-registry` | The registry cron appends a profile observation whenever the upstream delta reports a change. | No — the cron owns this chain. |
| `concordium-cis8004` | The Concordium importer appends a profile observation, on-chain anchors included. | No — the importer owns this chain. |
| `endpoint-probe` | The daily cron appends on every availability transition, for every cohort subject with a public endpoint. | Yes, from the last stored probe result. |
| `moltbook`, `native` | **Baseline only.** No importer appends profile observations for them yet, so they contribute their initial reading plus endpoint availability, and nothing else until a collector exists. The stored selection reason says this explicitly. | Yes — otherwise they would have no history at all. |

## Cohort commands

`DATABASE_URL` comes from the environment. Nothing is read from disk, nothing is printed
that could carry a secret.

```
node --experimental-strip-types scripts/evidence-cohort.mts            # dry run, writes nothing
node --experimental-strip-types scripts/evidence-cohort.mts --apply    # cohort rows + baseline
node --experimental-strip-types scripts/evidence-cohort.mts --baseline # baseline only
```

The dry run is the default. `--apply` refuses to write if the cohort violates its
invariants (size outside 20–50, a stratum or family over its ceiling, a missing non-MCP
provenance, an unversioned rule, an empty reason). Re-running `--apply` never rewrites an
existing selection reason: the justification stays the one recorded the day the subject was
picked, which is the whole point of storing it.

**A profile chain has exactly one author.** Two guards enforce it, for the same reason: a
false observation in an immutable ledger cannot be edited out.

*The baseline is initialization-only.* It reads the stored catalogue row, while the crons
read the fresh upstream payload — two readings of the same reality that are never
byte-identical. If the baseline were allowed to *extend* a chain, a rerun would append a
"change" that never happened at the vendor. So a subject and source that already has any
observation is skipped outright, whatever its content. Rerunning is therefore safe and does
nothing for subjects already being tracked; it only starts chains for subjects added since.
The output counts them as `started` and `already-tracked`.

*The baseline never writes a profile for a provenance that has its own collector.* Not even
the first one. For Concordium the stored row cannot hold what the importer records — the
on-chain anchors live nowhere in `agents` — so a manual baseline is a poorer reading of the
same subject, not merely an older one. Written first, the importer's next run would diff
against it and publish `anchors added`: an anchoring event that never happened. The command
reports those subjects as *profile chain left to its own collector*. The cost is accepted
deliberately: an MCP subject's profile chain starts at the first upstream delta that
reports it, and a Concordium subject's at the next importer run, so the first stored row
may be post-change rather than a snapshot of selection day. A late chain start can be
repaired by a collector; a fabricated change cannot be repaired at all.

Availability is the opposite case and is still baselined here, for every subject: both
readings come from the same probe through the same reducer, so the baseline is that
collector's own last measurement rather than a competing view of it. A subject that has
never been probed gets no availability row — inventing one would be the same mistake in a
different chain.

### Versions, and why writing goes through a manifest

The cohort is versioned, not replaced. The original forty subjects keep the rule and the
reason recorded on the day they were picked; an extension adds a layer and rewrites
nothing. `selection_rule` already carries the version in the database, so no migration is
involved. Selection is **incremental**: already-tracked subjects count against the caps and
are never picked again, which is what keeps the total from overshooting when a later
version would have chosen a different set.

**v2 (2026-07-28) targets 112 subjects**, and that number is derived rather than rounded.
Three connectors per workplace family instead of one, because a single Slack connector
cannot distinguish "this family moves" from "this vendor moves"; thirty multi-source
subjects, which is the surface where two registries can contradict each other; forty on
availability watch, the largest stratum because it is the only one guaranteed to produce
evidence — a host already silent will eventually transition, and whether the ledger
accumulates anything at all is the pilot's open question; and twelve non-MCP, the ceiling
of what exists. The caps sum to exactly the target. The operating bound is that the whole
cohort must fit inside **one probe wave** (125 wide): past that, part of the tracked set
can go unchecked on a given day, silently.

Writing never re-derives the selection:

```
node --experimental-strip-types scripts/evidence-cohort.mts --plan <file.json>
# review the file — it lists every addition with its rule and reason
node --experimental-strip-types scripts/evidence-cohort.mts --apply --manifest <file.json>
```

The rule is deterministic for a given catalogue, but the catalogue moves. Re-running the
rule at write time would let the reviewed set and the written set diverge with nobody
seeing it. So `--plan` freezes the exact list with a content hash, and `--apply` refuses a
manifest that changed by one character since it was reviewed. `--apply` without a manifest
is refused outright.

Four strata, applied in this order, a subject taken only once:

| Stratum | Cap | What it tests |
|---|---|---|
| `business_system_connector` | 10, one per family | Whether the workplace connectors an access-governance buyer must approve produce attributable change history. |
| `multi_source_identity` | 12 | Identity resolution across a registry entry, a source repository and a live endpoint — and whether those sources start contradicting each other. |
| `availability_watch` | 10 | That the ledger records availability *transitions*, not one row per identical daily probe. |
| `non_mcp_provenance` | 8, max 4 per provenance | That the design is not shaped by a single registry. |

Every stratum requires an observable surface — a public endpoint or a source repository.
A subject with neither can only repeat what it says about itself and would sit in the
cohort producing one baseline forever.

The cohort table has no foreign key to `agents`, for the same reason the ledger has none:
a selection justification is a dated fact about *our* method, not a dependency of the
current profile. A cascade would have erased the record of why we started tracking a
subject at the exact moment we would want to explain it. `subject_key` keeps the handle as
it was on selection day, so the audit row stays readable without the profile.

Candidates are always ordered alphabetically. Popularity is never a tie-break: where a
repository signal is used, only its *existence* counts, as proof that a third collector
looked, never its value.

The workplace families are a bounded proxy chosen by us. The reason stored on every one of
those rows says so explicitly and states that no vendor endorsed the selection. Do not
present them as anyone's integration list.

Family keywords are matched as whole tokens against the **last handle segment and the
display name** — not the namespace prefix (the registry names nearly everything
`io.github.<owner>/<repo>`, so "github" would otherwise match thirteen thousand unrelated
servers) and not the free-text description (a weather server whose README mentions Slack is
not a Slack connector). The SQL pre-filter uses the same expression as the rule, so a
family can never be starved by an approximate query.

## Timeline export

```
node --experimental-strip-types scripts/evidence-timeline.mts <handle>
node --experimental-strip-types scripts/evidence-timeline.mts <handle> --access paid
node --experimental-strip-types scripts/evidence-timeline.mts --cohort
```

Default access is `public`. `paid` and `private` print the full change history: they go to
a local file or to a buyer, never to a public page, an issue or an email. The command warns
on stderr and the document itself carries the mention.

## Cost

Reads: one bounded cohort query per cron run. Writes: only on a genuine change, capped at
`MAX_OBSERVATIONS_PER_RUN` (100) per call and bounded by the cohort size regardless. Writes
are sequential — the Supabase transaction pooler is `max:1` and concurrent statements
pipeline and hang.

The daily cron probes the cohort inside the **same** network wave as the catalogue
rotation rather than in a second pass; a separate pass would have doubled the cron's
network time and halved the rotation for the same information. The cohort is placed at the
head of the wave, so it is covered every day even when the budget cuts the run short. A
wave is only started if enough time remains to absorb a patient second chance — previously
a wave could start at 44 s and be killed at 60 s with the probes done but never written.

## Checking a collection cycle

```
node --experimental-strip-types scripts/evidence-cycle-check.mts
node --experimental-strip-types scripts/evidence-cycle-check.mts --since <iso> --until <iso>
```

Read-only, sequential, `SELECT` only. It triggers no cron and writes nothing. The window
defaults to the last 24 hours.

**Zero new observations is a successful cycle.** The ledger only writes on change, so an
empty window proves nothing on its own, and the report never treats stable row counts as
proof that a job ran. Each check returns `passed`, `failed` or `inconclusive`, and the ones
that cannot be settled say what they cannot settle.

What the database genuinely can prove, and how:

| Signal | Why it is evidence |
|---|---|
| A ledger row signed by `cron:registry` or `cron:registry/concordium` inside the window | Direct attribution: only those collectors write under those names, so that import ran and wrote. |
| A catalogue row carrying a check dated inside the window | The probe writes the current-state check on every pass, changed or not — so a fresh check proves a probe ran, even when the ledger stayed empty. It does not prove it was the cron: the offline catch-up script writes the same field. |
| No fresh check at all | The probe step left no trace. That is a real finding, but the database cannot tell "never invoked" from "invoked and failed before writing". |
| No import-signed row at all | Inconclusive, never a failure: an empty upstream delta produces no write. |
| A catalogue row touched without a fresh check | **Context only, never proof.** `agents.updated_at` is refreshed by a generic trigger on any write to the row — registration, claim and maintenance scripts included — so it can never attribute a write to an import and can never produce `passed`. |

The report deliberately does **not** state how many identical states were suppressed. The
window can span several cycles, and a check that produced no row leaves nothing to count;
a confident number there would be a comfortable fiction.

**The database cannot prove a Vercel invocation.** The report says so explicitly and names
the separate check to run: the cron logs for `/api/cron/registry` and `/api/cron/daily`
over the same window. No telemetry is invented to fill that gap.

**A failed cron and a successful write are not mutually exclusive.** The first production
cycle (2026-07-28) makes the point concretely: the platform recorded
`Task timed out after 60 seconds` on `/api/cron/daily`, and the database nonetheless shows
250 fresh checks including all 36 probeable cohort subjects. The work had completed; only
the response was lost. So read the two sources together and in this order — the database
says what was written, the Vercel logs say whether the function returned. Neither answers
the other's question, and the timeout in that run was a symptom of the route's own
`maxDuration`, not of a collector failure.

That route now declares the same 300-second ceiling as the registry cron and works against
a single deadline anchored at the start of the request. The previous budget only counted
the probe's own time, so the keep-alive query, IndexNow and the purge spent from a wallet
nobody was watching. IndexNow is bounded and yields first: it is search-engine
housekeeping, while a probe that was performed and never written is a lost measurement
about someone else's agent. The response now carries `elapsed_ms` and
`deferred_to_next_run`, so a short run is legible instead of having to be inferred from a
falling counter.

### What a cycle costs, in three separate stacks

Every report carries a `cost` block with a model version, and it keeps three things apart
on purpose: what was **observed** in the database, what was **derived** with a stated
formula, and what remains **unavailable**. A cost figure that blends the three reads like
an invoice when it is an estimate, which is precisely the reproach this project makes of
everyone else.

Observed: cohort size, probeable subjects, subjects freshly checked, catalogue rows with a
fresh check, ledger rows written split into baselines and transitions, and table size.
Derived: outbound probe requests as a **bound** — one attempt per host plus a patient
second only when the first got nothing, and the per-host attempt count is not recorded —
and ledger writes per subject checked, whose expected steady state is zero.

Unavailable, and therefore no monetary figure: invocation count and execution duration.
No query proves a Vercel invocation, and detailed runtime logs are not readable under the
current plan. Stage timings exist only in the cron response, which nothing stores; an
operator who captured one can pass it with `--captured-cron-response <file.json>` and it
enters the report **with its provenance**, never as a database measurement.

The report also counts chain defects (dangling parents, forks, duplicate baselines,
cross-chain parents, identical consecutive states, backdated rows), attribution anomalies
(a chain with more than one collector, an unknown source), and the approximate table and
index size.

**One multi-collector chain is designed, not defective.** An availability chain starts
with the manual baseline (`script:evidence-cohort`) and continues with the daily cron
(`cron:daily`), because the baseline records the probe's own last measurement rather than
a competing reading of it — the section above says why. So that exact pair, on
`endpoint-probe` only, is reported as an expected handoff and does not fail integrity.
Everything else still does: a third collector on an availability chain, either of those
two on a profile chain where single authorship is the rule, or any other combination.
Without the exception the first genuine availability transition — the event the pilot is
waiting for — would have been reported as a corrupt ledger.

The exception is named in the output rather than applied silently, and the handoffs are
listed alongside the anomalies. If the multi-collector query ever returns a full sample,
the check reports `inconclusive` instead of `passed`: an anomaly could sit outside a
truncated list, and a truncated list must not read as a clean bill of health.

## Turning a chronology into a decision

```
node --experimental-strip-types scripts/evidence-policy.mts --demo
node --experimental-strip-types scripts/evidence-policy.mts <handle> --example strict
node --experimental-strip-types scripts/evidence-policy.mts <handle> --policy <file.json>
```

`--demo` touches no database: it replays the **synthetic** scenarios so the shape of the
result can be shown without inventing a history for a real supplier. Any other invocation
reads the database read-only.

The output is a decision relative to the supplied criteria — `criteria_satisfied`,
`conditional_activation`, `insufficient_evidence` or `criteria_not_satisfied` — and it
means nothing outside that policy. It is never a score, a ranking or a certification, and
**policy fit is not a public surface**: it sits with full histories behind the paid level.

Three properties are load-bearing and are tested as such:

- **Absence of evidence is never failure.** A source we never observed returns `unknown`
  and pushes the whole evaluation towards `insufficient_evidence`. Observed absence — the
  source was read and declares no repository — is a different thing and may fail.
- **The evaluator has no discretion.** `conditional_activation` only ever comes from a
  criterion the policy itself declared conditional, together with a safeguard its author
  wrote. A conditional criterion without a safeguard is rejected as an invalid policy.
- **Sources are never merged.** A contradiction names both values and both observation
  ids; nothing arbitrates between them.

The vocabulary is closed and versioned — six kinds, no expressions, no user-supplied code,
no weights: `source_present`, `field_present`, `field_in`, `no_change_since`,
`checked_since`, `no_contradiction`. A policy declares the vocabulary version it was
written against and is refused rather than reinterpreted if that version is unknown.

One subtlety worth keeping in mind when writing a policy: `checked_since` reads the
current-state record, never the ledger. Asking the ledger how fresh our evidence is would
report a perfectly stable supplier as stale, because a stable supplier produces no rows.
When the caller cannot supply a last-check date, the criterion is `unknown` and says why.
Likewise `no_change_since` returns `unknown` when our own history is younger than the
window the policy asks about — claiming ninety calm days after two days of tracking would
be true and misleading.

## Correcting a mistake

Observations cannot be updated or deleted, including by the production role: a trigger
refuses `UPDATE`, `DELETE` and `TRUNCATE`, and triggers fire for the table owner where RLS
and grants do not. A wrong observation is retracted by appending a dated one — the same
public-correction doctrine adopted on 2026-07-25. Bypassing the lock requires deliberately
disabling the trigger as the owner, which is a traceable act, not an application accident.
