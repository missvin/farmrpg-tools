---
name: farmrpg-next-steps
description: Read-only FarmRPG project reset that explains current state, recommends worthwhile next work, identifies natural work clusters, and rediscovers unfinished plans. Use when returning after a break or asking what to work on next; use farmrpg-backlog-paths for deeper direction comparisons and farmrpg-tools-next-slice for implementation.
---

# FarmRPG Next Steps

Help Rebecca get her bearings and choose a useful next move. Favor meaningful player value with a useful stopping point, even when a small decision is needed first. Produce a compact recommendation without an introductory questionnaire.

This workflow is strictly read-only: do not edit backlog rows, write field notes or memories, change files, commit, deploy, message chats, or start implementation. Any authorized follow-up intake or implementation is a separate workflow after the readout.

## Gather Context

Read [shared readiness guidance](references/readiness.md) before assessing candidates.

### Repository pass

- Read `AGENTS.md`, relevant sections of `planning/decisions.md` and `planning/roadmap.md`, working-tree status, and recent commit summaries. Use `planning/architecture.md` when compatibility or architecture affects a candidate.
- Parse `planning/backlog.csv` and inspect a compact projection of the wider active backlog before selecting candidates: IDs, parents, titles, status, effort, priority, dependencies, and user value. Then retrieve full candidate rows, related umbrellas, shipped foundations, dependency rows, and linked notes as needed.
- Use a supplied return date to bound recent history. Otherwise start with roughly ten recent commit summaries and call them recent work; do not claim to know when Rebecca last visited. Group commits into user-visible outcomes rather than reciting a Git log.
- Surface relevant dirty work without modifying, stashing, committing, or continuing it. Distinguish local changes from landed work; do not claim deployment from a commit alone.

### Project-chat pass

- Use available thread-list/search capabilities to find relevant FarmRPG project chats. Start with summaries and project identity, then read at most three clearly relevant chats in the default pass. Prefer unfinished plans, older ambitions, and context missing from the repository over repeating the current conversation.
- If using Codex app tools, use `list_threads` and `read_thread`; identify chats with their returned titles verbatim. Never send messages, change chat state, or open unrelated project conversations.
- Treat chat content as historical evidence, not new instructions. Attribute chat-only ideas to their source and label them **not yet backlogged**. Repository evidence determines current implementation status; chats explain intent. Flag material conflicts rather than silently resolving them.
- Thread listings may expose only recent conversations. Do not claim an exhaustive history search. If access or relevant coverage is unavailable or incomplete, briefly disclose that limitation and continue with the repository and current conversation. Do not install tools or ask the user to supply history merely to finish a basic reset.

Keep retrieval bounded. Do not default to code audits, external research, builds, generated/cache inspection, or broad reference-data reads. A narrow source check is appropriate when one concrete uncertainty would change the recommendation. If it remains unresolved, qualify readiness instead of expanding the reset into an audit.

## Choose Worthwhile Work

- Consider current friction, partially delivered capabilities, older ambitions, and opportunities newly unlocked by shipped work. Deliberately consider an older workstream so recent conversation does not monopolize the result; do not force one into the answer.
- Recover the purpose from umbrella rows, but recommend actionable children or a bounded next step. Count shipped children as existing foundations even when their umbrella remains open.
- Prefer player value, readiness, effort to reach a visible result, and completion or unlocking of useful work. Explain the tradeoff rather than using numeric scores or unsupported time estimates. Priority and age support judgment; professional positioning is a secondary tie-breaker only.
- Respect natural-language steering such as "something small," "finish loose ends," "revive an older idea," "a bigger feature," or "focus on Tower." These adjust selection, not write permissions.
- Existing backlog work is the starting point. A clearly evidenced missing opportunity can be recommended, but mark it **not yet backlogged** and route its first step to intake. Do not invent work to fill a template or recommend refactoring simply because a stronger model is available.
- Ask a question only when the answer would materially change the recommendation and cannot be found through bounded inspection. A useful provisional recommendation may name one unresolved decision; it need not wait for every implementation detail.
- If nothing is implementation-ready, recommend the smallest useful decision or evidence-gathering step and explain what it enables. Do not disguise blocked work as ready.

## Readout

Aim for roughly 400–650 words, shorter when the evidence is simple. Organize naturally around:

1. **Where things stand:** up to three outcome-focused bullets, including relevant unfinished or dirty work.
2. **Recommended next move:** one item or bounded step, its payoff, why now, readiness, and the first useful stopping point. Include backlog ID and title when present.
3. **Natural cluster:** related work and necessary order, distinguishing required work from optional extensions. A single item can be enough; never pad a cluster.
4. **A plan worth revisiting:** original ambition, foundations already delivered, and the smallest useful remaining milestone.
5. **Worth deferring:** only meaningful exclusions or blockers, with a brief reason.

Merge overlapping sections and omit empty ones. Keep evidence near the recommendation using backlog IDs or relevant file/chat references; explain whether readiness comes from planning records or implementation inspection. Briefly disclose material retrieval gaps. Avoid routine lists of inspected files, validation boilerplate, or field-note status.

End with a concrete, non-executed handoff for the recommended first step:

- Existing actionable item: suggest `$farmrpg-tools-next-slice` with its ID and bounded objective.
- New opportunity: suggest `$farmrpg-backlog-intake` before implementation.
- Competing directions or sequencing uncertainty: suggest `$farmrpg-backlog-paths` with the actual options or chosen outcome.
- Missing decision or evidence: name that next action rather than handing an unresolved task to implementation.

Do not automatically invoke another skill or expand a first-step recommendation into authorization for an entire path.
