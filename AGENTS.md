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

If there is any ambiguity before changing `data/`, pause and ask. Do not guess through uncertain reference-data changes.

---

## Planning workflow

Planning files are part of the repo workflow:

- `planning/backlog.csv` — canonical structured work log
- `planning/roadmap.md` — milestone/status view
- `planning/decisions.md` — architecture decisions
- `planning/releases.md` — release/versioning notes

For non-trivial work:

- confirm the relevant backlog item before coding
- work directly from the relevant backlog row
- create one if it does not exist
- if a slice materially advances but does not complete the row, update that row's status/notes conservatively before finishing
- update the same item when the work is complete

Default read set for non-trivial tasks:

- always read `AGENTS.md`, `planning/backlog.csv`, and `planning/decisions.md`
- add `planning/roadmap.md` when sequencing or milestone fit matters
- add `planning/architecture.md` for compatibility-sensitive work
- use `planning/positioning.md` as secondary guidance when relevant, not as a primary planning artifact

Update planning files only when appropriate:

- update `roadmap.md` when milestone status materially changes
- update `decisions.md` for architecture decisions
- update `releases.md` for release implications

Do not create backlog entries for tiny incidental edits.

Use `$farmrpg-backlog-intake` when casual ideas or future-feature notes should be converted into backlog rows.

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

## User-facing UX defaults

- normal user-facing pages should prioritize player status, what needs attention, and the next useful action
- do not expose dev/debug/reference-maintenance framing in normal user workflows unless the page is explicitly an internal tool
- prefer clearer data, controls, labels, and compact collapsible guidance over adding more explanatory text

## Hosted deployment boundary

- hosted/Vercel use remains static and local-first unless a backlog item explicitly changes that architecture
- deploying to Vercel does not imply backend, auth, sync, Blob, Functions, or multi-device continuity
- hosted work should preserve browser-local state and backup/restore expectations unless explicitly scoped otherwise

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

## Git command workflow

Use the repo-local safe Codex git helpers for branch, stage, commit, push, and merge work:

- `git codex-branch`
- `git codex-stage`
- `git codex-commit`
- `git codex-push`
- `git codex-merge`

The helpers read temporary input from `recovery/codex-branch-name.txt`, `recovery/codex-stage-paths.txt`, and `recovery/codex-commit-message.txt`. These files are ignored and should be removed automatically after successful helper use.

If a helper fails, stop and report the failure. Do not silently fall back to raw `git add`, `git commit`, `git push`, or `git merge`.

For normal one-off tasks, do not commit unless the user asks. For `farmrpg-tools-next-slice` runs, completed work should be committed, merged, and pushed by default unless the user explicitly asks not to land it, asks for planning-only/review-only, or the work is not safe to land.

When landing next-slice work, use a short-lived `codex/...` task branch if needed, then use the helper workflow to stage exact files, commit, push the task branch, fast-forward merge into `master`, and push `master`. End by verifying whether `master` is up to date with `origin/master`.

## Secondary project consideration

Use `planning/positioning.md` as guidance when multiple backlog options are otherwise reasonable. Prefer work that improves the real product and also strengthens the project as a case study for Rebecca’s professional positioning.

Treat this as a secondary tie-breaker only. Do not use it to justify off-strategy scope, performative complexity, architecture violations, or skipping normal backlog/dependency discipline.
