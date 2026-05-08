---
name: farmrpg-tools-next-slice
description: Backlog-driven plan-and-do workflow for the FarmRPG local-first mastery and planning tool. Use when Codex is asked to pick and implement the next practical backlog slice in this repository, continue project work without a named item, or run a dependency-aware FarmRPG implementation pass grounded in planning/backlog.csv. Do not use for planning-only, review-only, broad audits, or one-off tasks where the user names an exact change instead of asking for next-slice selection.
---

# FarmRPG Tools Next Slice

Use this skill to choose and implement the next small, dependency-valid backlog slice for this FarmRPG local-first planning tool.

Default to plan-and-do. If the user explicitly says planning-only or review-only, stop after the requested plan or review.

## Start-Up Read

Read this planning core before choosing a slice:

- `AGENTS.md`
- `planning/decisions.md`
- `planning/roadmap.md`
- `planning/architecture.md`
- `planning/backlog.csv`

Then keep context targeted:

- Read the exact selected backlog row.
- Read dependency rows referenced by `BL-###` tokens in `dependencies`.
- Read additional planning or spec docs only when the selected item needs them.
- Use `planning/positioning.md` only as a secondary tie-breaker when multiple backlog options are otherwise reasonable.

## Slice Selection

Choose one backlog row from `planning/backlog.csv` using the repo's current schema: `backlog_id`, `parent_id`, `title`, `type`, `status`, `priority`, `effort`, `area`, `dependencies`, `target_version`, and `notes`.

Selection rules:

- Choose the smallest dependency-valid, non-`shipped`, non-`icebox` actionable row.
- Prefer child/actionable rows over umbrella rows.
- Treat `BL-###` tokens in `dependencies` as backlog dependencies; do not choose a row blocked by an unshipped dependency.
- Avoid rows blocked on manual user input, missing source data, or unresolved product intent unless the user supplies what is needed.
- Use roadmap/current milestone fit when it clearly applies, but do not hard-code a milestone if the live backlog says otherwise.
- Use priority and positioning only after dependency validity and slice size are clear.

Before editing, briefly state:

- selected `backlog_id` and title
- why it is the next reasonable slice
- short implementation plan

Proceed unless the user pauses, redirects, or asked for planning-only/review-only.

## Implementation Discipline

Follow the repo rules in `AGENTS.md`:

- Keep the change small and tied to the selected backlog row.
- Avoid broad "while I am here" refactors.
- Prefer existing patterns and pure derivation helpers for business logic.
- Preserve local-first, single-profile, no-backend behavior.
- Preserve normalized item name as canonical identity.
- Keep missing reference-data matches non-fatal.
- Do not modify `data/` unless the selected backlog item specifically requires reference/tooling data changes.
- Treat storage/import/export changes as compatibility-sensitive.

Update planning files only when appropriate:

- Update `planning/backlog.csv` status/notes when the slice advances or completes.
- Update `planning/roadmap.md`, `planning/decisions.md`, or `planning/releases.md` only when the selected item genuinely changes milestone status, architecture decisions, or release implications.

## Verification

Run checks proportional to the files touched:

- Behavior changes: relevant `npm.cmd run test` target, or `npm.cmd run test` when no narrower target exists.
- Code changes: `npm.cmd run lint`.
- UI/runtime changes: `npm.cmd run build`.
- Planning/docs/skill-only changes: validate the changed artifact when tooling exists; app tests/lint/build are not required unless product code changed.

Do not claim success without saying what was run or why a check was skipped.

## Git And Landing

Use `AGENTS.md` as the source of truth for the repo-local safe git workflow.

- Do not commit unless the user asks.
- When the user asks to commit, merge, push, or otherwise land the work, use the `git codex-*` helpers described in `AGENTS.md`.
- If a helper fails, stop and report it instead of silently falling back to raw git commands.
- When asked to finish landing work, verify the final branch/upstream status and report whether `master` is up to date with `origin/master`.

## Field Notes

Use `C:\Users\liqui\Documents\codex-post-notes\field-notes.md` as a cross-repo capture log only when something genuinely reusable or noteworthy occurs.

Do not add a field note for routine backlog implementation.

Use a high bar. Examples that can warrant a note:

- a workflow improvement that materially reduces friction or risk
- a reusable pattern that changed how future work should be done
- an interesting agent/tooling failure mode with broader implications
- a product or systems decision with a clear lesson behind it

Do not add field notes for routine validation fallback, local environment quirks, setup noise, or ordinary implementation friction unless they reveal a repeated cross-repo pattern worth writing about.

When a field note is warranted:

- Append to the existing file; do not rewrite it.
- If writing outside the repo requires approval, pause and request approval.
- If the file/path is unavailable or cannot be written after reasonable attempts, include a `Field note not written` section in the final readout with the reason and exact ready-to-paste note text for Rebecca.
- Keep the note factual, short, dated, repo/project-specific, evidence-based, and not polished marketing copy.
- Include date, repo/project, backlog item if applicable, the concrete workflow/product/engineering lesson, and brief evidence of why it mattered.
- Avoid secrets, tokens, private personal data, and marketing language.

## Final Readout

End with a concise readout that includes:

- files changed
- backlog item implemented/updated
- tests/lint/build run, or why not
- concise implementation summary
- suggested commit command if not committing directly
- next reasonable backlog item plus short justification

Also include exactly one field-note status:

- `Field note added` with a short reason
- `No field note added; this was routine implementation work`
- `Field note not written` with ready-to-paste text, only if a note was warranted but could not be written

Only include these sections when actually needed:

- `Blocker for Rebecca`: name the action Rebecca must take, why it is required, and what can continue after it.
- `Recommended test for Rebecca`: name the manual check, what it validates, and whether work can continue without it.

Do not commit unless the user asks. If committing, follow the Git And Landing section and use a concise conventional-style message.
