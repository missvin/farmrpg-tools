# Current Architecture

This document summarizes the current runtime architecture of the local-first FarmRPG mastery tracker. It is a practical overview of how the app works today, not a speculative future design document.

## Purpose And Scope

- Give humans and coding agents a compact map of the current system
- Clarify source-of-truth boundaries and runtime responsibilities
- Highlight places where changes are low-risk versus compatibility-sensitive

## Core Constraints

- Local-first only
- Single-profile only
- No backend
- Missing reference-data matches are non-fatal
- `data/` contains canonical reference data
- Planning files are project workflow artifacts, not runtime data
- Narrow exception: `planning/backlog.csv` may be consumed locally for an internal read-only backlog visualization feature only
- Hosted deployments remain static SPA deployments unless an explicit backlog item introduces backend, auth, sync, Blob, Functions, or multi-device continuity

## High-Level System Shape

- Import/parsing layer
  - Parses pasted FarmRPG mastery export text into normalized structured data
  - Lives mainly in [`src/lib/parseMasteryPaste.ts`](/C:/Users/liqui/Documents/farmrpg-tools/src/lib/parseMasteryPaste.ts) and [`src/lib/normalizeItemKey.ts`](/C:/Users/liqui/Documents/farmrpg-tools/src/lib/normalizeItemKey.ts)
- Storage layer
  - Saves and loads local mastery snapshots in IndexedDB
  - Lives in [`src/lib/storage/masterySnapshots.ts`](/C:/Users/liqui/Documents/farmrpg-tools/src/lib/storage/masterySnapshots.ts)
- Reference-data layer
  - Loads CSV-backed canonical reference data from `data/`
  - Lives in [`src/lib/loadMasteryDifficulty.ts`](/C:/Users/liqui/Documents/farmrpg-tools/src/lib/loadMasteryDifficulty.ts) and [`src/lib/loadTowerRequirements.ts`](/C:/Users/liqui/Documents/farmrpg-tools/src/lib/loadTowerRequirements.ts)
- Derivation layer
  - Computes view-friendly progress/status data from latest snapshot plus reference data
  - Lives in [`src/lib/deriveMasteryDifficultyStats.ts`](/C:/Users/liqui/Documents/farmrpg-tools/src/lib/deriveMasteryDifficultyStats.ts) and [`src/lib/deriveTowerRequirements.ts`](/C:/Users/liqui/Documents/farmrpg-tools/src/lib/deriveTowerRequirements.ts)
- Page/view layer
  - React pages load latest snapshot/reference data and render read-only or local-only flows
  - Lives in [`src/pages/ImportPage.tsx`](/C:/Users/liqui/Documents/farmrpg-tools/src/pages/ImportPage.tsx), [`src/pages/DashboardPage.tsx`](/C:/Users/liqui/Documents/farmrpg-tools/src/pages/DashboardPage.tsx), [`src/pages/SortedPage.tsx`](/C:/Users/liqui/Documents/farmrpg-tools/src/pages/SortedPage.tsx), and [`src/pages/TowerPage.tsx`](/C:/Users/liqui/Documents/farmrpg-tools/src/pages/TowerPage.tsx)

## Canonical Data And Source Of Truth

- Canonical reference inputs live in `data/`
- User mastery state comes from the latest locally saved snapshot
- Derived views are computed at runtime from snapshots plus reference data
- Planning files under `planning/` are not consumed by the app at runtime
- Exception: `planning/backlog.csv` may be read by a feature-scoped internal backlog/project-planning view, but that metadata remains non-authoritative presentation/support data rather than gameplay, player-state, or canonical reference truth

## Planning Data Boundary

- Default rule: planning files remain workflow artifacts, not normal runtime inputs
- Narrow exception: `planning/backlog.csv` may be consumed at runtime only for an internal local-only backlog/project-planning visualization feature
- Guardrails:
  - backlog-derived runtime use is opt-in and feature-scoped, not a general rule for all planning files
  - backlog metadata must not become a dependency for gameplay logic, mastery calculations, import behavior, or canonical reference-data flows
  - backlog display metadata is presentation/support data, not player-state or game-reference truth
  - display-oriented backlog fields such as `friendly_title`, `friendly_summary`, and `friendly_description` are optional and should safely fall back to the existing workflow fields when blank
  - malformed or unavailable backlog metadata should degrade safely and must not break the rest of the app
  - this exception does not introduce app-side editing of backlog data
  - this exception does not change the local-first, single-profile, or no-backend constraints

