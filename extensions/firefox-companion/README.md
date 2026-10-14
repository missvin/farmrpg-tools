# Firefox companion — automatic capture test build (BL-375)

This is an unsigned test companion with automatic capture (version 0.2.0). BL-374 manual capture acceptance completed on 2026-10-14: Rebecca verified live My Inventory/Mastery application and reload persistence, with recovery/guard checks covered by focused tests and isolated Firefox against the real deployed receiver. BL-375 automatic capture is implemented and awaiting normal-profile visit/pause acceptance; signing remains BL-377.

## Temporary installation

1. In Firefox, open `about:debugging#/runtime/this-firefox`.
2. Choose **Load Temporary Add-on**, then select this directory's `manifest.json` (or the test XPI produced by `package-test.ps1`). Temporary installs disappear after Firefox restarts.
3. Reload existing game and tracker tabs so their content scripts are present.
4. Keep one tracker tab open at **https://farmrpg-tools.vercel.app/**. The deployed receiver was verified for the current Inventory/seven-section Mastery contract on 2026-10-14; hard-refresh stale tracker tabs after updates. If the footer lacks **Firefox companion**, stop: this tracker version cannot receive the capture yet.
5. In the tracker footer, expand **Firefox companion**, choose **Pair Firefox companion**, and copy its key. Open the companion from Firefox's extensions toolbar menu (pairing in the tracker does not open its popup), then paste the key and choose **Save pairing key**. Treat the key as local authority; do not share it or include it in screenshots.
6. Select the game tab, manually open the complete My Inventory or full Mastery page, and wait for loading to finish. Capture starts automatically after the page settles. Manual **Capture active game page** remains available.
7. Reopen the popup if it closes while working. **Captured locally / Waiting** is not application confirmation. Only **applied** plus a matching tracker receipt updates the last confirmed application time.

The tracker and Firefox companion must be in the same Firefox profile. Chrome's or another profile's local tracker data does not sync across browsers. Export a tracker backup before the first live application; existing data without ordering metadata may require a fresh manual import before capture can replace it. Rejected captures retain the last good data.

## Repeatable acceptance checks

- Capture My Inventory and compare several known counts, including a zero/depleted item when present. Compare the complete captured row count against your ordinary paste import. Counts must agree; no unrelated goal, pet/storehouse supply or settings changes.
- Capture full Mastery with tiers folded but already loaded. Check counts against ordinary paste import. Empty tiers need explicit loaded-empty evidence; an unloaded fold must reject visibly.
- With a tracker item page already open, capture changed inventory/mastery: displayed saved values should refresh without resetting its selected view/target.
- Visit a filtered inventory, an item page or another game page and press Capture. It must reject, leaving saved capture and tracker data unchanged.
- Close the tracker, capture a valid page, then reopen it and press **Retry saved inventory/mastery**. Waiting is expected while closed; application must be acknowledged after the retry. Retrying the same applied capture should say duplicate rather than save another history entry.
- Disconnect pairing in the tracker and retry: the extension must not claim applied; timeout/no acknowledgment is visible. Generate a new key, save it in the popup, and retry manually.
- For a rejection, report the status text and which page was open. Do not send pairing keys, account text or credentials. If selectors do not match your current game layout, stop live capture and use manual imports until reviewed fixture evidence is added.

## Completeness and trust boundaries

Extraction is deliberately strict and current-layout acceptance is pending. Inventory requires the exact #!/inventory.php route and data-page="inventory", item rows with `img.itemimg`, `strong` name and `.item-after` exact quantity, plus matching unique-positive-item and total-quantity summary counts. Row markup and summary labels were checked against Rebecca's sanitized My Inventory evidence on 2026-10-14. Everything is a separate item catalogue and must never replace owned stock. Filtered routes, missing totals and incomplete row coverage reject. Rebecca verified normal-page capture/application and reload persistence on 2026-10-14. Do not weaken checks or infer full coverage from a stable row count.

Mastery reuses the pinned upstream parser on the one current page, including folded DOM rows. It requires seven known section headings: No Tier (10), Tier I (100), Tier II (1,000), Tier III (10,000), Tier IV (100,000), Tier V (1,000,000) and Mega Mastered (infinity). Exact progress quantities/targets, explicit loaded-empty tiers, matching heading/target row totals and independent mastered/GM/MM summary counts remain required. Rebecca supplied heading/target layout evidence on 2026-10-14; other layouts remain unsupported and missing headers are not fabricated. Normal-page live capture/application and reload persistence are accepted; unfamiliar or incomplete layouts still reject.

