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

Next-slice runs should land completed work by default: commit, merge, and push unless you explicitly ask Codex not to.

## Durable Repo Defaults

- Next-slice work lands by default; one-off prompts do not commit unless asked.
- User-facing UI should avoid dev/debug/reference-maintenance language unless the page is explicitly internal.
- `data/` changes require clear source truth; pause on any ambiguity.
- Hosted work stays static/local-first unless explicitly scoped otherwise.

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
- commit hash and branch/push status, or why Codex did not commit
- next reasonable backlog item plus short justification

Field-note status should be one of:

- `Field note added` with a short reason
- `No field note added; this was routine implementation work`
- `Field note not written` with ready-to-paste note text, only if a note was warranted but could not be written

Only request `Blocker for Rebecca` or `Recommended test for Rebecca` sections when they are actually needed.

## Commit Guidance

For one-off prompts, Codex should not commit unless asked. When asking for a one-off commit, give an explicit command such as:

```text
Please commit this as: chore(tooling): add next-slice Codex workflow
```

For next-slice prompts, no separate commit request should be needed unless you want a specific commit message or you want Codex to stop before landing.
