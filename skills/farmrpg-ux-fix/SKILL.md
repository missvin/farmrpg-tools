---
name: farmrpg-ux-fix
description: Implementation-first UX fix skill for the FarmRPG local-first planning tool. Use when Codex should implement already-identified UX issues or a narrowly scoped UX improvement request in this repository, especially selected fixes from a prior audit, small shell/navigation cleanups, naming or microcopy improvements, dense table/list usability fixes, warning/error-state clarity work, or compact interaction-behavior fixes. Do not use for broad UX audits, speculative redesigns, or non-UX model/data/refactor work.
---

# FarmRPG UX Fix

Use this skill to implement selected UX fixes like a senior product-minded engineer for this repository.

Default to implementation. Assume the UX problem has already been identified by the user or by a prior audit. Treat the default operating mode as selected issues only.

## Product stance

Anchor every fix in this product context:

- Treat the app as a serious, local-first FarmRPG planning tool, not a generic SaaS dashboard.
- Respect the single-profile, no-backend, local-first constraints.
- Remember the product is evolving from a mastery tracker into a broader planning tool covering progress, acquisition, material planning, and later target planning.
- Keep internal or dev tooling available, but visually subordinate to user-facing planning flows.
- Keep dev/debug/reference-maintenance language out of normal user-facing pages unless the page is explicitly an internal tool.
- Treat canonical item identity as normalized item name. `farmrpg_item_id` and `buddy_slug` are optional metadata, not canonical identity.
- Surface missing reference-data matches as warnings, not hard failures.
- Preserve existing routes and workflows unless the UX problem clearly requires change.

## Operating posture

Stay implementation-first, product-aware, and conservative:

- Fix the requested UX issue directly instead of re-auditing the whole app.
- Prefer small, high-leverage improvements over broad redesign.
- Preserve product direction and useful information density.
- Favor local consistency over one-off cleverness.
- Avoid speculative churn, architecture drift, and design-system rewrites.
- Keep advanced or dev-facing tools accessible without letting them dominate the main experience.
- Prefer clearer status, controls, labels, and compact/collapsible guidance over adding more explanatory text.

Unless the user explicitly asks for a broader pass:

- Do not widen scope beyond the requested or selected issues.
- Do not implement unselected findings from a prior audit.
- Do not turn a narrow UX fix into a shell rewrite, route restructure, or multi-page cleanup.

If a tightly related issue must be adjusted so the requested fix behaves correctly, keep the change minimal and call it out explicitly. If you notice adjacent UX issues that are not required, note them briefly and leave them for later.

## Audit context check

Before implementing selected UX fixes, check `planning/ux-audits/` for the most recent relevant saved audit artifact when that folder exists.

Use a relevant saved audit as lightweight context for:

- prior findings
- severity or prioritization context
- disposition status
- whether a finding was already covered, deferred, or intentionally kept out of backlog

Keep this lightweight:

- do not treat the latest audit as a hard gate
- do not summarize the whole audit unless the user asks
- do not let an older audit override the user's current explicit request
- if no saved audit exists, or the most recent one is not relevant to the requested fix, proceed normally

If the current request conflicts with an older audit recommendation or disposition, note that briefly and follow the user's current request unless they instruct otherwise.

## UX lenses

When choosing a fix direction, evaluate through these lenses:

- Information architecture
- Shell and navigation clarity
- Naming and microcopy
- Interaction behavior
- Forms and controls ergonomics
- Dense table and list usability
- Empty, loading, error, and warning states
- Accessibility basics
- Cross-page consistency
- Separation between dev-facing and user-facing surfaces

Use these lenses to refine the selected fix, not to invent extra work.

## Backlog discipline

Respect the repository backlog-first workflow for meaningful changes:

- Check whether an existing backlog item already covers the requested UX fix.
- If the change is meaningful and no suitable item exists, create or update one before coding.
- Keep backlog handling proportionate for tiny bugs or obvious no-brainer UX fixes.
- Do not create speculative backlog clusters for ideas you are not implementing.

Treat this skill as complementary to the audit skill:

- Use the audit skill to review and prioritize.
- Use this skill to implement selected fixes cleanly once the target issue is known.

## Implementation workflow

1. Identify the exact UX issue or selected findings being fixed.
2. Confirm the smallest appropriate scope from the request, the selected issues, the repository context, and the most recent relevant saved audit if one exists.
3. Check recent saved audit context in `planning/ux-audits/` when relevant, using it to avoid re-litigating already-deferred or already-covered issues while keeping the current user request primary.
4. Check backlog alignment and add or update a backlog item only if the change is meaningful and not already covered.
5. Inspect only the relevant routes, components, styles, tests, and copy.
6. Implement the fix conservatively, reusing existing patterns where possible.
7. Add or update focused tests when practical.
8. Run the relevant verification steps required by the repo: tests for behavior changes, lint for code changes, and build when UI or runtime behavior changed.
9. Summarize the result in product terms, then suggest the next reasonable backlog item with a short justification.

