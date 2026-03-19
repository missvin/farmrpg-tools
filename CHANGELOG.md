# Changelog

This changelog is a concise manual view derived from shipped backlog items and `release_notes` in [`planning/backlog.csv`](/C:/Users/liqui/Documents/farmrpg-tools/planning/backlog.csv).

Note:
- Older items map cleanly to released versions in the backlog metadata.
- Some newer shipped items still use planning-oriented targets such as `future` or `v1.7` rather than an explicit shipped release version.
- Until shipped-version tracking is formalized, those items are listed under `Unreleased / post-v1.6 shipped work` instead of being assigned a possibly misleading release number.

## Unreleased / post-v1.6 shipped work

- Added a storage foundation for keeping multiple local snapshots with stable IDs and saved/imported metadata.
- Completed the local buddy.farm recipe acquisition pipeline from museum seed parsing through canonical local recipe outputs.
- Added local intermediate buddy recipe extraction outputs from confirmed found item pages.
- Added local recipe-entity reconciliation outputs against the museum-seed item universe.
- Generated canonical local recipe reference CSVs from the reviewed buddy recipe pipeline.
- Cataloged crafting mastery-affecting modifier families and formula assumptions for later planning math.
- Added local crafting modifier state for unlocked resource saver perks and temporary meal/event bonuses.
- Added a validated runtime recipe graph loader over the canonical local recipe CSVs.
- Added a reusable crafting calculation engine for modifier totals, effective output math, and required-craft planning helpers.
- Added a reusable recursive ingredient burden engine with scope-aware ingredient totals for `M`, `GM`, `MM`, and `Tower`.
- Added an ingredient lookup page with recursive burden results by scope and lightweight modifier assumptions.
- Added a local app-wide dark mode with persistent theme preference and shared theme variables.
- Documented the narrow runtime boundary exception for an internal local-only backlog visualization feature.
- Added optional friendly backlog metadata fields for future internal planning views.
- Added a local backlog graph loader with graph-ready nodes, edges, and non-fatal warning support.
- Added a read-only internal backlog graph page with selected-item relationship view and detail panel.
- Added lightweight focus mode and filter controls to keep the internal backlog graph readable.
- Added status-based color treatments to backlog graph nodes while keeping text cues and selection styling intact.

## v1.6

- Added runtime validation for malformed tower CSV schemas, tiers, and duplicate slots.
- Clarified unmatched mastery and tower summaries so missing reference matches are easier to review and maintain.
- Added runtime schema validation for the local mastery difficulty and tower requirements CSV loaders.
- Added a Tower Progress page with unique-item planning summaries, difficulty breakdowns, and progress bars.
- Added expandable Tower Progress difficulty buckets with row-level outstanding requirement drilldown.
- Added a local snapshot comparison view with summary deltas and changed-item inspection.
- Added a read-only import validation report with duplicate-row, skipped-line, and anomaly summaries before saving.
- Added a local Museum Tools parser that turns pasted museum exports into deduplicated seed lists with validation and CSV/JSON export.
- Added a local buddy item candidate generator from museum seed CSV with review flags for slug edge cases.
- Added a local buddy candidate probe script with polite request pacing and reviewable result exports.
- Added local tooling to extract reviewable item icon URLs from confirmed buddy item pages.
- Added a shared Back to top button so long pages are easier to navigate.
- Made the shared Back to top control appear during scrolling instead of only at the bottom of long pages.

## v1.5.6

- Simplified the default Tower detail table with compact `M`/`GM`/`MM` labels and planning-focused progress columns.

## v1.5.5

- Grouped Tower levels by `tower_level_range` and moved fully completed ranges into a collapsed `Completed ranges` section.

## v1.5.4

- Collapsed completed Tower levels by default and highlighted the next blocking Tower requirement.

## v1.5.3

- Made incomplete-import warnings much more prominent before the user can save.
- Updated the import example to look like a real FarmRPG export and clarified that extra lines are okay.

## v1.5.2

- Added an import warning for likely incomplete mastery exports, with an option to continue anyway.

## v1.5

- Added a Tower view that shows requirement status from your latest local snapshot.
