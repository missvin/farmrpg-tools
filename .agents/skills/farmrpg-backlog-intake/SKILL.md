---
name: farmrpg-backlog-intake
description: Planning-only backlog intake workflow for the FarmRPG local-first planning tool. Use when Codex should turn casual product ideas, future-feature thoughts, Discord suggestions, planning notes, or "it would be cool later" conversations into coherent planning/backlog.csv rows; update existing rows when appropriate; or propose backlog rows without implementing product code. Supports propose-only, create-no-commit, and create-and-land backlog intake modes.
---

# FarmRPG Backlog Intake

Use this skill to convert a product or workflow idea into dependency-aware backlog rows. Keep it planning-only: do not implement product code, choose a next implementation path, or run app tests/lint/build unless product code was unexpectedly touched.

## Start-Up Read

Read the standard planning core before intake:

- `AGENTS.md`
- `planning/decisions.md`
- `planning/roadmap.md`
- `planning/architecture.md`
- `planning/backlog.csv`

Then keep retrieval targeted:

- Search existing backlog rows for duplicates, parents, dependencies, and related notes.
- Read relevant roadmap, decision, spec, or architecture sections only when needed to place the idea correctly.
- Use `planning/positioning.md` only as a secondary tie-breaker when placement is otherwise equivalent.

## Low-Usage Defaults

Default to low-usage intake. Keep feasibility checks backlog/planning-only unless the user explicitly asks for implementation investigation.

- Read only the minimum context needed to place the idea: planning core, candidate duplicate rows, direct dependency rows, and related roadmap/decision snippets.
- Do not inspect `dist/`, `generated/`, `probe-output/`, `node_modules/`, large CSV/JSON files, cache artifacts, generated manifests, or old probe outputs unless explicitly needed and approved.
- Use metadata, file names, headers, row counts, and targeted searches instead of opening full data or generated files.
- Do not validate feasibility by searching the whole repo unless the user asks for that deeper check.
- Treat unknown feasibility, source-data coverage, or implementation details as assumptions/questions in the row notes instead of investigating deeply.
- Before broad investigation, generated/cache inspection, large-file reads, full validation, or expensive commands, explain why it is necessary and ask for approval.
- If scope expands beyond intake, stop and report options instead of continuing.

Known failing command guardrail:

- Do not repeatedly try command patterns that have already failed in the session.
- If a cheap metadata/read-only command fails with a known sandbox/environment error such as `CryptUnprotectData failed`, stop and report the failure instead of retrying multiple variants.
- Before rerunning with escalation or an alternate command, explain why the rerun is necessary and ask for approval unless the user already explicitly authorized it.
- Prefer direct reads of small known files over broad shell commands, and prefer targeted checks over recursive commands.

Before editing, check the working tree with `git status --short --branch`.

- If unrelated product changes are already dirty, tell the user what is dirty in one concise sentence.
- Choose and state one path before proceeding: defer intake, isolate the intake in a separate worktree, include the intake in the current dirty scope, or first finish and land the current work.
- Do not silently mix a planning-only intake change into an unrelated dirty product-code tree.

## Operating Modes

Determine the mode from the prompt:

- `propose-only`: recommend rows and placement; do not edit files.
- `create-no-commit`: edit backlog/docs and validate; do not commit.
- `create-and-land`: edit, validate, commit, merge, and push with repo helpers.

Default to `create-and-land` only after the intake is clear enough to write rows safely. If the user asks for review, planning-only, or propose-only, do not edit.

## Intake Workflow

1. Restate the idea in one sentence.
2. Check whether an existing backlog row should be updated instead of adding a duplicate.
3. Choose the smallest proportional row set:
   - one row for a narrow idea
   - parent plus children only when the idea is a real workstream
   - no row spam for observations that can live in notes
4. Keep rows aligned with the existing schema and style.
5. Make dependencies explicit with `BL-###` tokens when rows need prior work.
6. Keep local-first, single-profile, no-backend, static-hosting, and normalized-item-key constraints intact unless a planning decision explicitly changes them.
7. Update `roadmap.md`, `decisions.md`, or a spec only when backlog placement alone would be misleading.
8. Keep unresolved implementation questions visible as assumptions or follow-up questions instead of broadening into code or data investigation.

## Implementation Handoff

