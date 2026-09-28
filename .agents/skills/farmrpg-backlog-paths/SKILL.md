---
name: farmrpg-backlog-paths
description: Read-only comparison and sequencing of coherent FarmRPG backlog directions. Use to compare product outcomes, explore path tradeoffs, or sequence a chosen direction into useful increments. Use farmrpg-next-steps for a general project reset and first recommendation; use farmrpg-tools-next-slice for implementation.
---

# FarmRPG Backlog Paths

Compare coherent directions or sequence the direction Rebecca has selected. Normally offer two or three genuine alternatives when comparison is requested; offer fewer when the backlog supports fewer. A chosen direction needs a sequence, not invented competing paths. There is no required number of items per path.

This workflow is strictly read-only: no backlog edits, field notes, memory writes, file changes, commits, deployments, chat messages, or automatic implementation. Any authorized follow-up intake or implementation is a separate workflow after the readout.

## Ground the Paths

- Read `AGENTS.md`, relevant sections of `planning/decisions.md` and `planning/roadmap.md`, and a compact projection of `planning/backlog.csv`. Read `planning/architecture.md` when compatibility or architecture affects a path.
- Read [shared readiness guidance](../farmrpg-next-steps/references/readiness.md) before assessing candidates. Distinguish **Ready**, **Needs a decision**, **Needs evidence/data**, and **Blocked**, naming the actual gap.
- Retrieve full candidate rows, parents, children, dependency rows, and relevant linked notes. Trace prerequisites far enough to justify the proposed sequence, including textual dependencies and non-code gates.
- Use umbrellas to recover the product outcome and shipped rows as existing foundations. Recommend actionable children rather than broad umbrella tasks. Keep icebox work out unless Rebecca explicitly asks to revisit it.
- Use `planning/positioning.md` only as a secondary tie-breaker. Respect any supplied path or focus instead of reselecting unrelated work.

Keep investigation bounded. Prefer planning records over code inspection. Allow a narrow source check when a concrete uncertainty would change the recommendation; label unverified readiness honestly. Do not default to code audits, builds, external research, broad reference-data reads, or generated/cache inspection. If deeper investigation is needed, identify the gap and propose it as a separate next step.

## Build Useful Paths

- Group work around a recognizable player outcome, a necessary foundation, or a useful product increment. Do not fill a path with unrelated priorities or optional cleanup.
- Sequence executable prerequisites before dependents. Show prerequisites outside the path as blockers; show included prerequisites as part of the work rather than implying the whole path is ready immediately.
- Explain the first visible payoff, the smallest useful stopping point, and what additional work unlocks. A short path or one-item milestone can be valid.
- Separate required work from optional polish, history, or later extensions. Include manual checkpoints only when user evidence or decisions actually affect safe continuation.
- Compare player value, readiness, effort to a useful result, and completion or unlocking of work. Do not use arbitrary numerical scores, unsupported delivery estimates, or raw priority order as a substitute for judgment.
- Flag stale metadata or missing work without editing it. Any proposed new item is **not yet backlogged** and requires intake before implementation.

## Readout and Handoff

For each path, give its name and outcome, ordered backlog IDs and titles, readiness and outside prerequisites, first payoff and stopping point, optional extensions, and material tradeoffs. Explain why the grouping is coherent without repeating the same rationale in several sections.

When comparing, recommend the strongest path if evidence supports a choice. When sequencing a selected direction, focus on its order and checkpoints. Do not force three alternatives or a minimum item count. Distinguish planning-supported readiness from implementation verified through inspection.

Keep the final readout focused on the decision. Omit routine files-inspected lists, field-note status, and app-test boilerplate. Include material evidence limitations or conflicting records where they affect the choice.

End with one or both relevant handoff options, without executing them:

- **Start small:** `$farmrpg-tools-next-slice` for the first actionable ID and its bounded outcome.
- **Implement the selected path:** `$farmrpg-tools-next-slice` with the exact ordered IDs, useful stopping points, and genuine decision/evidence checkpoints.

For an unbacklogged opportunity, route first to `$farmrpg-backlog-intake`. For an unresolved gate, name the decision or evidence task instead of implying implementation is ready. A recommendation does not authorize execution of any slice or path.
