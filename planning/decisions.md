# Project Decisions

This file records important architectural and product decisions for the project and the rationale behind them. Use [roadmap.md](/C:/Users/liqui/Documents/farmrpg-tools/planning/roadmap.md) for milestone planning and [backlog.csv](/C:/Users/liqui/Documents/farmrpg-tools/planning/backlog.csv) for backlog items.

## Single-profile only

Status: Accepted

Decision:
The app supports a single local profile only.

Rationale:
The current product scope is focused on one player's local FarmRPG tracking workflow, and adding profile abstractions now would increase complexity without immediate user value.

Implications:
Storage, loaders, and views can assume one active local dataset. Multi-profile support remains a future product decision rather than a current design requirement.

## Local-first only, no backend

Status: Accepted

Decision:
The app operates as a local-first tool with no backend services.

Rationale:
The core use case is personal tracking and planning, and local-first behavior keeps the app simple, private, and low-maintenance.

Implications:
All persistence and reference-data usage should work in the browser without server APIs. Features that require remote sync are out of scope unless explicitly introduced later.

## Canonical item identity is derived from normalized item name for now

Status: Accepted

Decision:
Canonical item identity is currently based on normalized item name.

Rationale:
The available data sources do not yet provide a stable cross-source identifier that can be trusted as the primary key across mastery exports, reference data, and future planning inputs.

Implications:
Joins should continue using the normalization utilities. Future stronger identity support will need a deliberate migration path rather than an ad hoc change.

## `farmrpg_item_id` is optional external metadata, not the canonical key

Status: Accepted

Decision:
`farmrpg_item_id` is treated as optional external metadata and not as the canonical key.

Rationale:
FarmRPG item IDs are useful metadata, but current project assumptions do not treat them as the stable identity source for all joins.

Implications:
CSV loaders may preserve `farmrpg_item_id`, but current matching logic should not depend on it.

## `buddy_slug` is optional buddy.farm URL metadata, not the canonical key

Status: Accepted

Decision:
`buddy_slug` is treated as optional buddy.farm URL metadata and not as the canonical key.

Rationale:
`buddy_slug` is useful for enrichment and cross-reference workflows, but it is not the primary identity source for the local tracker.

Implications:
Missing `buddy_slug` values should not block reference-data use. Future buddy-oriented features should treat it as supplemental metadata.

## `mastery_difficulty.csv` remains separate from tower requirements data

Status: Accepted

Decision:
`mastery_difficulty.csv` remains a separate dataset from tower requirements data.

Rationale:
These files serve different purposes: one describes general mastery difficulty and notes, while the other describes tower-specific requirements.

Implications:
Each CSV should have its own loader and clear responsibilities. The app can join both against snapshots without merging them into one source file.

## Missing reference-data matches should be surfaced as non-fatal/unrated/unmatched rather than treated as hard errors

Status: Accepted

Decision:
Missing reference-data matches are surfaced visibly but do not break app workflows.

Rationale:
Reference data is expected to be incomplete during iterative maintenance, and the app should stay useful even when some rows do not match.

Implications:
UI should show unmatched or unrated states clearly. Loaders and derived views should avoid crashing when reference rows are missing.

## Tower requirements live in a separate CSV

Status: Accepted

Decision:
Tower requirements are stored in a dedicated CSV file.

Rationale:
Tower requirements are a distinct ruleset and should stay independently maintainable from mastery difficulty data.

Implications:
Tower support should load from `tower_requirements.csv` through a dedicated loader and derived view path.

## Tower levels 201-300 use MM requirements; GM begins at 301+

Status: Accepted

Decision:
Tower levels 201-300 use Mega Mastered requirements, and Grand Mastered requirements begin at tower level 301 and above.

Rationale:
This matches current tower-specific rules and the encoded requirement tier semantics already present in the tower CSV.

Implications:
Tower UI wording and derived status logic should reflect GM vs MM requirements clearly. The tower CSV remains the source of truth per row.

## App terminology should distinguish achieved mastery statuses from next-target tiers

Status: Accepted

Decision:
The app should use wording that separates achieved statuses from next-target thresholds.

Rationale:
FarmRPG uses inconsistent mastery terminology, which can be ambiguous in planning and summary views.

Implications:
Use labels such as `Mastered (>= 10,000)`, `Grand Mastered (>= 100,000)`, and `Mega Mastered (>= 1,000,000)` for achieved status. Use phrasing like `Next target: 100,000 (Grand Mastery)` when describing in-progress thresholds.