The background accepts commands only from its own extension popup. Capture responses come only from its direct top-frame request to the selected allowed game tab; navigation before completion rejects. Pairing authority stays in extension storage/background, never in game scripts or page messages. Signed requests relay only to the exact top-level tracker origin, with own-window/source/origin/protocol/request/receipt checks. Actual Firefox page-world messaging is an acceptance gate; failures must not relax tracker source checks.

Permissions: `storage` for local pairing/cache/status; `activeTab` for the explicit popup action; hosts only the two FarmRPG origins and the one tracker origin. No `tabs`, downloads, cookies, webRequest, scripting, broad localhost/file access, game fetches or navigation. Data-consent declaration is conservatively `websiteContent` and `browsingActivity` because item counts and sanitized source page identity are transferred out of the add-on into the tracker page. There is no backend, telemetry or network upload. Review the declaration again at BL-377 before signing. See [Mozilla's consent taxonomy](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/).

## Verification checkpoint

Completion pass: 135 focused tests and extension lint passed. The rebuilt unsigned package passed an isolated Firefox check against the actual deployed receiver using synthetic data: closed-tracker waiting/manual retry, exact-origin relay, durable inventory after reload, duplicate delivery and disconnect/re-pair recovery. Rebecca separately verified live inventory/mastery extraction and persistence. See `planning/firefox-manual-capture.md` for the evidence matrix. No app build was repeated for this test/docs-only pass; preceding product fixes had passing builds.

## Development and isolation

- `node node_modules/vitest/vitest.mjs run extensions/firefox-companion/companion.test.mjs`
- `node node_modules/eslint/bin/eslint.js --config extensions/firefox-companion/eslint.config.mjs extensions/firefox-companion`
- `powershell -NoProfile -ExecutionPolicy Bypass -File extensions/firefox-companion/package-test.ps1`
- Optional synthetic runtime check: `powershell -NoProfile -ExecutionPolicy Bypass -File extensions/firefox-companion/verify-firefox-runtime.ps1` (starts its own isolated headless profile; visits the public tracker and applies only synthetic inventory through its real receiver in the fresh profile).

The package command includes an explicit file allowlist, never tests, local data, pairing authority or upstream ZIP. It writes ignored unsigned ZIP/XPI artifacts under `local-data/firefox-companion/`.

Rebecca authorized integrating the parallel tracks on 2026-10-10, Tower first and capture second. The combined code preserves both histories; verify the deployed tracker has BL-373 pairing controls before live application. BL-374 is shipped after the 2026-10-14 manual capture acceptance pass. BL-375 adds automatic visited-page capture; BL-376 (automatic reconnect/recovery) and BL-377 (signed-unlisted acceptance) remain separate work.

## Automatic capture — BL-375

Reload the temporary add-on and reload your game tab after updating to 0.2.0. Existing pairing is retained; paired profiles enable automatic capture unless paused. Visit My Inventory or full Mastery normally, wait for loading to finish, then open/reopen the popup to inspect cached rows and the last confirmed application time. Do not press Capture for the automatic-visit test. Keep one tracker tab open.

The popup's Pause automatic capture / Resume automatic capture control persists across background reloads. Manual Capture and Retry still work while paused. Closing the popup returns focus to the game and permits a fresh observation after resume. An already-sent transfer may finish after pause.

Observation is debounced, bounded and confined to visible supported pages. Unchanged rows do not create a new capture or application timestamp, including when another game tab shows the same data. Partial/unstable reads retain previous data and retry at most twice until a new page change/visit. If the tracker is closed, captures are cached; reopen it and use Retry saved inventory/mastery. Automatic reconnect is BL-376. Everything catalogue capture is separate future scope; multiple tracker tabs still require closing extras.

Live acceptance: without clicking Capture, visit Inventory then Mastery and confirm saved counts; change normal game stock/progress and revisit to confirm updates; revisit unchanged pages to confirm no new capture; pause and verify no automatic update, then resume. Reload the tracker to check persistence. These normal-profile automatic checks remain pending.
