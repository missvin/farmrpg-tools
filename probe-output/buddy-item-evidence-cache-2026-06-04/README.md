# Buddy Item Evidence Cache - 2026-06-04

This is the first reviewed Buddy item-page evidence cache artifact for `BL-247`.

## Run Scope

- Target file: `probe-output/buddy-item-evidence-cache-2026-06-04/buddy_item_evidence_targets.csv`
- Target count: 10
- Request policy: manual run, dry-run first, sequential requests, 5 second delay, limit 10
- Buddy endpoint shape: `https://buddy.farm/page-data/i/<slug>/page-data.json`
- FarmRPG asset fetching: none
- Canonical `data/` writes: none

## Targets

- Salt
- Frost Snapper Shell
- Spiked Shell
- Large Net
- Fishing Net
- Antler
- Apple Cider
- Corn Prize Bag
- Large Chest 03
- Orange Gecko

## Review Result

- Cached results: 10
- HTTP errors: 0
- Fetch errors: 0
- Rows needing generated review: 0
- Source-status summary: all 10 rows reported `sources_present`

The artifact is accepted as the initial local evidence set for downstream parser and promotion work.

## Output Files

- `buddy_item_evidence_manifest.json`
- `buddy_item_evidence_manifest.csv`
- `buddy_item_evidence_review.csv`
- `pages/*.json`

## Follow-Up

- `BL-245` should parse these cached page-data files into reviewable source facts.
- `BL-244` should add a queue for future sparse or stale evidence rows. This initial batch did not produce sparse rows.
