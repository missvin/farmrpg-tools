# BL-374 manual Firefox capture acceptance — 2026-10-14

Status: **shipped; manual capture acceptance complete**. Parent BL-367 remains incomplete until BL-375–BL-377 pass. Rebecca verified live inventory and mastery capture/application, visible consistency and reload persistence in her normal Firefox profile. The isolated runtime check verified recovery against the real deployed tracker with synthetic data. No passive capture, signed release or multiple-tracker-tab support is included. Next: BL-375.

## Acceptance evidence

| Check | Evidence |
| --- | --- |
| Temporary Firefox install and real page extraction | Rebecca installed the test package and captured 607 mastery rows and 1,357 owned-inventory rows; supplied centered-page, seven-section mastery and My Inventory DOM evidence. |
| Durable real player application | Mastery screenshot showed the matching history snapshot and receipt; Rebecca confirmed reload persistence. Inventory followed manual ordering recovery; Rebecca reported it looked good and stayed consistent after reload. |
| Capture/paste parity and completeness | Focused fixtures based on supplied layout match shared paste results; all seven mastery sections and independent Inventory Stats totals are required. Unknown items remain warnings. |
| Folded/unloaded/empty sections, retained stale pages and depletion | Regression fixtures include materialized folded mastery, explicit loaded-empty evidence, missing rows/tiers, duplicate active pages, stale routes, zero and shrinking inventory. Failed reads retain good data; full replacement preserves separate supplies. These edge cases are automated evidence, not claims of additional user testing. |
| Tracker closed, manual retry, duplicate acknowledgment | Fresh isolated Firefox profile with the actual extension and deployed receiver: cached synthetic inventory waits while closed, applies on opening, survives reload, and retries as duplicate without changing last application time. |
| Disconnect and re-pair | Isolated tracker pairing removal prevents a new application confirmation; new-key pairing delivers the cached capture as duplicate. Extension disconnect/cache preservation also has a focused regression test. |
| Sender authority, origin and durable acknowledgment | Actual Firefox own-window exact-origin relay verified; focused authority/application tests reject foreign senders, frames, revoked authorization and failed writes. |
| Attribution, permissions and consent | Existing ATTRIBUTION.md and minimal-host/websiteContent/browsingActivity declarations retained. Signed distribution and consent review remain BL-377. |

Completion validation: **135 focused tests** across extension, bridge, shared application/imports, pairing control and inventory paste passed; extension lint passed. The unsigned package was rebuilt and the expanded isolated Firefox harness passed. No product code changed in this acceptance pass, so the app build was not repeated; the preceding parser/capture fixes had passing production builds. The harness never requests game pages or accesses Rebecca's normal profile.

## Implemented

`extensions/firefox-companion/` contains a Firefox MV3 event-page test package with stable add-on ID, exact game/tracker hosts, local pairing/cache, manual active-tab capture, bounded stable-page extraction, HMAC delivery and matching durable-acknowledgment status. It reuses the hash-pinned upstream quantity/mastery parsing and scoped extraction approach; attribution and permission basis are in `ATTRIBUTION.md`. Raw page text is neither stored nor sent. No canonical data edits, backend, game navigation/requests, passive observation, downloaded backups or whole-account merge.

The extractor requires independent inventory totals, all loaded mastery sections (explicit loaded-empty evidence), exact quantities, matching heading/target/progress counts and mastery summary totals. Folded materialized DOM is distinct from absent content. Unknown layouts reject visibly. Fixtures now incorporate Rebecca's current-page structural evidence; real normal-page acceptance is recorded above. Do not infer completeness from quiet DOM, row-count shrink thresholds or parser success alone.

Commands are accepted only from the extension's own top-level popup document (toolbar popup or a standalone extension tab). Game reads are responses to direct frame-0 requests to the selected allowed tab, not unsolicited game-page messages. The background signs; the pairing key never reaches game scripts or tracker page relays. Both game and tracker scripts authenticate the own event-page runtime sender. Tracker relay retains exact origin/window/frame/protocol/request/receipt checks.

Consent is conservatively declared as websiteContent and browsingActivity for counts plus sanitized page identity transferred out of the add-on into the tracker page. This does not add telemetry, backend or network upload. The Mozilla taxonomy/permission basis and minimal API permissions are documented in the package README. Recheck declarations/redistribution terms in BL-377 before signing.

## Initial validation — 2026-10-10