Keep intake as intake. If backlog intake creates or updates actionable rows and the user wants implementation to continue in the same conversation:

- finish the intake readout first
- name the row or rows that are now ready for implementation
- recommend `$farmrpg-tools-next-slice` or explicitly confirm the user wants to continue into implementation
- do not edit product code under this skill unless product code was already unexpectedly touched and must be cleaned up or reverted with user approval

## Ambiguity Guardrails

Pause and ask before writing or landing rows when:

- the idea could reasonably become multiple product directions
- dependencies are unclear
- it touches `data/`, external sources, permissions, scraping, or source-of-truth questions
- it would create many rows or a new workstream
- it affects roadmap or milestone framing
- it seems more appropriate for `decisions.md`, a spec, or roadmap than backlog

When pausing, ask the smallest concrete question that resolves the ambiguity. If an idea is clear enough to create a planning placeholder but not enough to implement, create a small row with notes that name the unresolved decision.

## Row Guidance

Use the live `planning/backlog.csv` header exactly. Preserve row order conventions where practical by placing new rows near related rows or workflow skill rows.

For each added or updated row:

- set `status` to `inbox` for future product work and `shipped` for completed skill/setup work
- use `type` and `area` values already common in the backlog
- keep `scope_v1`, `dependencies`, and `notes` specific enough for later next-slice work
- use friendly fields when the row is user-facing or shown in internal backlog tooling
- avoid putting implementation details in `roadmap.md` when backlog notes are enough

## Git And Landing

In `create-and-land` mode:

- create a short-lived `codex/...` branch if starting on `master`
- use the `git codex-*` helpers from `AGENTS.md`
- stage exact files only
- commit with a concise planning/tooling message
- push the task branch, fast-forward merge to `master`, push `master`, and verify `master` is up to date with `origin/master`
- keep validation proportional to planning-only edits; do not run app tests/lint/build unless product code was touched unexpectedly

If a helper fails, stop and report the failure instead of silently falling back to raw git commands.

Before final readout, run `git status --short --branch`. If the tree is not clean, list the remaining dirty files and why they remain.

## Field Notes

Do not add a field note for routine skill creation, ordinary backlog intake, or validator/tooling friction.

Add a field note only when intake reveals a genuinely reusable product, planning, workflow, or engineering lesson with broader value. If a warranted note cannot be written, include `Field note not written` in the final readout with ready-to-paste note text.

## Final Readout

When rows are proposed, added, or materially updated, include a `Backlog Review Table` before the closing bullets. Keep the table narrow enough to read in chat; do not put long prose fields side by side because the renderer may squeeze useful columns such as `title`.

Use this compact table:

| Change | backlog_id | title | status | dependencies | friendly_summary |
| --- | --- | --- | --- | --- | --- |

Then add a `Backlog Review Details` subsection immediately after the table for long fields:

```md
### Backlog Review Details

**BL-### - Row title**
- Friendly description: Plain-language review description.
- Proposed solution: Implementation-facing summary, kept readable as normal wrapped text.
```

Column guidance:

- `Change`: `Added`, `Updated`, or `Proposed`
- `dependencies`: include only direct `BL-###` dependencies or `-` when blank
- `friendly_summary`: one short sentence, falling back to `user_value` only if the friendly field is blank
- `title`: use the full title; if the table is still too wide, remove `status` before shortening titles
- `friendly_description`: put in `Backlog Review Details`, not in the table
- `proposed_solution`: put in `Backlog Review Details`, not in the table; keep it concise but do not force it into a single table cell

Do not add wide operational fields such as `scope_v1`, `notes`, `source`, or `release_notes` to the table unless the user asks for them. Keep those in the normal final readout or mention only the important deltas.

End with:

- files changed
- idea captured
- rows added or updated
- validation run, including backlog CSV parse and header/schema preservation
- commit hash and branch/push status, or why work was not committed
- whether the final working tree is clean; if not, list what remains dirty and why
- whether product code, `data/`, app tests, lint, or build were touched or skipped
- field-note status
- suggested next step: usually `$farmrpg-backlog-paths` to sequence rows or `$farmrpg-tools-next-slice` to implement a selected row/path

Only include `Blocker for Rebecca` or `Recommended test for Rebecca` sections when they are truly needed.
