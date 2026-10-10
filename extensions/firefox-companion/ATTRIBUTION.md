# Upstream attribution and permission

Selected portions adapted from **Farm RPG Calculator Account Sync 1.13.1**, by **alikdash1**:
https://alikdash1.github.io/Farmrpgcalculator/downloads/farm-rpg-account-sync.zip

Pinned ZIP SHA-256: `AC28C4C34CECD68EE93301DD81386C92D659CF34308F38D439F5377EA2A96389`.

Rebecca explicitly confirmed reuse permission in this project conversation. The upstream package contains no LICENSE; this is permission-based reuse, not a claim of an open-source license. Preserve this record and confirm any distribution terms before signed external distribution (BL-377).

- `upstream-layout.js`: selected `parseQty`, `isNoise`, `parseMasteryPage`, and associated numeric/name/noise constants from `capture-page.js`. Removed the upstream trailing-floor-name heuristic because DOM badges are excluded explicitly; legitimate name digits must remain intact. Exposed as a small classic-script namespace; whole-account capture, art harvesting, downloads and unrelated parsers omitted.
- `extractor.js`: scoped text-walker approach from `getVisibleText(root, includeHidden)` and item-row/strong/badge selectors from upstream item-art harvesting. Changed to require one current Framework7 page, reject loaders/transitions, bound text, exclude controls/chrome, validate all rows and independent inventory/mastery totals. Never selects the largest retained page or falls back to document body.
- `farm-content.js`: manual-command/busy-guard structure adapted from upstream. Replaced page pill/events with authenticated runtime requests and stable-page read. No passive triggers, injected controls, downloads, game requests or navigation.
- Background/popup/tracker bridge retain upstream's local-cache/manual-transfer/status architecture but are new narrow implementations of the BL-373 protocol. Upstream whole-account schema/merge, wildcard bridge, service worker, downloads, full-text fallback and quarter-size rejection heuristics are not included.

No raw account text, credentials, chat or images are transmitted. Item names and exact counts, full-section evidence, sanitized source origin/path and observation identity/time are the only captured game data.
