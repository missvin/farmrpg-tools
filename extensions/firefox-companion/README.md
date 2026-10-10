# Firefox companion — manual test build (BL-374)

This is an unsigned, manual-only test companion. BL-374 remains in progress until current-layout, temporary Firefox install and capture/paste parity checks pass. No signed release or passive capture is claimed.

## Temporary installation

1. In Firefox, open `about:debugging#/runtime/this-firefox`.
2. Choose **Load Temporary Add-on**, then select this directory's `manifest.json` (or the test XPI produced by `package-test.ps1`). Temporary installs disappear after Firefox restarts.
3. Reload existing game and tracker tabs so their content scripts are present.
4. Keep one tracker tab open at **https://farmrpg-tools.vercel.app/**. Its deployed code must include BL-373; the branch's code has not been verified as deployed. If the footer lacks **Firefox companion**, stop: this tracker version cannot receive the capture yet.
5. In the tracker footer, expand **Firefox companion**, choose **Pair Firefox companion**, and copy its key. In the extension popup paste the key and choose **Save pairing key**. Treat the key as local authority; do not share it or include it in screenshots.
6. Select the game tab, manually open the complete Everything inventory or full Mastery page, and wait for loading to finish. Press the extension's **Capture active game page**.
7. Reopen the popup if it closes while working. **Captured locally / Waiting** is not application confirmation. Only **applied** plus a matching tracker receipt updates the last confirmed application time.

The tracker and Firefox companion must be in the same Firefox profile. Chrome's or another profile's local tracker data does not sync across browsers. Export a tracker backup before the first live application; existing data without ordering metadata may require a fresh manual import before capture can replace it. Rejected captures retain the last good data.

## Checks for Rebecca

- Capture Everything inventory and compare several known counts, including a zero/depleted item when present. Compare the complete captured row count against your ordinary paste import. Counts must agree; no unrelated goal, pet/storehouse supply or settings changes.
- Capture full Mastery with tiers folded but already loaded. Check counts against ordinary paste import. Empty tiers need explicit loaded-empty evidence; an unloaded fold must reject visibly.
- With a tracker item page already open, capture changed inventory/mastery: displayed saved values should refresh without resetting its selected view/target.
- Visit a filtered inventory, an item page or another game page and press Capture. It must reject, leaving saved capture and tracker data unchanged.
- Close the tracker, capture a valid page, then reopen it and press **Retry saved inventory/mastery**. Waiting is expected while closed; application must be acknowledged after the retry. Retrying the same applied capture should say duplicate rather than save another history entry.
- Disconnect pairing in the tracker and retry: the extension must not claim applied; timeout/no acknowledgment is visible. Generate a new key, save it in the popup, and retry manually.
- For a rejection, report the status text and which page was open. Do not send pairing keys, account text or credentials. If selectors do not match your current game layout, stop live capture and use manual imports until reviewed fixture evidence is added.

## Completeness and trust boundaries

Extraction is deliberately strict and current-layout acceptance is pending. Inventory requires the Everything label, item rows with `img.itemimg`, `strong` name and `.item-after` exact quantity, plus matching unique-positive-item and total-quantity summary counts. The first live test may reject if the page uses another quantity/layout location or lacks those independent totals. Do not weaken checks or infer full coverage from a stable row count.

Mastery reuses the pinned upstream parser on the one current page, including folded DOM rows. It requires six known tier headings, exact progress quantities/targets, explicit loaded-empty tiers, matching heading/target row totals and independent mastered/GM/MM summary counts. No Tier/other layouts remain unsupported pending actual fixture review; missing headers are not fabricated. Structural fixtures are synthetic and are not evidence that today's game DOM matches.

The background accepts commands only from its own extension popup. Capture responses come only from its direct top-frame request to the selected allowed game tab; navigation before completion rejects. Pairing authority stays in extension storage/background, never in game scripts or page messages. Signed requests relay only to the exact top-level tracker origin, with own-window/source/origin/protocol/request/receipt checks. Actual Firefox page-world messaging is an acceptance gate; failures must not relax tracker source checks.

Permissions: `storage` for local pairing/cache/status; `activeTab` for the explicit popup action; hosts only the two FarmRPG origins and the one tracker origin. No `tabs`, downloads, cookies, webRequest, scripting, broad localhost/file access, game fetches or navigation. Data-consent declaration is conservatively `websiteContent` and `browsingActivity` because item counts and sanitized source page identity are transferred out of the add-on into the tracker page. There is no backend, telemetry or network upload. Review the declaration again at BL-377 before signing. See [Mozilla's consent taxonomy](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/).

## Verification checkpoint

58 focused tests, extension/repository lint and tracker build passed. Actual Firefox 157.0.1 temporary install and synthetic exact-origin own-window relay passed in a fresh isolated profile. This verifies runtime wiring, not live game extraction or real durable tracker application. See `planning/firefox-manual-capture.md`.

## Development and isolation

- `node node_modules/vitest/vitest.mjs run extensions/firefox-companion/companion.test.mjs`
- `node node_modules/eslint/bin/eslint.js --config extensions/firefox-companion/eslint.config.mjs extensions/firefox-companion`
- `powershell -NoProfile -ExecutionPolicy Bypass -File extensions/firefox-companion/package-test.ps1`
- Optional synthetic runtime check: `powershell -NoProfile -ExecutionPolicy Bypass -File extensions/firefox-companion/verify-firefox-runtime.ps1` (starts its own isolated headless profile; visits the public tracker and sends only synthetic data to a synthetic acknowledgment listener).

The package command includes an explicit file allowlist, never tests, local data, pairing authority or upstream ZIP. It writes ignored unsigned ZIP/XPI artifacts under `local-data/firefox-companion/`.

BL-374 changes live in this isolated worktree/branch; push for review, defer merging master while other chats are active. BL-373 is in the branch ancestry but is not yet integrated with master. Shared planning-file conflicts require deliberate reconciliation later. BL-375 (passive triggers), BL-376 (automatic reconnect/recovery) and BL-377 (signed-unlisted acceptance) are separate work.
