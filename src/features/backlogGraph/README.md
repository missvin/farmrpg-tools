# Backlog Graph Feature

This feature is intentionally split so it is easier to copy into another local-first repo that uses the same `planning/backlog.csv` schema.

Copy-friendly pieces:

- `backlogGraphData.ts`
  - canonical backlog CSV columns
  - backlog graph types
  - pure CSV parsing and node/edge/warning derivation
  - URL-based CSV loading helper
- `backlogGraphViewModel.ts`
  - pure UI-facing derivation helpers for filters, relationship groups, status classes, and overview layout
- `BacklogGraphView.tsx`
  - reusable read-only graph UI with focused mode, overview mode, shared selection, and detail rendering

Thin app-specific wiring to keep in the host repo:

- a small page wrapper that loads the local backlog CSV and renders the feature view
- route and navigation registration
- any host-app shell styling or page intro copy

Practical porting steps:

1. Copy this feature folder into the target repo.
2. Add a thin loader wrapper that points to that repo's local `planning/backlog.csv`.
3. Add a page wrapper and route entry in the target app.
4. Copy the backlog-graph CSS classes from the host app stylesheet if the target repo does not already have them.

This is meant for copying and adapting, not for package publishing or a shared library abstraction.
