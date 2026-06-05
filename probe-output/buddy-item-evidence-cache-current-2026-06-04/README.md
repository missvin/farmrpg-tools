# Current Buddy Item Evidence Cache

BL-249 current-universe cache artifact.

Source target set:
- `probe-output/current-museum-universe-2026-06-04/buddy_item_targets.csv`
- 1,461 reviewed current museum universe targets from the 2026-06-04 Library Everything export.

Current status:
- Full current-universe cache run completed on 2026-06-04.
- 1,461 cumulative page-data evidence records are present under `pages/`.
- Latest manifest run: 1,456 fresh rows skipped and 5 terminal rows skipped; no deferred targets remain.
- 273 rows currently require review before parser promotion: 268 `sources_blank` rows and 5 terminal `uncertain` rows.
- Terminal rows are explicit evidence artifacts for Buddy page-data failures: `Pot of Gold (Medium)`, `Pot of Gold (Large)`, `Pot of Gold (Small)`, `Green Shield`, and `R.O.A.S.`.

Important:
- This is the completed BL-249 current-universe evidence corpus for parser and promotion work.
- The manifest and review CSVs are regenerated per resume run, and skipped rows preserve existing source-status/review information so review candidates remain visible.
- Any rechecks should stay bounded, sequential, delayed, and cache-first.
- Parser and promotion work may consume this artifact, but review rows must remain visible and handled before canonical promotion.

Parsed multi-source artifacts:
- `parsed-multi-source/buddy_item_multi_source_facts.json` preserves the BL-245 versioned intermediate model for 1,461 cached pages.
- `parsed-multi-source/buddy_item_multi_source_summary.csv` summarizes parsed fact counts per item.
- `parsed-multi-source/buddy_item_multi_source_review.csv` contains the 5 terminal pages that still need review.
- `parsed-multi-source/fanout/` contains BL-246 review-only candidate CSVs for item catalog, icon observations, recipes, recipe inputs, used-in rows, drop rates, pet sources, openables, Wishing Well rows, and source hints.
- Candidate CSVs are not canonical `data/` files. Direct openable and Wishing Well rows are kept separate from reverse source hints to avoid accidental double promotion.