## Hosted Deployment Boundary

- The hosted shape is a static Vite SPA unless a backlog item explicitly changes the architecture
- Static reference files may be served from the deployment, but user snapshots, settings, and backup/restore remain browser-local
- Do not introduce serverless functions, Blob storage, auth, sync, or multi-device continuity as incidental fallout from hosted work
- Hosted work should call out local-data durability and backup/restore implications when they affect user testing or release confidence

## Identity Model

- Current canonical item identity is the normalized item name
- Normalization lives in [`src/lib/normalizeItemKey.ts`](/C:/Users/liqui/Documents/farmrpg-tools/src/lib/normalizeItemKey.ts)
- `farmrpg_item_id` is optional external metadata, not the canonical key
- `buddy_slug` is optional external metadata, not the canonical key
- Current joins depend on normalized item keys and should be treated carefully

## Main Runtime Flows

### Import Flow

- User pastes raw FarmRPG mastery export text into the Import page
- Parser extracts rows, canonical keys, counts, and tier info
- Import page shows validation/debug information
- Snapshot is saved locally if the user chooses to save

### Reference-Data Flow

- App fetches CSV files from `data/`
- Loader modules parse rows into typed entries plus keyed lookup structures
- Blank optional fields are tolerated where intended

### Derived-View Flow

- Latest snapshot is loaded from IndexedDB
- Reference data is loaded from CSV
- Derivation helpers join by canonical key and compute view-specific status
- Pages render read-only summaries, grouped lists, and warnings

## Reference Datasets

### `mastery_difficulty.csv`

- Canonical source for mastery difficulty metadata
- Used for dashboard summaries, GM-left/MM-left views, and unmatched-item reporting
- Missing matches become `Unrated`, not fatal errors

### `tower_requirements.csv`

- Canonical source for tower requirement rows
- `tower_level_range` is authoritative for tower range grouping
- Requirement tier comes from the CSV row, not inferred from tower level

## UI/View Architecture

Normal user-facing pages should explain player status, attention, and next useful action. Repo maintenance, reference-data upkeep, and debug details belong in explicit internal/dev tooling or secondary detail surfaces unless a warning must stay visible to preserve trust.

Prefer compact/collapsible guidance and clearer controls over long explanatory blocks.

### Import Page

- Local-only paste, parse preview, validation, and save flow
- Parser remains the source of truth
- Import warnings are inline and non-fatal
- Temporary parser debug visibility exists to help inspect parsed rows

### Tower Page

- Read-only latest-snapshot view over tower requirements
- Uses derived tower status rows without collapsing row identity
- Tower requirement rows stay independent even if the same item appears multiple times across levels
- Current hierarchy is:
  - top-level completed/incomplete range grouping
  - grouping by `tower_level_range`
  - level-level accordion
  - independent requirement rows

## Testing Approach

- Vitest covers parser, normalization, CSV loading, and derivation helpers
- Focused page tests cover meaningful UI behavior for Import and Tower flows
- ESLint and build checks are part of normal verification

## Known Tensions And Likely Evolution

- Normalized-name identity works today but is fragile across naming drift
- Reference CSV validation is still a follow-up area
- Tower detail presentation still mixes planning and debugging concerns
- Snapshot history/compare and richer planning flows are intentionally limited today

## High-Level File Map

- `src/lib/normalizeItemKey.ts`
- `src/lib/parseMasteryPaste.ts`
- `src/lib/storage/masterySnapshots.ts`
- `src/lib/loadMasteryDifficulty.ts`
- `src/lib/loadTowerRequirements.ts`
- `src/lib/deriveMasteryDifficultyStats.ts`
- `src/lib/deriveTowerRequirements.ts`
- `src/pages/ImportPage.tsx`
- `src/pages/DashboardPage.tsx`
- `src/pages/SortedPage.tsx`
- `src/pages/TowerPage.tsx`
- `data/mastery_difficulty.csv`
- `data/tower_requirements.csv`

## Change Guidance

Safe to change:

- Page presentation details
- Pure derivation helpers when behavior is clearly covered
- Loader/UI wording for non-fatal unmatched cases
- Tests and planning docs

Use extra caution:

- Normalization rules and canonical-key behavior
- Storage/import/export compatibility
- Anything that changes snapshot shape
- Anything that changes how reference CSV rows are interpreted
- Anything that modifies canonical files in `data/`
