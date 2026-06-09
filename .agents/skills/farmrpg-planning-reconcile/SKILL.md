---
name: farmrpg-planning-reconcile
description: Planning-first reconciliation workflow for the FarmRPG local-first planning tool. Use when Codex should audit or update planning/backlog.csv, planning/roadmap.md, and related planning docs for backlog/roadmap drift, stale umbrella rows, dependency or status drift, milestone clarity, roadmap refreshes, planning-doc consistency, or proposed-workstream placement. Do not use for product-code implementation, selecting and coding the next backlog slice, UX audits or fixes, pure refactors, one-off bugs, or prompt-only handoffs.
---

# FarmRPG Planning Reconcile

Use this skill as a pragmatic planning editor and product-ops reviewer. The goal is to make the planning system more truthful, coherent, and useful without adding bureaucracy.

This is a planning/documentation skill. Do not change product code, `data/`, or runtime behavior.

## Project Stance

- This is a local-first FarmRPG planning tool with no backend and a single local profile.
- The repo is backlog-driven; meaningful work lives in `planning/backlog.csv`.
- The roadmap is milestone-driven and should answer "what can I now do?" instead of merely listing shipped foundations.
- Umbrella rows may remain open while child rows ship, but their notes/status should not understate progress.
- Older rows may become stale as newer, sharper rows are added.
- Internal tooling, durability, and skills are important enablers, but roadmap milestones should stay focused on user-facing capability.

## Start-Up Read

Read the standard planning core before reconciling:

- `AGENTS.md`
- `planning/decisions.md`
- `planning/roadmap.md`
- `planning/architecture.md`
- `planning/backlog.csv`

Then use targeted retrieval:

- relevant backlog rows
- parent, child, and `BL-###` dependency rows
- relevant roadmap sections
- relevant decisions, releases, positioning, or spec docs only when needed

## Operating Modes

- `Audit-only`: inspect planning docs and report drift without editing.
- `Reconcile`: make small planning-doc or backlog updates to resolve documented drift.
- `Roadmap-refresh`: update milestone framing from shipped/current backlog state.
- `Umbrella-cleanup`: focus on parent/umbrella rows and shipped/open child status.

Default behavior:

- If the user asks generally to reconcile backlog/roadmap, inspect first, then make only small, justified planning updates.
- If the user asks audit-only, do not edit files.
- If the user names rows or milestones, focus there and do not broaden unless needed to avoid a misleading result.

## Reconciliation Workflow

When reconciliation would benefit from parallel subagent review, follow `planning/subagent-review-workflow.md`. Use subagents only for bounded, evidence-based review scopes, and synthesize their findings before editing planning files.

1. Define the reviewed scope: files, rows, dependencies, parent/child clusters, and roadmap sections.
2. Classify findings:
   - stale umbrella rows
   - rows whose status/notes understate shipped child progress
   - rows superseded or narrowed by newer work
   - dependency drift or sequencing mismatches
   - duplicate or overlapping rows
   - roadmap/backlog mismatches
   - planning-doc conflicts
   - structural source-of-truth or dependency misses that should trigger `planning/failure-recovery-protocol.md` rather than ordinary cleanup
3. Apply the smallest evidence-based edit when the mode allows editing.
4. Preserve useful planning history. Prefer note corrections, scoped wording, or small row splits over sweeping rewrites.
5. Leave unresolved work visible. Do not over-clean just to make the plan look tidier.

## Backlog Discipline

- Do not create backlog items for every observation.
- Add or modify rows only when needed to make planning actionable or truthful.
- Keep rows small, dependency-aware, and aligned with the existing schema.
- Do not renumber backlog rows.
- Preserve shipped rows unless a note correction is clearly necessary.
- Do not mark a parent or umbrella shipped unless the full intended scope is complete.
- If newer child rows take over remaining scope, update parent notes honestly instead of pretending the umbrella is complete.
- Avoid inventing large new workstreams unless a clear gap exists.

## Roadmap And Planning Docs

- Keep roadmap milestones outcome-oriented and human-readable.
- Avoid duplicating detailed backlog content into roadmap.
- Flag roadmap sections that overpromise or mix unrelated stories.
- Update milestone wording only where clarity or current-state accuracy requires it.
- Add or update `planning/decisions.md` only when a real architectural or product decision has been made.
- Keep planning docs complementary rather than duplicate versions of each other.

## Output Contract

Return a concise readout with these sections:

- `Scope reviewed`: files, rows, and sections inspected.
- `Findings`: stale rows, roadmap/backlog mismatches, dependency/sequencing issues, duplicate/superseded items.
- `Changes made`: exact rows/files changed and why, if edits were made.
- `Changes deliberately not made`: rows or sections left alone and why.
- `Remaining mismatch / risk`: anything still unresolved.
- `Final readout`: files changed, planning rows updated, verification, suggested commit command if not committing directly, field-note status, and next reasonable backlog item with a short justification.

Do not run app tests/lint/build unless product code was touched. For planning-only changes, validate with CSV import, targeted file inspection, and diffs.

Only include these sections when actually needed:

- `Blocker for Rebecca`: name the manual action, why it is required, and what can continue after it.
- `Recommended test for Rebecca`: name the manual check, what it validates, and whether work can continue without it.

## Field Notes

Use `C:\Users\liqui\Documents\codex-post-notes\field-notes.md` only when reconciliation reveals a genuinely reusable workflow, product, or planning lesson.

Do not add a field note for routine planning cleanup.

Use a high bar:

- material workflow improvement
- reusable pattern that changed how future work should be done
- interesting failure mode with broader implications
- product or systems decision with a clear lesson

When a field note is warranted:

- Append to the existing file; do not rewrite it.
- If writing outside the repo requires approval, pause and request approval.
- If the file/path cannot be written after reasonable attempts, include `Field note not written` with the reason and exact ready-to-paste note text.
- Keep it factual, short, dated, repo/project-specific, evidence-based, and not polished marketing copy.
- Include date, repo/project, backlog item if applicable, the concrete lesson, and brief evidence of why it mattered.

Final readout must include exactly one field-note status:

- `Field note added` with a short reason
- `No field note added; this was routine planning cleanup`
- `Field note not written` with ready-to-paste text, only if a note was warranted but could not be written

## Key Design Choices

- Planning-first: this skill edits planning truth, not product behavior.
- Evidence-first: every edit should point back to live backlog rows, roadmap wording, or accepted decisions.
- Small by default: prefer targeted row notes and milestone wording over taxonomy redesign.
- History-preserving: shipped work and unresolved scope should remain visible.

## Example Invocations

```text
Use $farmrpg-planning-reconcile to audit backlog/roadmap drift without editing. Report stale rows, roadmap mismatches, and dependency issues only.
```

```text
Use $farmrpg-planning-reconcile in umbrella-cleanup mode. Focus on parent rows whose children have shipped recently, and update only notes/status where the parent understates progress.
```

```text
Use $farmrpg-planning-reconcile in roadmap-refresh mode. Refresh roadmap milestones from the current backlog state while keeping the roadmap outcome-oriented and human readable.
```

```text
Use $farmrpg-planning-reconcile to review this proposed workstream: <describe workstream>. Tell me whether it belongs in backlog, roadmap, decisions, or a separate spec, and make only small planning updates if warranted.
```

## When Not To Use This Skill

Do not use this skill for:

- straightforward implementation work
- selecting and coding the next backlog slice
- UX audits or UX fixes
- pure code refactors
- one-off bug fixes
- situations where the user only wants a Codex implementation prompt
