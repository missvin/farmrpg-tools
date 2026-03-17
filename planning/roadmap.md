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

## v1.6 (Current)

- Strengthen item identity beyond normalized names
  - Canonical key formalization
  - Item alias support
  - Early item registry groundwork
- Improve import and reference-data maintenance workflows
  - Import validation report
  - Unmatched reference data polish
  - Tower data validation
- Expand local planning views
  - Tower progress planning page with unique-item GM/MM counts, difficulty summaries, and progress bars

## Later

- Expand local planning views
  - Tower filters and summaries
  - Snapshot comparison view
  - Spreadsheet replacement planning views
- Prepare recipe-aware planning foundations
  - Recipe graph schema
  - Recipe-based planning MVP
- Improve optional cross-reference enrichment
  - Buddy slug enrichment
  - Buddy slug acquisition workflow
  - Export unmatched tower rows

## Icebox

- Community process features
  - Community feature request intake
  - Community voting workflow
- Deferred import/docs ideas
  - Mastery export help page with an import-screen link
