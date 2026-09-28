# September 25 quest refresh (BL-341)

User-authorized quest reference promotion from a completed-requests paste and bounded Buddy review. No commit or deployment was requested.

## Result

- Added 103 quests: 66 supported by visible Buddy pages (including The Great Migration II–IV), and 37 explicit partial placeholders.
- The placeholders cover 33 recent completed September quests, Curious Postal Note I–III, and the observed active Pie Inversion Experimentation III. Buddy search returned no matching entries. Requirements, rewards, Tower gates, availability, and questline membership remain unknown; these are not zero-cost quests.
- Added 178 item requirements and 235 item rewards. Non-item rewards remain in quest notes because the runtime schema supports item rows only.
- Corrected literal `<br>` markup in three existing frog-language quest titles and their requirement/reward/link keys, without creating duplicate quests.
- Refreshed the eight previously catalogued Pumpkin Juice candidates with visible Tower gates and availability. Newly discovered The Great Migration IV also rewards one Pumpkin Juice and requires Tower 320.
- All 2,403 completion records match catalog entries. The raw game timestamps retain their unspecified timezone; population counts are observations from the user's September 25 paste, not counts at the time each quest was completed.

## Evidence and boundaries

`buddy-discovery.json` records bounded searches for the supplied missing quest families. `buddy-pages.json` preserves visible public quest text and links, collected sequentially with three-second delays. `buddy-questlines.json` verifies available questline labels. `pumpkin-juice-pages.json` preserves the eight existing candidate pages. `quest-review.csv` identifies all additions and their coverage status.

Direct HTTP access returned 403; browser-rendered pages worked. No access controls were bypassed. Search results and explicit Previous/Next links supplied the discovery boundary. Known catalogued endpoints were not recursively re-crawled. This is not a claim that every quest on Buddy was refreshed. Sparse placeholders may contain undiscovered Pumpkin Juice rewards.

Seasonal dates are historical windows displayed on Buddy. Projected months in the personal report are expectations if the quests return, not announced future schedules. The 750,000 Farmers milestone has no established recurrence.

Personal files are saved under ignored `local-data/quests-2026-09-25/`: the original paste, corrected structured snapshot, completion CSV, rarest-quest CSV, missed-PJ CSV, and report. They are not installed into any browser's IndexedDB. Use the original completed-requests text with the updated tool's existing Quest History import to load that browser's profile.

## Parser recovery and verification

Initial parsing reported 2,400 records and 126 unmatched names. Audit against the 2,403 source timestamps found wrapped titles were truncated and three records with blank NPCs were skipped. Canonical promotion was paused until the parser recovered all records with no warnings. The revised true unmatched count was 102, including three existing markup-based identities corrected in place. The remaining additions include three linked stages and one observed active quest.

The importer now preserves wrapped titles and accepts unnamed NPCs. Regression tests cover both defects. Five focused test files (12 tests), ESLint, production build, CSV identity/reference validation, complete snapshot-to-catalog matching, and an idempotent promotion rerun passed.

`reconcile.py` is an offline replay of the reviewed evidence. Run it from the repository root with Python 3 and the ignored personal snapshot present. It performs no network access. Public CSVs and the review artifact remain unchanged on a second run.