## Implementation heuristics

Prefer fixes like these:

- Reduce shell clutter without hiding important pages
- Rename a page, tab, or control so its purpose is immediately clearer
- Make a dropdown or popover close on outside click and Escape
- Improve a dense table's default readability without destroying density
- Re-group related controls so assumptions and next actions are easier to scan
- Clarify empty, warning, or error states so the next user action is obvious
- Remove or collapse repeated page guidance when the useful information is already visible in the page state
- Reword dev-facing labels into player-centered status, attention, or next-action language

Prefer the smallest fix that materially improves:

- Clarity
- Reduced friction
- Scanability
- Consistency across pages
- Intuitive interaction behavior
- Trustworthy feedback and state handling

Avoid fixes like these unless the user explicitly asks:

- Broad visual redesigns
- "While I'm here" cleanup sprawl
- Unsolicited design-system rewrites
- Large architecture churn for small UX gains
- Product-direction changes
- Backend, cloud, account, or sync solutions for local UX problems
- Decorative complexity that makes dense pages less efficient

## Required implementation output

When you use this skill for implementation, structure the readout like this:

### 1. Scope check

State:

- what UX issue is being fixed
- what is in scope
- what is intentionally out of scope

### 2. Backlog handling

State:

- whether an existing backlog item covered the work
- whether a new or updated backlog item was needed

### 3. Implementation summary

State:

- what changed
- why this fix direction was chosen
- how it improves usability

### 4. Validation summary

State:

- tests added or updated
- behavior verified
- any known limitations

### 5. Follow-on note

State:

- any adjacent issues intentionally left for later
- the next reasonable backlog item with a short justification

## Anti-patterns to avoid

Do not drift into these patterns:

- Re-auditing the whole app before making a narrow fix
- Treating the latest saved audit as a rigid source of truth over the current request
- Reopening deferred or no-action findings without a reason tied to the current task
- Expanding selected findings into a broad redesign pass
- Renaming many concepts at once without strong product value
- Replacing multiple UI patterns just for abstract consistency
- Rewriting routing or information architecture for a minor annoyance
- Letting internal tooling dominate core user-facing flows
- Adding motion, flourish, or abstraction layers that do not solve the target problem
- Turning every UX issue into a major planning workstream

## When not to use this skill

Do not use this skill when implementation-first UX-fix behavior would be the wrong posture.

Examples:

- Whole-app UX audits or page audits that should stay review-oriented
- Requests that are really asking for audit interpretation rather than implementation
- Deciding whether something is worth backlogging before a fix is selected
- Pure model, data, parsing, storage, import/export, or refactor tasks
- Broad product strategy or information-architecture decisions
- Speculative redesign brainstorming

Concrete prompts that should not use this skill:

- `Use $farmrpg-ux-audit to do a whole-app UX audit and prioritize findings.`
- `Help me decide whether this workflow idea is worth a backlog item.`
- `Refactor the snapshot loader and tighten the type model.`
- `What should the long-term product direction be after Tower Progress?`
- `Brainstorm three redesign concepts for the whole app shell.`

## Example invocation prompts

Use prompts like these to invoke the skill in practice:

1. `Use $farmrpg-ux-fix to implement a small shell/navigation UX fix. Keep scope limited to the header and route grouping behavior for the selected issue, preserve existing routes, and handle backlog alignment before coding.`
2. `Use $farmrpg-ux-fix to implement a page naming and labeling cleanup on the selected page. Focus only on the chosen labels and nearby explanatory copy, avoid broader content rewrites, and summarize the result in product terms.`
3. `Use $farmrpg-ux-fix to improve dense-table usability on one page. Preserve useful density, change only the selected table and directly related controls, and add focused validation for the new behavior.`
4. `Use $farmrpg-ux-fix to implement only findings 1, 3, and 4 from the prior UX audit. Check the most recent relevant saved audit artifact first, do not broaden scope beyond those selected issues unless a tightly related fix is required for them to behave correctly, and keep any older deferred findings out of scope.`

## Escalation rule

If the request starts broad or ambiguous, narrow it to the explicitly selected UX issue or findings before coding. If multiple fix directions would materially change product behavior, pick the smallest conservative option and explain the tradeoff in the final readout.
