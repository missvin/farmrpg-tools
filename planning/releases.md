# Release Model

This project uses a lightweight release model. [backlog.csv](/C:/Users/liqui/Documents/farmrpg-tools/planning/backlog.csv) is the canonical source of structured release and work data, [roadmap.md](/C:/Users/liqui/Documents/farmrpg-tools/planning/roadmap.md) is the future-facing milestone view, and a future `CHANGELOG.md` will be derived from shipped backlog items.

## Versioning

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
- Later generate changelog entries from shipped backlog items

## Release Notes

- `release_notes` should be a short, human-readable summary
- [backlog.csv](/C:/Users/liqui/Documents/farmrpg-tools/planning/backlog.csv) is the canonical source
- The roadmap and future changelog are derived views
