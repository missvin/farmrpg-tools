# Whole-App UX Audit

- Date: 2026-03-22
- Scope: Whole-app UX audit of the currently shipped user-facing surfaces in this repository
- Inputs reviewed:
  - `AGENTS.md`
  - `planning/decisions.md`
  - `planning/roadmap.md`
  - `planning/architecture.md`
  - `planning/backlog.csv`
  - `skills/farmrpg-ux-audit/SKILL.md`
  - Shared shell, routes, styling, and current page components under `src/`

## Overall assessment

The app mostly does feel like a serious local-first planning tool now, not just a mastery tracker with add-ons. The shared shell, clearer branding, and dev-tools separation are real improvements.

The biggest remaining friction is coherence at the workflow level. A few primary routes still read like internal labels or placeholders, some pages over-expose debug or maintenance detail, and the app still makes users infer how related pages fit together instead of helping them move between them.

## Prioritized findings

### 1. Primary nav exposes a shipped-looking History page that is still only a placeholder
- Severity: `P1`
- Confidence: `high`
- Implementation size: `small`
- What feels confusing/clunky: `History` sits in the main `Progress` menu beside real workflow pages, but the page itself is only a title and one-sentence intro.
- Why it matters: This hurts trust more than a missing feature hidden elsewhere, because the shell implies the page is usable now. It makes the app feel more like accumulated scaffolding than one coherent tool.
- What kind of fix would likely help: Either remove or hide `History` from primary navigation until it has a real minimal read-only history list, or give it a lightweight first useful surface immediately.

### 2. Settings is doing too much product work for a page labeled "Settings"
- Severity: `P1`
- Confidence: `high`
- Implementation size: `medium`
- What feels confusing/clunky: `Settings` includes backup/restore plus owned stockpiles, stored pet inventory, and future pet production inputs in one long page.
- Why it matters: It blurs app settings with planning inputs, which makes the information architecture feel improvised and makes acquisition planning harder to discover as part of the product.
- What kind of fix would likely help: Split planning-input sections into a clearly named planning-data page or subsection surfaced from the planning area, and keep `Settings` focused on app behavior, backup, and restore.

### 3. Route and page naming still reflect implementation history more than user tasks
- Severity: `P1`
- Confidence: `high`
- Implementation size: `small`
- What feels confusing/clunky: Labels like `Sorted`, `History`, and `Compare` are generic, while `Material Planner` points to a page titled `Ingredient Demand List`.
- Why it matters: Naming is a big part of whether the app feels like one product. Right now some labels describe implementation format, some describe user intent, and some are too vague to be trustworthy.
- What kind of fix would likely help: Normalize route labels around jobs-to-be-done. The biggest wins are renaming `Sorted`, aligning `Material Planner` with its page title, and making `Compare` and `History` more explicit.

### 4. The import page still defaults to a debug-heavy posture
- Severity: `P1`
- Confidence: `high`
- Implementation size: `small`
- What feels confusing/clunky: The primary import flow is good, but the same page immediately expands into parsed row details, canonical keys, tier row groups, and filterable row-level parser inspection.
- Why it matters: Import is one of the most foundational user-facing flows. When debug detail dominates the default page, the whole app feels less polished and less confident.
- What kind of fix would likely help: Keep the validation report visible by default, but move row-level parser inspection behind a collapsed advanced or debug details disclosure.

### 5. The Settings page appears to use missing CSS hooks, which likely creates a visible consistency bug
- Severity: `P0`
- Confidence: `high`
- Implementation size: `small`
- What feels confusing/clunky: Settings uses `data-table` and `checkbox-row` classes, but those selectors do not exist in the shared stylesheet. Other pages consistently use styled `summary-table` and `checkbox-field`.
- Why it matters: This is the kind of surface-level inconsistency users read as "this page belongs to a different app." It also weakens dark-mode and spacing consistency.
- What kind of fix would likely help: Either style `data-table` and `checkbox-row`, or switch Settings to the existing shared table and checkbox patterns.

### 6. Pages describe related tools in copy, but rarely help users move to them
- Severity: `P2`
- Confidence: `high`
- Implementation size: `small`
- What feels confusing/clunky: Empty states and explanatory text often tell the user what to do next without giving a direct route there.
- Why it matters: The app has enough pages now that workflow glue matters. Without direct links, the shell has to do all the navigation work.
- What kind of fix would likely help: Add small inline links or action buttons in empty states and related-page copy so users can move directly to the next step.

### 7. Ingredient Lookup and Material Planner feel like duplicated siblings rather than one planning area
- Severity: `P2`
- Confidence: `high`
- Implementation size: `medium`
- What feels confusing/clunky: Both pages load the same engines and expose nearly the same modifier controls, with only the result format changing.
- Why it matters: Repeated control blocks make the app feel broader than it is, and users have to relearn whether they are in a lookup tool or a planner tool even though the underlying planning model is shared.
- What kind of fix would likely help: Keep both surfaces, but unify their framing more clearly as two views of the same planning workspace, with tighter naming and obvious cross-links.

