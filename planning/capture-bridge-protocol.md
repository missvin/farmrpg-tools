# Tracker bridge v1 — BL-373

Rebecca confirmed `https://farmrpg-tools.vercel.app/` on 2026-10-10. The sole allowed origin is **`https://farmrpg-tools.vercel.app`**. Development ports, preview aliases, file pages, HTTP and child frames are not enabled.

## Pairing and trust

The tracker footer offers opt-in pairing. Generate 32 random bytes, store their lowercase hex representation locally under `farmrpg-tools.capture-pairing.v1`, and let Rebecca copy it into the future Firefox companion. Never post the key in window messages, log it, or send it over the network. Disconnect deletes it; new pairing generates a new key. Pairing is not proof that a companion is installed or connected. This device-local authority is intentionally excluded from portable player-data backups; another browser pairs independently.

Authenticate incoming captures with HMAC-SHA-256 and the paired key. This proves key possession, not a Firefox package ID. Same-origin tracker scripts remain trusted, as they already have access to browser-local player data. BL-374 must validate extension runtime sender ID, game origin/URL and frame before signing a capture; retain the key only in extension-local authority, not an injected page relay. No game credentials, game fetches, navigation, backend or cloud sync are involved.

Window messages must come from the tracker's own top-level window, with the exact configured origin. Reject null source, other windows and frames; do not relax these checks to accommodate a Firefox integration problem. The Firefox port must verify its actual content-script/page-world transport and adapt a narrow relay if needed. See [Mozilla content-script communication](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts#communicating_with_the_web_page) and [postMessage security guidance](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage#security_concerns). Actual Firefox transport verification remains BL-374/BL-377.

## Signed request

Post to the exact tracker origin, never `*`. The outer envelope is:

```json
{
  "channel": "farmrpg-tools.capture",
  "version": 1,
  "sender": "farmrpg-tools-firefox",
  "body": "<JSON string containing requestId and capture>",
  "signature": "<64 lowercase hexadecimal HMAC characters>"
}
```

Sign the UTF-8 bytes of `1\nfarmrpg-tools-firefox\n` followed by the **exact body string**, with the 32-byte key decoded from hex. Do not parse/reserialize before verifying. Body size is limited to 5,000,000 UTF-8 bytes. `requestId` must match `[a-zA-Z0-9_-]{1,128}`. Its `capture` is the existing version-1 full-observation envelope from BL-370: schema/version, capture ID, section, full scope, observed time, FarmRPG source URL, settled active-page coverage, and structured rows.

Reviewed protocol section identifiers are fixed by the tracker, never supplied as validation policy by the message:

| Observation | Required coverage IDs |
| --- | --- |
| Full My Inventory (`#!/inventory.php`, `data-page="inventory"`) | `Inventory` |
| Full mastery | `10` (No Tier), `100` (Tier I), `1000`, `10000`, `100000`, `1000000`, `INF` |

These are adapter contract IDs, not assumptions about DOM headings. BL-374 must map actual reviewed layouts to them and prove every required section loaded, including explicit zero-row sections. No extractor is enabled here. Partial pages and item-page observations remain unsupported.

## Acknowledgments and refresh

Replies use the exact origin, channel/version, sender `farmrpg-tools-tracker`, type `ack`, and the authenticated request ID. The future content bridge must check origin, its own window source, sender and shape before relaying an acknowledgment to the extension background. Replies contain status/diagnostics, not the paired key or a whole player dataset. They are same-origin page replies, not signed Firefox-runtime identity assertions.

- `waiting`: local references are loading or another capture is being saved. Nothing is confirmed applied. A busy second request must retry after the first finishes; it was not silently queued.
- `applying`: the tracker is waiting for durable local application, including its shared cross-tab lock/transaction.
- `applied`: application committed. Includes the durable capture receipt and non-fatal warnings. Notification failure adds a reload warning without falsely claiming persistence failed.
- `duplicate`: this capture ID is already represented in current ordering; no data changed.
- `rejected`: includes the failure reason; no applied receipt. Older observations, malformed coverage, unknown ordering, revoked pairing and failed storage retain previous authoritative data.

Untrusted/malformed envelopes never receive an applied acknowledgment. Authenticated persistence/reference failures receive rejected acknowledgments. If reply publication fails after a save, the tracker says it saved but could not acknowledge; retrying is safe through durable ordering/deduplication. Disconnect revokes queued work before its authoritative write. An already-started durable write may finish; disconnect does not undo committed data.

Only successful application publishes a shared refresh hint. Same-tab subscriptions and `BroadcastChannel` notify active pages without sending player data or keys. Data-loading effects rerun without remounting page controls; inventory-only subscriptions preserve draft assumptions, and comparison selections remain selected while valid. Failed and duplicate captures do not publish refresh hints. Manual imports remain available.

The original tracker-side slice did not include a Firefox package. BL-374 manual acceptance and BL-375 passive acceptance are now complete; signed install remains BL-377.

## Receiver readiness — BL-376

A same-top-window, exact-origin message with this channel, version 1, sender `farmrpg-tools-firefox` and type `receiver-probe` may receive `{channel, version: 1, sender: 'farmrpg-tools-tracker', type: 'ready'}` while pairing is enabled. Receiver mount also announces ready. This unsigned readiness exchange carries no key or player data and cannot apply observations; every capture still requires its normal signed envelope and durable acknowledgment.

The content relay validates ready source/origin/channel/version/sender before notifying its extension background. The background validates runtime sender ID, tracker origin and frame 0, probes the one tracker tab and recovers cached sections serially. Per-document/background attempts prevent repeated readiness from creating a resend loop; durable applied/duplicate records suppress further automatic delivery. Restarted in-flight records remain unconfirmed until a new valid acknowledgment. Manual Retry, Resume and re-pair remain explicit retry opportunities. Pause/disconnect gate automatic recovery.
