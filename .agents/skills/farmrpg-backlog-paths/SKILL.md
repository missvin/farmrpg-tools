---
name: farmrpg-backlog-paths
description: Planning-only backlog path recommendation workflow for the FarmRPG local-first planning tool. Use when Codex should compare multiple coherent implementation paths, recommend three possible paths for the next 5-10 backlog items, sequence a mini-release or product increment, audit path tradeoffs, or help decide what Rebecca should work on next without editing files or implementing code.
---

# FarmRPG Backlog Paths

Use this skill to recommend coherent backlog paths, not single next items. Stay planning-only unless the user explicitly asks for follow-up backlog edits after the recommendation.

## Start-Up Read

Read the standard planning core before recommending paths:

- `AGENTS.md`
- `planning/decisions.md`
- `planning/roadmap.md`
- `planning/architecture.md`
- `planning/backlog.csv`

Then keep retrieval targeted:

- Inspect relevant backlog parents, child rows, dependency rows, priorities, effort, target versions, and notes.
- Read relevant roadmap sections for milestone/story fit.
- Read other planning/spec docs only when a candidate path needs them.
- Use `planning/positioning.md` only as a secondary tie-breaker when multiple paths are otherwise reasonable.

## Path Selection

Recommend three coherent implementation paths by default. Each path should usually contain 3-7 backlog items; use up to 10 only when the items are small and tightly related.

Optimize for:

- cohesive product outcomes over arbitrary batches
- dependency-valid sequencing using `BL-###` tokens
- actionable child rows over broad umbrella rows
- visible user value, durable foundations, or clear mini-release shape
- reliable next-slice execution if Rebecca chooses a path

Avoid:

- listing the highest-priority rows without a story
- mixing unrelated medium-priority work into a fake path
- recommending broad mega-tasks as implementation items
- rewriting roadmap strategy during a path recommendation
- creating backlog rows unless the user explicitly asks for backlog intake
- including `shipped` or `icebox` rows except as context

Good path themes include:

- quick visible win
- foundation-first
- public/shared-user readiness
- item/icon/reference enrichment
- target-planning MVP
- UX trust and explainability

## Path Output

For each recommended path, include:

- path name
- product outcome
- ordered backlog items
- why this path is coherent
- what it unlocks
- tradeoffs or risks
- ambiguity or manual-check points
- recommended testing/checkpoint strategy
- when to stop or pause
- suggested first item if the path is selected

Distinguish implementation order from optional cleanup or hygiene. If a cleanup item is useful but not required for the path's outcome, label it as optional.

## Blockers And Checkpoints

Flag manual blockers only when Rebecca must provide data, make a product decision, or test something before implementation can safely continue.

Recommend user-test checkpoints when a path is best validated in batches instead of after every row. Keep checkpoints practical, such as "after the first visible page lands" or "before moving from resolver work into linking every page."

## Handoff To Implementation

Do not implement from this skill. If Rebecca chooses a path, hand off to `$farmrpg-tools-next-slice` with the path name and ordered backlog items.

Suggested handoff wording:

```text
Use $farmrpg-tools-next-slice to implement Path 1 in order, pausing on ambiguity.
```

The implementation skill should follow the selected path instead of choosing a different next item.

## Field Notes

Append to `C:\Users\liqui\Documents\codex-post-notes\field-notes.md` only when the pathing work reveals a genuinely reusable workflow, product, planning, or engineering lesson. Do not add field notes for routine backlog review.

If a warranted note cannot be written, include `Field note not written` in the final readout with the exact ready-to-paste note text.

## Final Readout

End with a concise planning readout that includes:

- files changed, normally none
- scope reviewed: files, rows, and sections inspected
- three recommended paths
- which path looks strongest and why, if the evidence supports a recommendation
- manual blockers or recommended user-test checkpoints, only when real
- suggested first item for each path
- field-note status
- next reasonable backlog item plus short justification

Do not include app tests/lint/build unless files were changed in a follow-up planning edit.

