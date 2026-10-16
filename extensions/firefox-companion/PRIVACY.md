# Companion privacy notice

Version 0.4.0, 2026-10-16

When paired and automatic capture is enabled, the companion reads complete My Inventory and Mastery pages you visit on farmrpg.com. Manual Capture remains available while paused. It reads item names, exact inventory/mastery quantities and targets, section completeness evidence, sanitized source origin/path, and observation time/identifier. It does not read account credentials or chat, collect images, or make game requests or take game actions.

The companion stores your pairing key, latest validated captures, pause preference and delivery status in this Firefox profile's extension storage. It transfers signed observations only to your paired tracker page at https://farmrpg-tools.vercel.app/ in the same Firefox profile. The tracker saves observations in browser-local storage; captures are not uploaded to a server. There is no analytics, advertising, telemetry or cloud sync in the companion. Loading the hosted tracker itself makes ordinary website requests to its host.

Firefox's consent prompt declares website content and browsing activity because observations and sanitized source page identity cross from the extension into the tracker page. Host access is limited to farmrpg.com, www.farmrpg.com and farmrpg-tools.vercel.app. The storage permission keeps local state; activeTab supports manual capture.

Pause stops automatic capture and delivery; manual actions still work and an already-sent transfer may finish. Disconnect removes extension pairing authority and stops automatic work; it is not a data-erasure control. Uninstalling removes extension-local data, while saved tracker data remains until removed using tracker controls or by clearing that website's storage. Back up tracker data before clearing storage. The companion does not use browser sync for its state.