- **58 tests passed**: 34 extension fixtures/parity/authority/cache/relay tests plus the 24 existing tracker bridge tests.
- Extension-specific JavaScript lint and repository lint passed. Tracker production build passed (existing large-bundle warning). The extension is a standalone classic-script package; its unsigned packaging and actual runtime check validate what the tracker build does not bundle.
- Actual Firefox **157.0.1**, isolated fresh headless profile: temporary unsigned XPI installation, active extension policy, own-popup/event-page messaging, exact production-origin content-script/page-world transport and a bound synthetic acknowledgment all passed. The received page message had `event.source === window` and the exact tracker origin; no relaxation was needed.
- The runtime harness uses synthetic Steel data and a synthetic page acknowledgment in a separate profile, not the user's account or a real tracker application. It does **not** establish live game extraction or durable end-to-end user-data persistence. No game page was requested by the harness. The isolated browser was closed after testing.
- Allowlisted package output excludes tests, browser profiles, upstream ZIP and local pairing authority.

Reproduce with `powershell -NoProfile -ExecutionPolicy Bypass -File extensions/firefox-companion/verify-firefox-runtime.ps1`. This opens the public tracker only in a fresh headless test profile; it does not use Rebecca's normal Firefox profile. The script preserves ignored profile files under local-data for diagnostics.

## Historical implementation checkpoints

2026-10-14 owned-inventory correction: Everything is the catalogue, not on-hand stock. Rebecca supplied My Inventory route #!/inventory.php, data-page=inventory, 1,356 materialized rows, Inventory Stats labels and sanitized first/last row markup. Corrected extraction and both bridge coverage definitions to Inventory; exact counts must match independent unique-positive-item and summed-quantity totals. Catalogue/filtered routes and incomplete reads reject. Existing full-replacement services handle depletion and preserve separate supplies. The obsolete Everything-labelled cache rejects and must be recaptured. Mastery capture of 607 rows was acknowledged at 08:05:48 local time and Rebecca confirmed its comparison snapshot survives reload. Validation: 151 focused extension/bridge/import/application/backup tests passed after correcting the new preservation test setup; repository/extension lint and production build passed (existing bundle-size warning), and the unsigned test package was rebuilt. Inventory live application, parity and remaining acceptance checks are still pending; BL-374 remains in progress.

2026-10-14: User-supplied heading/target totals confirm seven sections: Tier V→1,000,000, IV→100,000, III→10,000, II→1,000, I→100, No Tier→10, Mega Mastered→infinity. The original synthetic fixture incorrectly assigned Tier I→10 and omitted No Tier, affecting extraction, extension validation, tracker coverage and target validation. Corrected all four boundaries together; seven-section fixtures cover paste parity, tracker preparation, missing sections and wrong heading/target relationships. Existing six-section queued captures now reject without replacing good data and need recapture. No persisted storage/backup format changes. Receiver deployment and full live acceptance remain pending.

2026-10-14: Rebecca supplied layout-only console evidence showing retained `.page`, `.page.page-on-left` and active `.page.page-on-center` siblings under `.pages`, with no `.page-current`. Added the centered marker to active-page selection, retaining the single-page, inactive/hidden, transition and settling checks. Regression fixtures cover that observed structure for inventory/mastery plus ambiguous, hidden and transitioning pages. This confirms the selector mismatch only; real-page extraction/completeness and durable application remain pending.

2026-10-14: Rebecca's temporary install exposed Firefox's MV3 warning for the unsupported `background.persistent` property. Removed that property and updated the manifest regression check; MV3 supplies nonpersistent background behavior implicitly. Reload the temporary add-on to check the warning is gone. Real-page capture and durable application acceptance remain pending; BL-374 is still in progress.

Rebecca agreed to temporary-install testing. Start with `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → package `manifest.json`. Verify popup opens. Full instructions and failure checks are in `extensions/firefox-companion/README.md`.

Before live application, verify that the deployed tracker includes BL-373 and its pairing controls are visible. Back up that Firefox profile's tracker state. Test actual My Inventory/Mastery capture against ordinary paste imports, loaded folded/empty/unloaded sections, genuine depletion, stale retained pages, changed tabs, rejection/duplicate status, and open-view refresh. Retain any safe structural layout evidence needed to adapt selectors rather than weakening completeness checks. Until these gates pass, BL-374 remains in progress and BL-375 remains blocked. Signing/unlisted normal-install acceptance is BL-377.

Initial integration verification (2026-10-10): 162 combined capture/Tower/backup/shell/page tests, repository and extension lint, and production build passed on the combined tree. Six safe-worktree helper tests also passed. Original task branches are retained. At that initial checkpoint, hosted deployment and actual user-game acceptance were unverified; the current acceptance matrix above supersedes that limitation.
