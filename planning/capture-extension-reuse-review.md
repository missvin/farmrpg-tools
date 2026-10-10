# Capture companion reuse review — BL-365

Reviewed 2026-10-09. This completes the source/Firefox review, not an installable companion. No upstream code was executed, installed, or vendored; no saved player data was changed.

## Decisions and provenance

- Rebecca confirms permission to reuse the existing extension. Proceed on that permission basis; the downloaded package contains no LICENSE file, so this review does not assert an open-source license or invent redistribution terms. Preserve upstream attribution when adapting code and document the supplied permission before external distribution.
- Firefox is required. Distribution will be Mozilla-signed **unlisted**, rather than a public add-on listing. Unlisted distribution still requires signing and applicable Mozilla review.
- Capture is passive observation of pages the player visits. No game actions, automatic navigation, extra game requests, credentials, backend, or cloud sync. Transfer to the authorized tracker is local browser communication, not a server upload.
- Fail visibly and retain good data. A queued read, locally stored capture, and successful application to the tracker are separate states.

Upstream: [Farm RPG Calculator Account Sync ZIP](https://alikdash1.github.io/Farmrpgcalculator/downloads/farm-rpg-account-sync.zip), manifest version **1.13.1**, 14 file entries. SHA-256:

`AC28C4C34CECD68EE93301DD81386C92D659CF34308F38D439F5377EA2A96389`

The source was inspected as text from a temporary ZIP. Future adaptation must use this pinned artifact, or explicitly review and record a newer hash/version before relying on its behavior. The README advertises passive capture; the shipped `farm-content.js` explicitly disables automatic capture following partial-page inventory overwrites. Passive capture must therefore be implemented and verified, not claimed as inherited.

## Reuse map

Line references identify the reviewed ZIP, not repository source files.

| Upstream component | Reuse | Required adaptation / evidence |
| --- | --- | --- |
| `capture-page.js` | Existing inventory/mastery layout parsing and scoped extraction | Restrict extraction to the current active game page. `masteryPageText()` around 499 selects the page with the most Progress occurrences, which can select a retained stale Framework7 page. Preserve folded tier support without treating unloaded content as complete. Remove whole-body fallback and unrelated text from the transmitted envelope. |
| `capture-page.js:1620–1648,1799–1814` | Envelope assembly structure | Fixed initialized field keys make `Object.keys(fields).length` positive even without useful extraction. Existing `parserStatus: parsed` is not a success gate. Validate observed rows, section identity, completeness evidence and quantities explicitly. Do not ingest item art as canonical reference data. |
| `farm-content.js` | Manual capture control, busy guard, watchdog and retry structure | Replace disabled automatic capture with bounded observation of stable current-page changes. Debounce and deduplicate; never initiate game navigation or requests. Keep manual retry and pause available. A route change alone does not prove a page has finished loading. |
| `background.js:1` | Local storage/cache and message orchestration | `importScripts(...)` and the service-worker manifest are not a direct Firefox event-page port. Load shared scripts in manifest order or bundle for an event page. Register listeners at top level; persist durable state rather than relying on globals. Serialize capture read/modify/write operations to avoid parallel-tab lost updates. |
| `background.js:88–118` | Last-good-data protection intent | Current zero-count / less-than-quarter row-count guards are heuristics, not completeness proof. They can accept partial pages and reject genuine inventory shrinkage. Use section/scope evidence and distinguish full replacement from partial observations. |
| `background.js:195` | Runtime message routing | The handler receives but does not use `sender`. Validate extension sender, FarmRPG URL and frame authority for capture messages; do not grant every message the same authority. Retain bounded payload checks. |
| `shared/schema.js` | Type, timestamp and size validation | Extend the schema with version, capture ID, section, full/partial scope, observation time and completeness evidence. Unknown/empty sections currently may warn yet return success. Required capture failures must block application. Preserve all validation diagnostics. |
| `shared/numbers.js`, `shared/sanitize.js` | Bounded numeric parsing and sanitization where compatible | Compare with existing parser fixtures. App normalization and reviewed aliases remain authoritative. Never include tokens, passwords, chat or unrelated account text. |
| `shared/merge.js` | Timestamp/provenance and null-protection concepts | Do not adopt its whole-account model as the tracker model. Use existing app state/application helpers. Distinguish observed zero from unobserved, full-scope removal from partial upsert, and reject older or duplicate observations. Normalized item name stays canonical. |
| `calculator-bridge.js` | Storage-change publication and reconnect handshake | Replace wildcard `postMessage` target and broad localhost/file matches with explicit tracker origins, source checks, protocol version and application acknowledgments. Publish only relevant validated sections. No arbitrary file-page access. |
| `popup.js`, popup/panel styles | Status display, manual retry and open-tracker affordances | The capture command acknowledges queuing before persistence/application. Report these separately. Move the storage-change subscription out of the Clear handler. Display last successful observation/application and current failure. Do not imply that opening the tracker means data was applied. |
| `manifest.json` | Minimal host-scoped content-script arrangement | Firefox-specific background/ID/consent adaptation, restricted bridge scope and least necessary permissions. Omit optional automatic downloaded-backup machinery from the first version; retain existing tracker backups. |

Do not copy upstream pets, quests, craftworks, friendships, capacity assumptions or item-art promotion into the first inventory/mastery slice. The existing mining-history companion (BL-338) is additional prior art for Firefox stability and deduplication, not a replacement for this extension or a mandatory dependency.

## Firefox and distribution gates

The reviewed manifest is MV3 with `background.service_worker`, permissions `storage`, `tabs`, `downloads`, broad localhost hosts and a bridge matching `file:///*`. It has no Gecko add-on ID or data-collection declaration.

1. Use Firefox-supported `background.scripts` for the nonpersistent background page; load shared dependencies before `background.js` and remove its worker-only import path. Test restart/reload recovery and listener registration. [Mozilla background manifest reference](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background).
2. Set a stable `browser_specific_settings.gecko.id` for signed MV3 submissions. [Mozilla add-on IDs](https://extensionworkshop.com/documentation/develop/extensions-and-the-add-on-id/).
3. Supply Mozilla's required data-collection permission declaration for new extensions. Review the actual browser-to-tracker transfer against Mozilla's definitions before selecting values; do not assume `none` merely because there is no backend. [Firefox built-in data consent](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/).
4. Restrict game observation to the FarmRPG origins needed by the supported pages. Configure the verified tracker origin explicitly; it has not been established by this review. A development localhost origin must include an exact runtime port check, not blanket localhost access. Validate both sides of the bridge, including event source/origin and message shape. Test Firefox content-script/page-world messaging instead of assuming Chromium behavior.
5. Test with a [temporary Firefox installation](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/), then test the actual signed unlisted package in normal Firefox. Temporary installations disappear after restart and do not verify distribution. [Signing and distribution](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/).

No Firefox runtime, signing or distribution check has run in BL-365. The implementation slices must preserve this distinction in their readouts.

## Failure and data application contract

- **Reading:** no success claim yet. A watchdog timeout exposes a retryable error.
- **Captured locally:** validated data is cached in extension storage, with section, observed time and capture ID. If the tracker is closed, explicitly say it is waiting for the tracker.
- **Applied to tracker:** show only after the tracker acknowledges successful persistence/application for that capture ID. A rejection displays its reason and the last good application time.
- **Incomplete or malformed:** retain previous good capture and tracker data. Show which section failed and why; never replace inventory/mastery with a warning-only empty payload. Unsupported pages do not clear anything.
- **Older or duplicate:** ignore without regression; an acknowledgment explains that nothing changed. Different tabs cannot race to overwrite a newer section or lose an unrelated section.
- **Warnings with usable partial evidence:** unknown items remain non-fatal evidence; missing identity, invalid quantities or unproven full-page completeness block full replacement. Personal item-page observations remain a later explicitly partial path.
- **Observed zero:** clear an item only when the observation/scope establishes zero or absence in a validated full replacement. A missing row on a partial page means unknown. Do not silently inherit zero-removal behavior from current quantity helpers.
- **Paused:** clearly show capture is paused; retain cache and last-good timestamps. No hidden automatic activity.

Keep capture errors compact and visible in the extension; provide detail on demand. Do not require the player to open developer tools to discover stale or rejected data. Preserve manual imports, goals, planner assumptions, storehouse/pet supplies and history. Live observation cadence is separate from the cadence for storing historical snapshots.

## Implementation handoff

**Next: BL-366.** Extract shared application services from the existing manual import flows before connecting an extension receiver. Reuse `parseMasteryPaste.ts`, `parseCurrentInventoryPaste.ts`, inventory replacement/upsert helpers and mastery snapshot storage. Structured capture gets a structured adapter; do not generate synthetic paste text or restore a whole-app backup to ingest a capture.

Relevant repository seams:

- `src/pages/ImportPage.tsx`: current page-local mastery completeness warnings and manual acknowledgment.
- `src/components/InventoryImportPanels.tsx`: parser → inventory application → saved planner state → UI notification and unknown-item evidence.
- `src/lib/acquisitionPlannerState.ts`: current inventory upsert/replacement and normalization; zero rows currently disappear.
- `src/lib/storage/masterySnapshots.ts`: full snapshot storage, not a destination for unlabelled partial captures.

Design metadata and backup compatibility in BL-366. Retain all existing manual input paths. Test equivalent manual/structured observations against the same application behavior. A tracker bridge receiver must not make the static tracker fetch authenticated game pages.

**Then: BL-367.** Adapt the pinned upstream parser/content/background/popup/bridge code according to this map, add passive stable-page capture, and run Firefox tests. BL-368 adds personal item-page observations; BL-369 adds separate global mastery statistics/difficulty evidence. Neither belongs in the first full-inventory/mastery runtime.

## Acceptance test matrix for implementation

All runtime checks below are **pending**, not results from this review. Save representative redacted fixtures with expected observations and rejection reasons before relying on parser changes.

| Scenario | Required result | Verification |
| --- | --- | --- |
| Full inventory and full mastery across supported layouts | Correct names/counts/tiers; parity with matching manual import | Parser fixtures and Firefox page visits |
| Folded mastery versus unloaded tiers | Loaded folded rows included; missing sections rejected as incomplete | Fixtures and real Firefox DOM |
| Retained stale Framework7 page / route transition | Only stable current page observed | Fixtures and Firefox navigation |
| Empty initialized fields, malformed counts, schema mismatch, oversized payload | Visible rejection; last good data retained | Schema/application tests and popup test |
| Genuine inventory shrinkage, explicit zero, missing partial row | Correct full replacement or partial behavior; no row-count heuristic overwrite | Application fixtures |
| Unknown item / absent reference match | Non-fatal evidence; no canonical reference edits | Application tests |
| Two game tabs, duplicate and reversed delivery | Deterministic newest-section result, no lost unrelated sections | Concurrency tests and Firefox tabs |
| Tracker closed, reopened, background restarted | Cached valid data reconnects once; application acknowledgment accurate | Firefox runtime |
| Wrong origin/frame/source, unrelated localhost/file page | No personal-data publication/application | Bridge tests and Firefox runtime |
| Pause, timeout, retry, tracker rejection | Visible accurate status, no false applied state | Firefox keyboard and popup checks |
| Existing manual import, old backups, new backup round trip | Same behavior; goals/assumptions/separate supplies/history preserved | Focused compatibility tests |
| Signed unlisted install/update | Installable in normal Firefox; intended permissions/consent and state retention | Signed-package manual test |

Before usable status: run focused parser/application/bridge tests, code lint/build as appropriate, and the required live Firefox tests. Before distribution: attribution/permission record, accurate Mozilla declaration, exact production tracker origin, signing and signed-package verification. Rebecca has offered extensive manual testing; provide concrete test steps and observed expected outcomes when a runnable package exists.
