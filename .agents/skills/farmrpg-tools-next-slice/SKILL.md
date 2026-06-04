---
name: farmrpg-tools-next-slice
description: Backlog-driven plan-and-do workflow for the FarmRPG local-first mastery and planning tool. Use when Codex is asked to pick and implement the next practical backlog slice, implement a selected or named backlog path in order, continue project work without a named item, or run a dependency-aware FarmRPG implementation pass grounded in planning/backlog.csv. Do not use for planning-only, review-only, broad audits, comparing multiple possible paths, or one-off tasks where the user names an exact change instead of asking for next-slice or selected-path implementation.
---

# FarmRPG Tools Next Slice

Use this skill to choose and implement the next small, dependency-valid backlog slice for this FarmRPG local-first planning tool.

Default to plan-and-do. If the user explicitly says planning-only or review-only, stop after the requested plan or review.

For comparing multiple possible 5-10 item work paths, use `$farmrpg-backlog-paths` instead. This skill implements one selected slice or one selected path; it should not generate competing path recommendations.

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

Backlog-first implementation gate:

- Do not edit product code, UI files, storage/import/export code, or canonical `data/` files until the selected backlog row exists in `planning/backlog.csv`.
- If the row does not exist, create or update the backlog row first, validate the backlog CSV, and state the new or updated `backlog_id` before continuing.
- If the selected row was just created during the same turn, pause after the backlog edit long enough for the user to redirect before starting product-code changes.
- Do not start implementation from an unbacklogged plan, even when the user provides a detailed product plan.
- If dependency validity, artifact sufficiency, claimed shipped status, or verification trust is undermined during the slice, stop forward implementation and follow `planning/failure-recovery-protocol.md`.

Proceed unless the user pauses, redirects, or asked for planning-only/review-only.

## Selected Path Mode

If the user provides a named path, screenshot/list of path items, or ordered backlog-item list, treat that as the selected implementation path.

- Do not reselect a different path.
- Resolve each named row against `planning/backlog.csv`.
- Implement items in dependency-valid order, preserving the user's order when dependencies allow it.
- Pause before ambiguous, risky, data-dependent, or manual-input-dependent items.
- Prefer sensible slice boundaries over one giant undifferentiated change.
- Keep each change scoped to the current path row or tightly coupled row group.
- Update `planning/backlog.csv` status and notes as each row advances or completes.
- Run proportional verification after each meaningful slice, or at clearly justified checkpoints when a path consists of several small tightly related rows.
- Keep readouts clear about which path item or items were completed and which remain.

If the provided path includes an item blocked by unshipped dependencies outside the path, explain the blocker and pause unless the dependency is already included and can be implemented first.

## Implementation Discipline

Follow the repo rules in `AGENTS.md`:

- Keep the change small and tied to the selected backlog row.
- Avoid broad "while I am here" refactors.
- Prefer existing patterns and pure derivation helpers for business logic.
- Preserve local-first, single-profile, no-backend behavior.
- Preserve hosted-static, browser-local assumptions unless the selected backlog row explicitly introduces backend, auth, sync, Blob, Functions, or multi-device continuity.
- Preserve normalized item name as canonical identity.
- Keep missing reference-data matches non-fatal.
- Do not modify `data/` unless the selected backlog item specifically requires reference/tooling data changes.
- If there is any ambiguity before changing `data/`, stop and ask instead of guessing.
- Treat storage/import/export changes as compatibility-sensitive.
- Keep normal user-facing pages focused on player status, what needs attention, and the next useful action; move dev/debug/reference-maintenance framing to internal tools or secondary detail surfaces.
- For UX-facing work, prefer clearer data, controls, labels, and compact collapsible guidance over adding more explanatory text.

Dirty-tree and interruption handling:

- If a new user request arrives while the working tree has uncommitted product changes, run `git status --short --branch` before taking action.
- Tell the user what is dirty in one concise sentence.
- Choose and state one path before proceeding: finish and land the current slice first, isolate the new request in a separate worktree, defer the new request, or explicitly include it in the current commit scope.
- Do not silently accumulate unrelated work in the same dirty tree.

Large-slice checkpointing:

- When a slice touches three or more categories among product code, UI, `data/`, storage/import/export, tests, and planning files, treat it as a large slice.
- For large slices, prefer finishing and landing promptly once a coherent verified state exists.
- If interrupted before landing a large slice, give a status checkpoint that lists the selected row, dirty file groups, verification already run, and the recommended next action.
- Avoid starting unrelated work until the large slice is committed, isolated, or intentionally folded into the same scope.

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

- For this next-slice skill, commit, merge, and push completed work by default unless the user explicitly asks not to land it, asks for planning-only/review-only, or the work is not safe to land.
- Use the `git codex-*` helpers described in `AGENTS.md` for branch, stage, commit, push, and merge work.
- If the slice starts on `master`, create a short-lived `codex/...` task branch before staging so `git codex-merge` can land the work through the normal fast-forward path.
- If a helper fails, stop and report it instead of silently falling back to raw git commands.
- After landing work, verify the final branch/upstream status and report whether `master` is up to date with `origin/master`.
- Before final readout, run `git status --short --branch`. If the tree is not clean, list the remaining dirty files and why they remain.

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
- selected path item(s) completed and remaining, when using selected-path mode
- commit hash and branch/push status, or the reason work was not committed
- whether the final working tree is clean; if not, list what remains dirty and why
- next reasonable backlog item plus short justification
- any recommended user testing or Rebecca actions needed because of the completed work or to unlock the next backlog item
- hosted/user-test implications when the work affects Vercel-visible behavior, local browser storage, backup/restore, import/export, or data durability

Also include exactly one field-note status:

- `Field note added` with a short reason
- `No field note added; this was routine implementation work`
- `Field note not written` with ready-to-paste text, only if a note was warranted but could not be written

Only include these sections when actually needed:

- `Blocker for Rebecca`: name the action Rebecca must take, why it is required, and what can continue after it.
- `Recommended test for Rebecca`: name the manual check, what it validates, and whether work can continue without it.

For next-slice runs, land completed work by default. If not landing, say why and include the exact suggested commit command.
