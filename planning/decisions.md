# Project Decisions

This file records important architectural and product decisions for the project and the rationale behind them. Use [roadmap.md](/C:/Users/liqui/Documents/farmrpg-tools/planning/roadmap.md) for milestone planning and [backlog.csv](/C:/Users/liqui/Documents/farmrpg-tools/planning/backlog.csv) for backlog items.

## Manual Firefox test companion — BL-374 (2026-10-10)

Use Firefox MV3 nonpersistent background scripts, a stable add-on ID, extension-local pairing/cache and only exact game/tracker hosts with storage/activeTab permissions. Reuse the pinned upstream parser subset with explicit attribution. Commands originate only in the own top-level extension popup; the background requests the selected game tab's frame 0, verifies unchanged URL, and signs structured full observations. Never give game scripts the pairing key or accept unsolicited game capture messages.

Require independent page completeness evidence and exact counts; unsupported/currently unverified layouts reject without replacing good state. Manual retry of saved validated captures is included; passive triggers/reconnect automation remain later rows. Temporary unsigned installation and synthetic relay tests are not signed distribution or actual game capture acceptance. Declare websiteContent/browsingActivity conservatively for local transfer outside the add-on, and review consent/distribution terms before BL-377. See `planning/firefox-manual-capture.md` and the package README.

## Paired exact-origin tracker bridge — BL-373 (2026-10-10)

Status: Accepted

Rebecca confirmed `https://farmrpg-tools.vercel.app/` as the only tracker destination. The opt-in receiver accepts only same top-level-window messages at that exact HTTPS origin, with protocol v1 and HMAC-SHA-256 authentication using a locally generated pairing key. The key stays local and outside player backups; disconnect revokes queued application. Key possession authenticates pairing, not Firefox package identity. The companion must separately validate extension runtime sender/game URL/frame before signing captures. No wildcard, arbitrary localhost, file-page or preview-origin exception is enabled.

Waiting/applying acknowledgments never mean applied. Applied replies follow durable application only; failures and duplicates are distinct. Successful applications publish non-personal same-tab/cross-tab refresh hints, and active pages reload saved data without remounting controls. Fixed coverage IDs, signing bytes, trust limits and the future Firefox acceptance gate are specified in `planning/capture-bridge-protocol.md`. Manual import and static local-first architecture remain unchanged.

## Serialized capture and independent history cadence — BL-372 (2026-10-10)

Status: Accepted

Capture application, manual inventory/mastery saves and backup restore share the origin-wide exclusive Web Lock `farmrpg-tools.player-data`. Capture requires Web Locks; older browsers retain manual imports but cannot enable capture. Re-read persisted ordering inside the lock, and reject duplicate/older/simultaneous observations. A truly absent dataset can accept its first capture; existing legacy, malformed or future ordering requires review and a manual import/correction before capture. Loaded local references are required so unknown items cannot bypass evidence review; unmatched items remain non-fatal and keep normalized-name identity.

Inventory counts and observation metadata are one localStorage write, preserving current assumptions, pet stock and separate supplies. Ordinary settings saves preserve the latest observed inventory instead of restoring stale page state. Manual item corrections derive from the fresh inventory inside the lock. Mastery live data and an optional history checkpoint commit together in one IndexedDB transaction; no application receipt is returned before commit. Unknown-item evidence is saved before authoritative data: a later write failure may leave useful evidence, but never an applied receipt. Storage errors remain visible.

Every accepted mastery observation updates the reserved `capture-live-mastery` snapshot. Retain at most one immutable checkpoint per UTC observation day, on the first capture whose normalized counts/tiers differ from the latest retained history. This compares against history, not live values, so later progress yesterday can still earn today's checkpoint. Identical history content does not create another daily row. Manual snapshots are never overwritten. History/compare lists exclude the mutable live record; latest-data reads and full backup/restore include it. No database or backup schema version changes are required. This service has no window listener or game extraction; authenticated delivery and view refresh remain BL-373.

## Import observation provenance — BL-366 (2026-10-09)

Status: Accepted

Store optional observation metadata with the inventory section and with each mastery snapshot: source (manual/capture), scope, observation time, application time and capture identity where applicable. Inventory counts and their provenance share one localStorage write; mastery values and provenance share one IndexedDB transaction. Do not introduce a separate receipt store that could claim application when its data write failed.

Legacy state/backups without metadata remain valid and retain unknown freshness. New backups preserve metadata; malformed metadata is rejected during backup validation. A manual correction establishes a conservative ordering boundary for its section, so earlier full captures can be rejected. Capture receivers must still implement shared serialization and authenticated delivery before becoming active. Snapshot saves resolve only after transaction completion, including rejection when a successful request is followed by an abort.

