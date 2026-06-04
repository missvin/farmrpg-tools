# Failure-Recovery Protocol

This protocol tells Codex what to do when a significant workflow miss is discovered during AI-assisted work in this repo.

It is intentionally lightweight. It is not an incident-management system, a retrospective template, or a reason to stop for ordinary implementation friction.

## When To Stop

Stop forward implementation and use this protocol when a material assumption, prerequisite, artifact, dependency, or source-of-truth issue undermines trust in the current path.

Common triggers:

- a required artifact or source input is missing after work has begun
- a backlog row dependency or precondition is not actually satisfied
- work marked or about to be marked shipped does not cover the scope downstream rows require
- a canonical source-of-truth boundary is violated or worked around
- generated output is only a seed, sample, or partial artifact but was treated as a sufficient corpus
- the user catches a material flaw in claimed-complete work
- validation reveals a structural issue rather than an isolated lint, test, or typo failure
- an environment workaround could affect trust in outputs, artifacts, or verification

Do not trigger this protocol for:

- ordinary lint or test failures with a clear local fix
- small copy, typo, formatting, or import mistakes
- expected missing reference-data matches already handled as non-fatal warnings
- routine local environment friction that does not affect output trust
- narrow implementation bugs that do not undermine dependencies, artifacts, or shipped claims

## Required Recovery Loop

When triggered:

1. Stop forward implementation.
2. Name the failed assumption or missing prerequisite.
3. Identify affected backlog items, files, generated artifacts, and downstream work.
4. Separate confirmed impact from possible impact.
5. Recommend a targeted validation or audit pass.
6. Propose the smallest process, documentation, test, backlog, or workflow improvement that would reduce recurrence.
7. Resume only after the recovery path is clear and the user understands what was checked and what remains uncertain.

## Readout Template

Use this compact readout before resuming normal work:

```text
Failed assumption:

Confirmed impact:

Possible impact:

Targeted audit:

Recommended guardrail:

Resume criteria:
```

Keep the readout factual and scoped. Do not invent certainty. Do not expand the audit beyond the likely blast radius unless new evidence justifies it.

## Example: Seed Artifact Treated As A Full Corpus

The Buddy evidence workflow first produced a small seed cache that proved the cache process worked. Later planning treated that seed artifact as though it satisfied downstream rows that required a full current-universe Buddy evidence cache.

The failed assumption was artifact sufficiency: "seed artifact exists" was treated as equivalent to "sufficient corpus exists." The confirmed impact was dependency drift in rows that needed the full corpus before parsers, source promotion, and pet/source coverage could be trusted. The possible impact was broader source-data risk in downstream plans that referenced the incomplete artifact.

Under this protocol, Codex should have stopped before continuing source-parser work or marking downstream work unblocked. The recovery path would have been to distinguish seed, reviewed sample, and sufficient corpus artifacts; review affected backlog dependencies and shipped claims; add or adjust the full-universe artifact rows; and resume only once the full-cache dependency path was explicit.

## Smallest Effective Guardrails

Prefer the smallest guardrail that addresses the miss:

- update a backlog dependency or row note when planning truth drifted
- add a short pointer in `AGENTS.md` or a repo-local skill when agent behavior needs to change
- add a focused validation check when an artifact can be mechanically verified
- add a planning/reconciliation pass when the blast radius is mostly backlog or roadmap truth

Do not add process for its own sake. Avoid severity taxonomies, owner matrices, incident logs, or broad retrospectives unless the project later grows enough to need them.
