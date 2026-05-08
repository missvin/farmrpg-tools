# Codex Prompt Boilerplate

Use this as a small reference for starting FarmRPG Codex work without repeating repo rules already covered by `AGENTS.md`.

## Next-Slice Invocation

Use the repo-local next-slice skill when you want Codex to choose and implement the next small dependency-valid backlog item:

```text
Use $farmrpg-tools-next-slice.
```

Use a one-off prompt instead when:

- you already know the exact backlog item or file to change
- the task is planning-only, review-only, docs-only, or a narrow bug report
- you want Codex to inspect something without implementing

## Standard Planning Read Block

For non-trivial implementation work, start from:

- `AGENTS.md`
- `planning/decisions.md`
- `planning/roadmap.md`
- `planning/architecture.md`
- `planning/backlog.csv`

Then read only the selected backlog row, dependency rows, and relevant planning/spec sections needed for the task.

## Lean One-Off Prompt Shape

```text
Please work on BL-###: <title>.

Scope:
- <what to change>
- <what to leave alone>

Use the standard planning read block first. Keep the change small, update the backlog row appropriately, and run relevant verification.
```

## Final Readout Expectations

Ask Codex to close with:

- files changed
- backlog item implemented/updated
- tests/lint/build run, or why not
- concise implementation summary
- suggested commit command if Codex is not committing directly
- next reasonable backlog item plus short justification

Field-note status should be one of:

- `Field note added` with a short reason
- `No field note added; this was routine implementation work`
- `Field note not written` with ready-to-paste note text, only if a note was warranted but could not be written

Only request `Blocker for Rebecca` or `Recommended test for Rebecca` sections when they are actually needed.

## Commit Guidance

Codex should not commit unless asked. When asking for a commit, give an explicit command such as:

```text
Please commit this as: chore(tooling): add next-slice Codex workflow
```