## Single-profile only

Status: Accepted

Decision:
The app supports a single local profile only.

Rationale:
The current product scope is focused on one player's local FarmRPG tracking workflow, and adding profile abstractions now would increase complexity without immediate user value.

Implications:
Storage, loaders, and views can assume one active local dataset. Multi-profile support remains a future product decision rather than a current design requirement.

## Local-first only, no backend

Status: Accepted

Decision:
The app operates as a local-first tool with no backend services.

Rationale:
The core use case is personal tracking and planning, and local-first behavior keeps the app simple, private, and low-maintenance.

Implications:
All persistence and reference-data usage should work in the browser without server APIs. Features that require remote sync are out of scope unless explicitly introduced later.

## Canonical item identity is derived from normalized item name for now

Status: Accepted

Decision:
Canonical item identity is currently based on normalized item name.

Rationale:
The available data sources do not yet provide a stable cross-source identifier that can be trusted as the primary key across mastery exports, reference data, and future planning inputs.

Implications:
Joins should continue using the normalization utilities. Future stronger identity support will need a deliberate migration path rather than an ad hoc change.

The current compatibility contract is:
- `canonicalKey` is the normalized item name produced by `toCanonicalItemKey`.
- Display names may preserve capitalization or spacing, but joins must use canonical keys.
- Snapshots, optional external IDs, Buddy slugs, icon asset keys, and convenience lookup layers must not redefine canonical item identity.
- Later catalog and alias work may add reviewed metadata and lookup support, but canonical identity migration requires a separate explicit decision.

## `farmrpg_item_id` is optional external metadata, not the canonical key

Status: Accepted

Decision:
`farmrpg_item_id` is treated as optional external metadata and not as the canonical key.

Rationale:
FarmRPG item IDs are useful metadata, but current project assumptions do not treat them as the stable identity source for all joins.

Implications:
CSV loaders may preserve `farmrpg_item_id`, but current matching logic should not depend on it.

## `buddy_slug` is optional buddy.farm URL metadata, not the canonical key

Status: Accepted

Decision:
`buddy_slug` is treated as optional buddy.farm URL metadata and not as the canonical key.

Rationale:
`buddy_slug` is useful for enrichment and cross-reference workflows, but it is not the primary identity source for the local tracker.

Implications:
Missing `buddy_slug` values should not block reference-data use. Future buddy-oriented features should treat it as supplemental metadata.

## Buddy slug and icon asset key are separate optional metadata concepts

Status: Accepted

Decision:
`buddy_slug` and the underlying item-image asset key should be treated as separate optional metadata concepts.

Rationale:
Observed buddy item pages reference item images from `farmrpg.com/img/items/...`, but the asset key is not reliably the same as `buddy_slug`. Confirmed patterns include directly numeric filenames, numeric filenames with query strings, and custom filenames. Treating slug and icon asset key as the same concept would overstate certainty and create fragile tooling assumptions.

Implications:
- Museum and icon tooling should not present slug-derived icon URLs as trustworthy by default.
- Numeric icon filenames may be treated as `farmrpg_item_id` candidates only when they are directly observed from real image references.
- Custom icon filenames should be preserved as icon asset metadata rather than coerced into IDs.
- Canonical item identity remains the normalized item name, while `farmrpg_item_id`, `buddy_slug`, and icon asset metadata remain optional enrichment fields.

## `mastery_difficulty.csv` remains separate from tower requirements data

Status: Accepted

Decision:
`mastery_difficulty.csv` remains a separate dataset from tower requirements data.

Rationale:
These files serve different purposes: one describes general mastery difficulty and notes, while the other describes tower-specific requirements.

Implications:
Each CSV should have its own loader and clear responsibilities. The app can join both against snapshots without merging them into one source file.

## Missing reference-data matches should be surfaced as non-fatal/unrated/unmatched rather than treated as hard errors

Status: Accepted

Decision:
Missing reference-data matches are surfaced visibly but do not break app workflows.

Rationale:
Reference data is expected to be incomplete during iterative maintenance, and the app should stay useful even when some rows do not match.

Implications:
UI should show unmatched or unrated states clearly. Loaders and derived views should avoid crashing when reference rows are missing.

## User-facing views prioritize player status over maintenance language

Status: Accepted

Decision:
Normal user-facing views should prioritize player status, what needs attention, and the next useful action over repository, reference-maintenance, or debug framing.

Rationale:
Recent Tower and orientation work showed the app is clearer when maintenance context is separated from the user's planning task instead of explained on the main page.

