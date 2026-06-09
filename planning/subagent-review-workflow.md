# Subagent Review Workflow

This is lightweight guidance for using Codex subagents in this repo. It is for bounded review, audit, and parallel investigation work, not a general requirement for every task.

Use the normal backlog and planning workflow first. Subagents are useful only when splitting work makes the result clearer, faster, or safer.

## When To Use Subagents

Use subagents when the work can be split into independent, bounded questions or disjoint file scopes, especially:

- large CSV or generated-artifact review
- Buddy evidence, parser-output, or promotion-candidate audits
- independent source-data spot checks
- comparing several implementation risks before one lead agent makes the final call
- parallel verification that can run while the lead agent continues non-overlapping work

Do not use subagents for:

- tiny wording or backlog edits
- single-file fixes
- tightly coupled implementation where one agent needs all context
- work that requires immediate decisions from the lead agent before the next step
- broad exploratory prompts without a concrete output contract

## Default Boundaries

Subagents should be read-only by default.

A subagent may edit files only when the lead agent gives it a bounded write scope, such as an exact file or module. Workers are not alone in the codebase; they must not revert or overwrite other work.

Unless explicitly scoped, subagents must not:

- modify `data/`
- promote canonical reference rows
- fetch external sources
- run broad or repeated network checks
- change git state
- mark backlog rows shipped

If a subagent finds a systemic issue, structural source-of-truth miss, artifact-sufficiency problem, or dependency gap, it should stop and report rather than continuing a wider review.

## Worktree Guidance

Use separate worktrees when a subagent may edit files or when multiple agents are reviewing different generated artifacts in parallel.

Do not bother with a separate worktree for small read-only questions. For read-only review, a normal subagent thread is usually enough.

Before deleting or closing a worktree, confirm that:

- needed findings are copied into the lead thread or a committed artifact
- any useful changes are committed, merged, or intentionally abandoned
- no branch contains unreviewed changes that should be preserved

## Worker Output Contract

Ask each subagent for a compact report with:

- scope reviewed
- files or artifacts inspected
- findings grouped by action type
- risk rating for each finding
- evidence or example rows
- whether Rebecca review is needed
- recommended next action

For data-review work, prefer a table shaped like:

| Finding | Evidence | Risk | Recommendation | Needs Rebecca review |
| --- | --- | --- | --- | --- |

Keep raw row dumps out of the main answer unless they are necessary to prove the finding.

## Lead Agent Responsibilities

The lead agent owns the final answer and any repo edits.

The lead should:

- assign narrow, non-overlapping subagent tasks
- avoid duplicating subagent work locally unless verification is necessary
- synthesize findings into confirmed impact, possible impact, and next action
- decide what becomes backlog, code, data review, or user review
- keep the final readout easy for Rebecca to respond to

For material misses, follow `planning/failure-recovery-protocol.md` before resuming.

## Lifecycle Hygiene

Close or archive subagents when their work is done.

Before closing, preserve anything useful in the lead thread, a planning note, a committed artifact, or a backlog row. Keep subagents open only while they have a bounded active assignment or unresolved follow-up question.

If the Codex UI shows old subagents that are no longer live, treat them as stale thread history. Archive or close them in the UI when possible; do not assume they are still running unless the agent management tool can find them.

## Minimal Prompt Pattern

```text
You are a read-only subagent for farmrpg-tools. Review only <specific file/artifact/scope>. Do not edit files, modify data/, fetch external sources, or change git state. If you find a systemic issue, stop after confirming it and report. Return: scope reviewed, findings by action type, risk, evidence examples, recommendation, and whether Rebecca review is needed.
```

