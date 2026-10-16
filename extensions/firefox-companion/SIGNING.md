# Signed unlisted installation — BL-377

Status on 2026-10-16: submission preparation only. No Mozilla signature or permanent-install acceptance yet. Rebecca needs to create a Mozilla Add-ons developer account. The upload ZIP is unsigned and cannot provide restart persistence in normal Firefox.

## Submit version 0.4.0

1. Create/sign in to your Mozilla account at [Mozilla Add-ons Developer Hub](https://addons.mozilla.org/developers/). Read and accept the developer agreement yourself. Keep credentials out of chat and the repository.
2. Build the upload locally:

   `powershell -NoProfile -ExecutionPolicy Bypass -File extensions/firefox-companion/package-test.ps1 -ForSigning`

   Upload `local-data/firefox-companion/farmrpg-companion-0.4.0-unsigned.zip`. The package uses an explicit allowlist of readable extension source, attribution, README and privacy notice. It contains no build/transpilation step, tests, profiles, captures, pairing keys or account data. Record the printed SHA-256 alongside Mozilla's validation/signing result.
3. Choose **Submit a New Add-on → On your own** (unlisted/self-distribution), not a public listing. Select desktop Firefox. The minimum supported desktop version is 140, which supports built-in data consent. No Android acceptance has been performed.
4. Upload the ZIP and review Mozilla's validation report. Fix errors and investigate security/privacy warnings before continuing. Source is plain readable JavaScript with no minification or generated code; a separate pre-build source archive is not needed for this package. If Mozilla requests additional evidence, retain that request and address it rather than guessing.
5. Preserve [ATTRIBUTION.md](ATTRIBUTION.md). Upstream reuse permission was confirmed by Rebecca; there is no upstream LICENSE and no open-source license is asserted. Any additional distribution-rights attestation must match the permission actually granted; clarify with the author if it does not.
6. If requested, use [PRIVACY.md](PRIVACY.md) as the disclosure and the reviewer notes below. The manifest declares `websiteContent` and `browsingActivity`; no additional permissions have been added.
7. Submit for signing, then download the **signed XPI** from the submitted version's file link. Keep it separate from the unsigned test XPI. Record the AMO version/signing result and signed-file SHA-256. Do not modify/repack a signed XPI.

Mozilla's [submission guide](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/) explains this flow. [Built-in consent documentation](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/) explains the data declarations.

## Normal installation and acceptance

1. Export a tracker backup first. Use the same Firefox profile that holds your tracker. Record current pairing, pause preference, cached rows and confirmed times without sharing keys. A temporary-to-signed transition may require re-pairing; preservation from a temporary install is not promised. Do not uninstall an existing signed version to update it.
2. Open `about:addons` → gear menu → **Install Add-on From File…**, select the signed XPI and accept the host/data permissions. Do not use Load Temporary Add-on. If a temporary copy blocks installation, restart Firefox to let that copy expire, then install the signed XPI. Tracker website data should remain; re-pair if needed.
3. Reload game and tracker tabs, keep one tracker tab open, pair if needed, and visit My Inventory and Mastery normally. Verify counts, per-section application confirmation and latest daily mastery comparison. Pause/resume should work.
4. Quit all Firefox windows and reopen the same profile. Confirm the companion remains in `about:addons`, with pairing, pause preference and cache retained. Resume if paused; revisit a supported game page and verify a new changed observation applies. Also capture while the tracker is closed, reopen it and verify pending delivery recovers.
5. For update acceptance, sign a later higher version with the **same** ID `farmrpg-planning-companion@missvin` through the existing AMO add-on's new-version flow. Install its signed XPI over this one through `about:addons`, without uninstalling or clearing storage. Check retained pairing/cache/pause state, restart persistence and capture again. Do not mark this check passed until a real signed update has been tested.

Updates are manual signed-XPI installs. There is no `update_url` or hosted update feed in this slice; an unlisted signature alone does not configure automatic updates. Do not lower Firefox signature enforcement.

## Reviewer notes

Local-first, single-profile planning companion for https://farmrpg-tools.vercel.app/. Pair using the tracker footer's Firefox companion controls, then enter that key through the extension toolbar popup. Automatic capture is enabled on pairing; Pause/Resume and manual Capture/Retry are available. Game access requires a user's FarmRPG account; no credentials are bundled or requested from the reviewer. The complete owned My Inventory and seven-section Mastery pages are supported; Everything is a different catalogue and is intentionally rejected. No game actions, extra game requests, cookies access, downloads, backend or telemetry. Exact-origin authenticated relay transfers structured observations to browser-local tracker storage. Upstream attribution and privacy notice are included. Developers can run the synthetic isolated-profile harness documented in README without a game account, but that unsigned harness is not proof of signed installation.

## Acceptance record

- Upload ZIP: `farmrpg-companion-0.4.0-unsigned.zip`, SHA-256 `F75E0C082F8A27F251925369E2C66AD710E90E30F5C9796716CE5F7B2516C18D` (2026-10-16; regenerate and record a new hash if packaged files change).
- Local checks: 76 focused companion tests and extension lint passed. Submission archive has exactly the 13 allowlisted root files and the expected version/stable ID. Both submission and existing unsigned test packaging commands passed. No app build was needed: only extension identity metadata, packaging and documentation changed; capture/runtime code is unchanged. Mozilla's validator has not run yet.
- Mozilla validation/signing result: pending account/submission.
- Signed XPI hash and normal install: pending.
- Restart, retained-state and signed-update checks: pending.
- Signed-package live Inventory/Mastery application: pending.

BL-377 remains in progress until these distribution checks are recorded. Prior temporary-install acceptance for BL-374/375/376 remains valid for those runtime slices only.