Implications:
UX work should favor clearer status, controls, labels, and compact/collapsible guidance over long explanatory copy. Internal or dev-facing pages may still expose maintenance details, but normal planning pages should avoid labels such as planning summary, missing snapshot rows, TBD rows, or reference maintenance when simpler user-facing wording works.

## Tower requirements live in a separate CSV

Status: Accepted

Decision:
Tower requirements are stored in a dedicated CSV file.

Rationale:
Tower requirements are a distinct ruleset and should stay independently maintainable from mastery difficulty data.

Implications:
Tower support should load from `tower_requirements.csv` through a dedicated loader and derived view path.

## Tower levels 201-300 use MM requirements; GM begins at 301+

Status: Accepted

Decision:
Tower levels 201-300 use Mega Mastered requirements, and Grand Mastered requirements begin at tower level 301 and above.

Rationale:
This matches current tower-specific rules and the encoded requirement tier semantics already present in the tower CSV.

Implications:
Tower UI wording and derived status logic should reflect GM vs MM requirements clearly. The tower CSV remains the source of truth per row.

## App terminology should distinguish achieved mastery statuses from next-target tiers

Status: Accepted

Decision:
The app should use wording that separates achieved statuses from next-target thresholds.

Rationale:
FarmRPG uses inconsistent mastery terminology, which can be ambiguous in planning and summary views.

Implications:
Use labels such as `Mastered (>= 10,000)`, `Grand Mastered (>= 100,000)`, and `Mega Mastered (>= 1,000,000)` for achieved status. Use phrasing like `Next target: 100,000 (Grand Mastery)` when describing in-progress thresholds.

## `planning/backlog.csv` may be consumed at runtime only for an internal backlog visualization feature

Status: Accepted

Decision:
Planning files remain workflow artifacts by default, but `planning/backlog.csv` may be consumed at runtime for a narrow internal local-only backlog/project-planning visualization feature.

Rationale:
An internal backlog graph or backlog-planning view can be useful inside the app, but that use should not silently turn planning files into general runtime data or weaken the current source-of-truth boundaries around gameplay and canonical reference inputs.

Implications:
- The exception is feature-scoped and opt-in rather than a new general rule for planning files.
- Backlog-derived runtime data is non-authoritative presentation/support data, not player-state or gameplay/reference truth.
- Backlog metadata must not become a dependency for gameplay logic, mastery calculations, import behavior, or canonical `data/` flows.
- Malformed backlog metadata should degrade safely and should not break the rest of the app.
- This does not introduce app-side editing of backlog files or change the local-first, single-profile, and no-backend constraints.

## Target-output planning uses a shared local supply pool

Status: Accepted

Decision:
Target-output planning consumes one normalized item-keyed supply pool across the whole planning problem, with manual overrides replacing effective supply while preserving derived source detail.

Rationale:
Planning one output at a time can double-count owned inventory, pet output, and other shared sources when multiple goals need the same intermediate or raw item. A shared pool lets the engine spend available supply once before expanding remaining craft demand.

Implications:
- Supply joins continue to use normalized item names as canonical keys.
- Derived supply and override supply should remain visible as separate concepts.
- Future inventory import and quest-resource adapters should feed the same supply boundary instead of creating parallel supply math.
- Missing source metadata should produce warnings and continue.

## External reference maintenance is cache-first and deliberately gentle

Status: Accepted

Decision:
Offline reference-maintenance tooling that contacts Buddy or FarmRPG-hosted assets must be cache-first, manually initiated, bounded, sequential, delayed, and review-oriented. Avoid repeated pulls of the same source page by preserving local evidence artifacts and parsing multiple reference outputs from that evidence.

Rationale:
The project benefits from up-to-date reference data, but being a good citizen with external services is more important than speed or completeness. New FarmRPG items often appear before Buddy source data is complete, so the correct workflow is to cache sparse evidence, wait, and recheck gently later rather than aggressively probing.

Implications:
- No app-runtime Buddy or FarmRPG fetching.
- No background crawlers, unbounded scans, parallel request bursts, or hidden automatic rechecks.
- Network maintenance scripts should default to conservative delays, explicit small limits, resumable/cache-aware runs, and dry-run or plan output before fetching.
- FarmRPG-hosted asset access should remain especially conservative and should normally go through the existing reviewed icon pipeline.
- Cached evidence and parser outputs remain review artifacts until intentionally promoted into canonical `data/` files.
- Blank or sparse new-item pages should be tracked for later manual recheck instead of repeatedly fetched in the same session.