### 8. Compare uses canonical keys in a user-facing changed-items table
- Severity: `P1`
- Confidence: `high`
- Implementation size: `small`
- What feels confusing/clunky: The changed-items table renders canonical keys in the main item column instead of a user-facing item name.
- Why it matters: Canonical keys are appropriate for debugging and maintenance, but this page is otherwise positioned as a normal user-facing progress view. It makes the comparison feel more technical than it needs to.
- What kind of fix would likely help: Show the display item name first and keep the canonical key as secondary detail only if needed.

### 9. Grouped dropdown nav is cleaner, but still weak on immediate orientation
- Severity: `P2`
- Confidence: `medium`
- Implementation size: `small`
- What feels confusing/clunky: The shell only shows section buttons like `Plan` and `Progress` until a menu is opened, and the active state marks the section rather than the current destination.
- Why it matters: This is better than tab sprawl, but once the app has multiple planning surfaces, a user should be able to tell where they are from the shell without opening a menu.
- What kind of fix would likely help: Keep the grouped nav, but show the current route name somewhere persistent in the shell or on the active section button.

### 10. Long dense pages still need one more pass of task-oriented controls
- Severity: `P2`
- Confidence: `medium`
- Implementation size: `medium`
- What feels confusing/clunky: `Tower Progress` and `Sorted` are useful, but long lists still ask users to scan manually. `Sorted` has only name filtering, and `Tower Progress` has no filter or search for its remaining-items list.
- Why it matters: Useful density is fine here, but once lists get long, scanability needs lightweight controls to stay trustworthy.
- What kind of fix would likely help: Add minimal search, filter, or sort controls only where lists are long enough to justify them, starting with Tower Progress.

## Strengths

- The shell branding is pointed and appropriate for the product. The app now reads as local-first planning software, not just a tracker.
- The split between `Tower` and `Tower Progress` is good. They genuinely feel like different views of the same domain, and the copy explains the distinction well.
- The app is strong on trustworthy non-fatal warning behavior. Import warnings, unmatched reference-data handling, and backup restore confirmation all preserve confidence without turning local edge cases into hard failures.
- Dev-facing surfaces are reasonably contained. Putting Museum Tools and Backlog Graph under `Dev Tools` is the right direction and already prevents them from dominating the main user flows.

## Recommendation summary

### Bugs / no-brainer fixes

- Missing `data-table` and `checkbox-row` styling on Settings
- Compare page showing canonical keys in the main item column
- History route usefulness or gating mismatch

### High-value polish opportunities

- Clean up route and page naming so the app reads like one planning tool
- Reduce the default debug density on Import
- Add direct links between related pages and in empty states
- Reframe Settings so planning inputs are not buried under a generic settings label

### Later / nice-to-have ideas

- Give the grouped nav stronger current-page orientation
- Add lightweight scan controls to long lists like Tower Progress
- Further unify Ingredient Lookup and Material Planner as two views of one planning area

## Backlog recommendation check

Strong enough for immediate backlog additions:

- Settings styling regression or missing shared CSS hook usage
- Compare item-name presentation
- History page or nav gating mismatch

Not strong enough for immediate backlog additions by itself:

- Broader route naming cleanup
- Import debug de-emphasis
- Cross-linking and workflow glue
- Ingredient planning consolidation

## Disposition table

| Finding | Outcome | Backlog / reference | Notes |
| --- | --- | --- | --- |
| History route usefulness or gating mismatch | `backlog-now` | Candidate; no backlog row added yet | Strong shell-trust issue and the clearest immediate workflow mismatch from the audit. |
| Settings missing shared CSS hook usage | `backlog-now` | Candidate; no backlog row added yet | Treated as a concrete visible bug rather than general polish. |
| Compare shows canonical keys in a user-facing item column | `backlog-now` | Candidate; no backlog row added yet | Small user-facing clarity fix with a strong bugfix feel. |
| Settings as a mixed app-settings and planning-input page | `defer` | Roadmap v1.9-v2.1 acquisition planning evolution | Worth revisiting once acquisition surfaces settle more. |
| Route and page naming drift | `defer` | Related to `BL-092` shell cleanup and later workflow polish | Important, but better handled after the product surface stabilizes further. |
| Import debug-heavy default posture | `defer` | Related to shipped import validation work in `BL-007` | Good candidate for future polish, but not urgent enough to force now. |
| Missing cross-links between related pages | `defer` | Later workflow polish | Valuable glue work, but not yet foundational enough to justify immediate scheduling. |
| Ingredient Lookup and Material Planner feel too duplicated | `already-covered` | Roadmap v1.8-v2.1 acquisition and target-planning direction | Broader planning-workspace convergence is already part of the product direction. |
| Grouped nav still weak on immediate orientation | `already-covered` | `BL-092` | The repo already shipped shell cleanup; any remaining orientation polish is follow-on rather than a separate urgent workstream. |
| Long dense pages need more task-oriented controls | `already-covered` | `BL-005` plus later workflow polish in roadmap | Tower-specific filter and summary follow-up is already in backlog, and broader list polish can wait. |
