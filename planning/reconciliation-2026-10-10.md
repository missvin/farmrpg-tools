# Full planning reconciliation — 2026-10-10

## Scope reviewed

Reviewed all 368 pre-existing backlog rows for schema/identity, parent relationships, dependency validity/cycles and status consistency; all 26 open rows, parent/child status summaries, recent shipped titles and targeted historical notes. Compared the complete roadmap with those records and inspected AGENTS, planning README, architecture, decisions, releases, compact item-page contract, capture review and failure-recovery protocol.

This is a full **planning consistency** review. It does not re-run product acceptance, inspect canonical data/generated caches, verify source coverage, install Firefox extensions or confirm hosted deployments. Shipped implementation evidence is taken from recorded backlog/spec notes and the two already-landed capture commits.

## Capture work split

BL-366 was underestimated as medium effort despite spanning validation, state application, concurrency, provenance, backups, browser messaging and UI refresh. BL-366 through BL-369 now explicitly act as large completion umbrellas; child rows are the units for next-slice implementation. Existing umbrella IDs/status history is preserved.

| Child | Outcome | Status | Direct prerequisites |
| --- | --- | --- | --- |
| BL-370 | Shared import services and structured validation | shipped | BL-365, BL-087, BL-007 |
| BL-371 | Durable observation provenance and backups | shipped | BL-370, BL-079 |
| BL-372 | Serialized capture application and mastery history | inbox | BL-371 |
| BL-373 | Authenticated tracker bridge and acknowledgments | inbox | BL-372 |
| BL-374 | Firefox port and manual full-page capture | inbox | BL-373, BL-365 |
| BL-375 | Passive stable-page observation and coordination | inbox | BL-374 |
| BL-376 | Reconnect recovery and visible freshness | inbox | BL-375 |
| BL-377 | Signed unlisted Firefox package acceptance | inbox | BL-376 |
| BL-378 | Partial item-observation model/application | inbox | BL-377 |
| BL-379 | Personal item-page extraction and Firefox verification | inbox | BL-378 |
| BL-380 | Raw global mastery statistics/history | inbox | BL-379 |
| BL-381 | Global mastery difficulty evidence integration | inbox | BL-380, BL-382 |
| BL-382 | Rating range, zero-score and source-date policy decision | inbox | BL-146, BL-149 |

BL-370 records d9c63e6 and its 50-test checkpoint; BL-371 records c863a79 and its 87-test checkpoint. These were already landed, not implemented again during reconciliation. BL-372 is the next capture slice. Each future row includes bounded acceptance and exclusions in the CSV.

BL-367 has four children rather than combining signed-package acceptance with reconnect code. This makes the manual testing/distribution gate visible. BL-369 no longer requires the entire BL-145 umbrella: raw statistics can proceed independently, while BL-381 and the existing BL-150 selector require the explicit BL-382 decision. That review still requires confirmed policy and reviewed source data; this pass supplies no answers or canonical rating changes.

## Findings and changes

- **Stale completion umbrellas:** BL-015 still called BL-189 remaining work even though it shipped. BL-186 had all five children shipped but stayed open for vague naming/canon maturation despite BL-191 and BL-189 delivering the defined workflow. Closed both bounded umbrellas; future evidence-gated canon refreshes remain with BL-215/BL-316. Updated BL-190's obsolete claim that canon was still planned.
- **Historical dependency cycle:** BL-046 depended on the BL-102 observed-icon artifact, while BL-102 also depended on the BL-046 downloader. BL-102's notes describe extracting observations from BL-045 output; removed its BL-046 prerequisite. Shipped statuses remain unchanged. The dependency graph is now acyclic.
- **Umbrella context mistaken for prerequisites:** removed BL-215 completion edges from shipped BL-222, BL-236, BL-238, BL-243, BL-245, BL-246, BL-247, BL-248, BL-251, BL-255, BL-274, BL-292, BL-305, BL-316, BL-317, BL-318, BL-325, BL-329, BL-330, BL-335 and BL-337. Removed analogous grouping edges BL-125/BL-153 → BL-015, BL-146 → BL-145 and BL-298 → BL-297. Concrete prerequisites, ownership and historical review requirements are retained; notes explain the corrections. This does not remove required data review from implementation.
- **Ongoing versus bounded work:** BL-215 intentionally remains in progress as recurring promotion/review ownership despite its 25 current children being shipped. BL-145 remains open for reviewed rating data, explicit policy and the selector. Neither is marked complete merely to make dependency checks pass.
- **Roadmap drift:** corrected BL-235's stale in-progress label; added recorded Museum, game-area, compact Tower and compact item-page outcomes; added the current Firefox companion milestones with clear landed-foundation versus usable-extension distinctions and rating gate.
- **Documentation conflict:** planning README incorrectly said to remove shipped backlog work. It now requires retained history and distinguishes parent grouping from hard prerequisites. Documented stable ID/order conventions and completed bounded BL-025 maintenance; no historical bulk reorder or schema change. BL-026 remains open for actual shipped-version metadata.
- **Architecture drift:** distinguished the original Tower hierarchy from the newer remaining-items workflow, recorded landed shared-import/provenance boundaries, and replaced stale claims that snapshot/planning flows remain only limited foundations. Decisions' introductory paragraph was restored to its proper location without changing accepted policies.

## Deliberately unchanged

- Shipped parents BL-021, BL-029, BL-137, BL-151, BL-153 and BL-168 have optional open/iceboxed follow-ons. These do not invalidate their bounded shipped capability; parents were not reopened simply because an enhancement is attached.
- All 11 icebox rows remain deferred, including the trade-price workstream. Its shipped parser BL-298 stays shipped.
- BL-141 method filters remain evidence-gated; BL-268 optimization still requires measurement before implementation; BL-327 mobile import guidance remains unshipped and must verify parser-specific promises.
- Version labels and historical release notes were not invented or regenerated. BL-026 retains the missing shipped-version tracking work; the existing releases document remains the policy.
- No mastery eligibility, unknown-item classifications, formula range decisions, game-event assumptions, canonical data, product code or storage state changed. Compact item-page shipped evidence was not re-verified in a browser, and earlier user usability concerns are not resolved merely by this planning pass.

## Remaining risks and next work

The companion is not usable yet: BL-372/BL-373 application/bridge work and BL-374 through BL-377 runtime/distribution acceptance remain. Confirm the exact tracker origin before enabling transfers. Real Firefox checks and signed-package tests remain explicit gates. No user data is needed to begin BL-372; BL-382 may require user decisions when that review runs.

Other open work is deliberately visible rather than folded into this capture path. Planning statuses are recorded evidence, not fresh code/data/deployment proof. Future slices must recheck their prerequisites and update the same child before landing.

## Verification

- Final CSV: **381 rows**, unchanged **19-column schema**, unique IDs and valid parent/dependency references.
- **No dependency or parent cycles; no shipped rows requiring unfinished rows.**
- Existing IDs and relative row order preserved; 13 new rows inserted near related parents. New titles are distinct.
- Final status totals: **347 shipped, 4 in progress, 19 inbox, 11 icebox**.
- `git diff --check` and targeted planning-document inspection. App tests/lint/build skipped because only planning files changed; prior implementation test counts above are historical evidence.

No field note added; this was routine planning cleanup.
