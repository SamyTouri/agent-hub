# Project archive

This directory preserves tracked historical artifacts that are no longer part of the active
runtime, build, tests, deployment, operator workflows or current MVP.

## Rules

- Archive only after proving that an artifact is not imported, executed by an npm/Vercel script,
  linked by active documentation, managed by a routine, or part of the current working-tree diff.
- Use `git mv` semantics so file history remains traceable.
- Organize by `YYYY-MM/<nature>/`; do not create deeper taxonomies without a demonstrated need.
- Record every move in [`MANIFEST.md`](./MANIFEST.md), including the restoration command.
- Never archive generated caches. `.next/`, `node_modules/`, `__pycache__/`, `*.pyc`,
  `*.tsbuildinfo`, logs and local dependency copies are regenerable artifacts, not history.
- Never place secrets, local environment files, routine state, `.outreach/`, Obsidian content or
  active MVP files here.
- `Communication/`, the constitution surfaces and shared-memory files require their own explicit
  review and are not moved by a general cleanup.

An empty period/category directory is not kept. Ambiguous candidates stay at their original path
until their inactivity is proven.
