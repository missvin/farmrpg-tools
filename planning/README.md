# Planning

This directory holds the lightweight planning system for the repo.

- [backlog.csv](/C:/Users/liqui/Documents/farmrpg-tools/planning/backlog.csv)
  - Structured backlog database
  - Source of truth for planned features, research, data work, and follow-up tasks

- [roadmap.md](/C:/Users/liqui/Documents/farmrpg-tools/planning/roadmap.md)
  - Milestone planning
  - High-level only, used to show what is current, next, later, and icebox

- [decisions.md](/C:/Users/liqui/Documents/farmrpg-tools/planning/decisions.md)
  - Architectural and product decisions log
  - Records important accepted choices and their rationale

Guidance:
- Add ideas and follow-up work to `backlog.csv`
- Move backlog items onto `roadmap.md` when they are scheduled into a milestone
- Retain completed rows as shipped history; update their notes rather than deleting them.
- Record major design choices in `decisions.md` so future work has clear context
- Use `parent_id` for ownership and grouping; `dependencies` contains actual completion prerequisites, not an ongoing umbrella's general review context.
- Split workstreams into explicit verified child slices before implementation. An umbrella closes only when its defined children and acceptance gates are complete; completed foundations do not imply a usable end-to-end feature.
- Assign the next unused numeric ID and place new children near their parent where practical. Preserve existing IDs and relative row order; broader ordering/schema work remains BL-025/BL-026.

Latest full planning reconciliation: [2026-10-10 review](reconciliation-2026-10-10.md). This checks planning consistency, not fresh product, hosted, reference-data or generated-artifact correctness.
