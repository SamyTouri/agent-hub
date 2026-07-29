# Project archive

This directory preserves tracked artifacts that are no longer part of the active runtime, build,
tests, deployment, operator workflows or current MVP — **or that are still functional but no
longer belong to the current product doctrine**.

Nothing here is deleted. Every entry in [`MANIFEST.md`](./MANIFEST.md) carries the command that
puts the file back.

## Two admissible grounds for archiving

**Ground 1 — inactivity.** The artifact is not imported, not executed by an npm/Vercel script,
not linked by active documentation, not managed by a routine, and not part of the current
working-tree diff. Proof is an exact-path and import search plus a check of `package.json`,
`vercel.json`, the workflows and the active documentation.

**Ground 2 — doctrinal obsolescence (added 2026-07-29).** The artifact still works and may still
be referenced, but it serves a product the project no longer builds. This ground exists because
the pivot of 2026-07-29 retires functioning code — discovery, semantic search, scoring,
marketplace and governance mechanics — that Ground 1 alone would protect indefinitely.

Ground 2 has its own, stricter burden of proof, and all three parts are required:

1. `docs/DOCTRINE.md` states that the project no longer does this.
2. Every dependency gate is actually lifted: no active import remains, and any public contract
   the artifact served has a working replacement **already in the tree**, not merely planned.
3. Public compatibility is settled — an indexed public route is redirected or deliberately kept,
   and the decision is written down. Reducing the file count is never a reason to break a public
   URL.

An artifact that fails any of the three stays where it is, and the manifest records the gate that
blocked it.

## Rules

- Never archive to make a number smaller. Archive because the artifact is inactive (Ground 1) or
  because the project stopped doing that thing (Ground 2).
- Use `git mv` semantics so file history remains traceable.
- Organize by `YYYY-MM/<nature>/`; do not create deeper taxonomies without a demonstrated need.
- Record every move in [`MANIFEST.md`](./MANIFEST.md) with origin, destination, ground, proof,
  current replacement and the exact restoration command.
- **This directory is excluded from the typecheck (`tsconfig.json`), from deployment
  (`.vercelignore`) and from default agent reading (`AGENTS.md`, `CLAUDE.md`). It stays tracked by
  Git — that is what makes restoration possible. Never add it to `.gitignore`.**
- Nothing under `archive/` may be imported by active code. An import into this directory means the
  move was wrong; restore the file rather than reaching into the archive.
- Never archive generated caches. `.next/`, `node_modules/`, `__pycache__/`, `*.pyc`,
  `*.tsbuildinfo`, logs and local dependency copies are regenerable artifacts, not history.
- Never place secrets, local environment files, routine state, `.outreach/`, Obsidian content or
  active MVP files here.
- `Communication/`, the constitution surfaces and shared-memory files require their own explicit
  review and are not moved by a general cleanup.

An empty period/category directory is not kept. Ambiguous candidates stay at their original path
until their inactivity is proven.
