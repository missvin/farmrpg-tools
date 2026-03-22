# Roadmap

This file is for near/mid-term milestone planning; use [backlog.csv](/C:/Users/liqui/Documents/farmrpg-tools/planning/backlog.csv) for the detailed backlog.

## v1.5 (Complete)

- Tower requirements support
  - Load `tower_requirements.csv`
  - Join against the latest saved snapshot by normalized item name
  - Add a simple read-only Tower view with requirement status and non-fatal unmatched handling

## v1.5.4 (Complete)

- Tower page quality-of-life pass
  - Add accordion/collapse behavior for completed tower levels so the next relevant requirements are easier to scan

## v1.5.5 (Complete)

- Tower range grouping follow-up
  - Group by `tower_level_range` and collect fully completed range groups under `Completed ranges`

## v1.5.6 (Complete)

- Tower detail cleanup follow-up
  - Simplify the default detail table for planning, including compact M/GM/MM requirement labels

## v1.5.2 (Complete)

- Detect collapsed mastery export sections during import and warn the user

## v1.5.3 (Complete)

- Make incomplete-import warnings more visually prominent
- Use a more realistic raw export example on the import screen

## v1.6 (Complete)

- Improve import and reference-data maintenance workflows
  - Import validation report
  - Unmatched reference data polish
  - Tower data validation
- Expand local planning views
  - Tower progress planning page with unique-item GM/MM counts, difficulty summaries, and progress bars
  - Tower progress difficulty drilldown accordion for row-level inspection inside difficulty buckets
  - Snapshot comparison view with two-snapshot summary deltas and changed-item inspection
  - Sorted page tier-and-difficulty accordion rollup
- Shared app polish
  - Cross-page back-to-top affordance
  - App-wide dark mode

## v1.7 (Current)

- Deepen local planning foundations
  - Crafting mastery rules and user modifier model
  - Crafting mastery calculation engine
  - Recursive ingredient burden engine
  - Ingredient demand lookup and sortable list views
  - Planner recipe-policy exclusions and shared crafting assumptions such as permanent saver and Iron Depot
- Extend local acquisition-planning foundations beyond crafting
  - Shared acquisition source taxonomy and planner input model
  - Owned stockpile inputs
  - Stored pet inventory import
  - Future pet production forecast support
- Strengthen local durability and portability
  - Snapshot history foundation
  - Full local backup export, restore, and validation-safe rollback
- Improve internal planning workflow support
  - Backlog graph loader, page, focus controls, overview mode, and feature extraction

## Later

- Expand non-crafting acquisition modeling
  - Consumable acquisition assumptions for Cider, Lemonade, and Arnold Palmer
  - Manual explore acquisition model
  - Per-item acquisition breakdown and first cross-source recommendation flow
  - Acquisition explainability and provenance
- Add recursive target-output planning
  - Shared target-output planning model
  - Normalized pooled available-supply layer with overrides
  - Recursive remaining-requirement engine and multi-target support
  - First target-output planning page
  - Later graph/tree visualization
- Continue focused planning views and workflow polish
  - Tower filters and summaries
  - Current inventory import as a planning supply source
  - Backlog/release workflow maintenance
- Improve optional cross-reference enrichment
  - Buddy slug enrichment
  - Buddy slug acquisition workflow
  - Export unmatched tower rows
- Revisit stronger item identity when it becomes necessary for planning breadth
  - Canonical key formalization
  - Item alias support
  - Early item registry groundwork

## Icebox

- Community process features
  - Community feature request intake
  - Community voting workflow
- Deferred import/docs ideas
  - Mastery export help page with an import-screen link
