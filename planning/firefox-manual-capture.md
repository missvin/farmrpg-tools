# BL-374 manual Firefox capture checkpoint — 2026-10-10

Status: **in progress, branch-only**. Parent BL-367 is not complete. BL-373 code is available in this branch ancestry; master integration and hosted receiver deployment remain unverified. Rebecca requested isolated work while another chat changes master, so commit/push this task branch and defer merging. No BL-375 work is included.

## Implemented

`extensions/firefox-companion/` contains a Firefox MV3 event-page test package with stable add-on ID, exact game/tracker hosts, local pairing/cache, manual active-tab capture, bounded stable-page extraction, HMAC delivery and matching durable-acknowledgment status. It reuses the hash-pinned upstream quantity/mastery parsing and scoped extraction approach; attribution and permission basis are in `ATTRIBUTION.md`. Raw page text is neither stored nor sent. No canonical data edits, backend, game navigation/requests, passive observation, downloaded backups or whole-account merge.

The extractor requires independent inventory totals, all loaded mastery sections (explicit loaded-empty evidence), exact quantities, matching heading/target/progress counts and mastery summary totals. Folded materialized DOM is distinct from absent content. Unknown layouts reject visibly. The fixtures are synthetic; current-game layout acceptance is explicitly pending. Do not infer completeness from quiet DOM, row-count shrink thresholds or parser success alone.

Commands are accepted only from the extension's own top-level popup document (toolbar popup or a standalone extension tab). Game reads are responses to direct frame-0 requests to the selected allowed tab, not unsolicited game-page messages. The background signs; the pairing key never reaches game scripts or tracker page relays. Both game and tracker scripts authenticate the own event-page runtime sender. Tracker relay retains exact origin/window/frame/protocol/request/receipt checks.

Consent is conservatively declared as websiteContent and browsingActivity for counts plus sanitized page identity transferred out of the add-on into the tracker page. This does not add telemetry, backend or network upload. The Mozilla taxonomy/permission basis and minimal API permissions are documented in the package README. Recheck declarations/redistribution terms in BL-377 before signing.

## Verified

- **58 tests passed**: 34 extension fixtures/parity/authority/cache/relay tests plus the 24 existing tracker bridge tests.
- Extension-specific JavaScript lint and repository lint passed. Tracker production build passed (existing large-bundle warning). The extension is a standalone classic-script package; its unsigned packaging and actual runtime check validate what the tracker build does not bundle.
- Actual Firefox **157.0.1**, isolated fresh headless profile: temporary unsigned XPI installation, active extension policy, own-popup/event-page messaging, exact production-origin content-script/page-world transport and a bound synthetic acknowledgment all passed. The received page message had `event.source === window` and the exact tracker origin; no relaxation was needed.
- The runtime harness uses synthetic Steel data and a synthetic page acknowledgment in a separate profile, not the user's account or a real tracker application. It does **not** establish live game extraction or durable end-to-end user-data persistence. No game page was requested by the harness. The isolated browser was closed after testing.
- Allowlisted package output excludes tests, browser profiles, upstream ZIP and local pairing authority.

Reproduce with `powershell -NoProfile -ExecutionPolicy Bypass -File extensions/firefox-companion/verify-firefox-runtime.ps1`. This opens the public tracker only in a fresh headless test profile; it does not use Rebecca's normal Firefox profile. The script preserves ignored profile files under local-data for diagnostics.

## Remaining acceptance

Rebecca agreed to temporary-install testing. Start with `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → package `manifest.json`. Verify popup opens. Full instructions and failure checks are in `extensions/firefox-companion/README.md`.

Before live application, BL-373 must be integrated/deployed and its pairing controls visible on the production tracker. Back up that Firefox profile's tracker state. Test actual Everything/Mastery capture against ordinary paste imports, loaded folded/empty/unloaded sections, genuine depletion, stale retained pages, changed tabs, rejection/duplicate status, and open-view refresh. Retain any safe structural layout evidence needed to adapt selectors rather than weakening completeness checks. Until these gates pass, BL-374 remains in progress and BL-375 remains blocked. Signing/unlisted normal-install acceptance is BL-377.
