# UX Audits

This folder stores saved UX audit artifacts for the repository.

These files are planning evidence and review artifacts. They preserve what was reviewed, what was found, and how the findings were dispositioned at that time.

Backlog rows remain the place for committed work. A saved UX audit does not automatically mean the findings are scheduled.

## What belongs here

- Whole-app UX audits
- Focused page or workflow UX audits
- Shell or navigation reviews
- Dense-table or warning-state reviews that are important enough to preserve beyond chat history

Do not use this folder for implementation notes, speculative redesigns, or routine coding task logs.

## Naming

Use date-based filenames:

- `YYYY-MM-DD-whole-app-ux-audit.md`
- `YYYY-MM-DD-shell-navigation-audit.md`
- `YYYY-MM-DD-import-flow-audit.md`

Prefer concise, scope-based names after the date. Use hyphens, not underscores.

## Disposition workflow

Each saved audit should include a small disposition section after the recommendations.

Use one simple outcome label per finding:

- `backlog-now`: strong enough to justify an immediate backlog candidate because it is a real bug, a no-brainer usability defect, or missing foundational UX support needed by multiple pages
- `already-covered`: meaningfully covered by an existing backlog row, roadmap direction, or already-shipped work, even if some polish may still remain
- `defer`: worth revisiting later, but not a current backlog commitment
- `no-action`: reviewed and intentionally not pursued
- `fixed-directly`: resolved immediately during the audit or follow-up because the issue was truly obvious and faster to fix than to describe

The disposition step is meant to keep audits useful without turning them into backlog spam.

## Relationship To Backlog

Saved audits are evidence.

Backlog rows are committed work.

Use the audit to inform backlog decisions, but only create or recommend backlog items when a finding clearly meets the bar described above. Most findings should stay in the audit artifact unless and until the team chooses to schedule them.

When a finding maps to an existing backlog row, prefer `already-covered` and reference that row rather than creating a duplicate.

## Recommended Document Structure

Saved audit documents should include:

1. Title
2. Date
3. Scope
4. Inputs reviewed
5. Overall assessment
6. Prioritized findings
7. Strengths
8. Recommendation summary
9. Backlog recommendation check
10. Disposition table

You can copy the reusable template in [TEMPLATE.md](/C:/Users/liqui/Documents/farmrpg-tools/planning/ux-audits/TEMPLATE.md).

## Minimal Template

```md
# Title

- Date: YYYY-MM-DD
- Scope: ...
- Inputs reviewed:
  - ...

## Overall assessment

...

## Prioritized findings

### 1. Finding title
- Severity: `P1`
- Confidence: `high`
- Implementation size: `small`
- What feels confusing/clunky: ...
- Why it matters: ...
- What kind of fix would likely help: ...

## Strengths

- ...

## Recommendation summary

### Bugs / no-brainer fixes
- ...

### High-value polish opportunities
- ...

### Later / nice-to-have ideas
- ...

## Backlog recommendation check

...

## Disposition table

| Finding | Outcome | Backlog / reference | Notes |
| --- | --- | --- | --- |
| ... | `defer` |  | ... |
```
