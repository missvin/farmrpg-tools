# Release Model

This project uses a lightweight release model. [backlog.csv](/C:/Users/liqui/Documents/farmrpg-tools/planning/backlog.csv) is the canonical source of structured release and work data, [roadmap.md](/C:/Users/liqui/Documents/farmrpg-tools/planning/roadmap.md) is the future-facing milestone view, and [CHANGELOG.md](/C:/Users/liqui/Documents/farmrpg-tools/CHANGELOG.md) is the current manual release-history view derived from shipped backlog items.

## Versioning

Firefox companion test package 0.3.0 (2026-10-16, BL-376) adds automatic cached delivery on tracker readiness/background recovery and live per-section delivery/confirmation status. Existing extension-local captures and pairing are retained; no player backup/schema or permission changes. The tracker readiness update must deploy with this version. BL-375 live acceptance is complete; signed persistent installation remains BL-377.

Firefox companion test package 0.2.0 (2026-10-14, BL-375) adds automatic visited-page capture and pause/resume. It remains unsigned, with live automatic acceptance pending. This package version is separate from the tracker app version; no player-data storage/backup format or tracker protocol changes are included. Signed unlisted distribution is BL-377.

- `MAJOR.MINOR.PATCH`
- Major: breaking data, storage, or model change
- Minor: new feature, page, or capability
- Patch: bugfix or UX polish

## Workflow

- Create or update a backlog item
- Assign a target version
- Implement the work
- Mark the backlog item as shipped
- Update the roadmap if needed
- Generate or update changelog entries from shipped backlog items

## Release Notes

- `release_notes` should be a short, human-readable summary
- [backlog.csv](/C:/Users/liqui/Documents/farmrpg-tools/planning/backlog.csv) is the canonical source
- The roadmap and future changelog are derived views
