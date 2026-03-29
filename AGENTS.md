# AGENTS.md

This file defines persistent repository rules for coding agents.  
Task-specific instructions should be provided in the prompt.

---

## What this project is

Local-first FarmRPG mastery tracker.

Key constraints:

- single-profile only
- local-first only
- no backend
- canonical item identity comes from normalized item name
- `farmrpg_item_id` and `buddy_slug` are optional metadata, not canonical identity
- missing reference-data matches should surface as non-fatal warnings

If a requested change conflicts with these constraints, surface the conflict instead of silently working around it.

If task instructions conflict with AGENTS.md, follow the task instructions but note the conflict.

---

## Canonical reference data

Files in `data/` are canonical project reference data.

These files define the authoritative item metadata and game reference inputs used by the application.

Rules:

- code may read from these files freely
- do not modify anything in `data/` unless the task explicitly instructs you to do so
- do not “fix”, normalize, or reorganize reference data unless explicitly requested

If a task appears to require modifying canonical reference data, pause and surface the issue instead of silently altering those files.

---

## Planning workflow

Planning files are part of the repo workflow:

- `planning/backlog.csv` — canonical structured work log
- `planning/roadmap.md` — milestone/status view
- `planning/decisions.md` — architecture decisions
- `planning/releases.md` — release/versioning notes

For non-trivial work:

- confirm the relevant backlog item before coding
- create one if it does not exist
- update the same item when the work is complete

Update planning files only when appropriate:

- update `roadmap.md` when milestone status materially changes
- update `decisions.md` for architecture decisions
- update `releases.md` for release implications

Do not create backlog entries for tiny incidental edits.

---

## How to work

Think before coding:

- do not silently guess through ambiguity
- state assumptions when they matter
- ask for clarification when multiple interpretations would produce different outcomes

Keep changes small:

- prefer the smallest correct change
- reuse existing patterns before adding abstractions
- avoid speculative future-proofing

Be surgical:

- touch only files relevant to the task
- prefer modifying existing files over creating new ones unless clearly warranted
- do not refactor unrelated code
- do not rewrite unrelated comments, naming, or formatting
- do not modify files in `data/` unless explicitly instructed

---

## Implementation preferences

- prefer pure derivation helpers for business logic
- keep normalization rules explicit
- prefer inline warnings over modal popups unless explicitly requested
- treat storage/import/export changes as compatibility-sensitive
- preserve user data unless destructive behavior is explicitly intended

---

## Verification

Before declaring success:

- run relevant tests for behavior changes
- run lint for code changes
- run build when UI/runtime behavior changed

Do not claim success without verification.

---

## Versioning

Use `MAJOR.MINOR.PATCH`:

- major — breaking data/storage/model change
- minor — new feature/page/capability
- patch — bugfix or UX polish

---

## Commit style

Use concise conventional-style commit messages, for example:

- `feat(v1.5): add tower requirements page`
- `fix(import): correct missing-tier validation logic`
- `ux(import): improve warning visibility`
- `chore(planning): update backlog`

## Secondary project consideration: 

When choosing between otherwise reasonable backlog options, prefer work that both improves the real product and creates strong evidence for Rebecca’s professional positioning. This must not override core product goals, architecture constraints, or backlog discipline.