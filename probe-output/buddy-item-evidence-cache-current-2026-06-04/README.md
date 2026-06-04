# Current Buddy Item Evidence Cache

BL-249 current-universe cache artifact.

Source target set:
- `probe-output/current-museum-universe-2026-06-04/buddy_item_targets.csv`
- 1,461 reviewed current museum universe targets from the 2026-06-04 Library Everything export.

Current status:
- Two bounded cache batches run on 2026-06-04.
- 50 cumulative page-data records cached under `pages/`.
- Latest manifest run: 25 fresh rows skipped, 25 new rows cached, 1,411 targets deferred.
- 8 rows currently require review before parser promotion because Buddy page-data had blank source sections.

Important:
- This is a partial current-universe artifact, not the completed BL-249 corpus.
- Re-run `scripts/cacheBuddyItemPageEvidence.mjs` with the same target CSV and output directory to continue from the next uncached targets.
- The manifest and review CSVs are regenerated per resume run, but skipped fresh rows preserve existing source-status/review information so current review candidates remain visible.
- Keep runs bounded, sequential, delayed, and cache-first.
- Do not use this partial artifact as the sufficient dependency for BL-245, BL-246, BL-242, BL-250, or BL-251.
