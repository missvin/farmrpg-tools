# Readiness for FarmRPG recommendations

Use these rules in project resets and deeper path comparisons. They assess what can usefully happen next; they do not authorize implementation or edits.

## State the actual readiness

- **Ready:** required prerequisites are shipped and the next step is sufficiently defined.
- **Needs a decision:** name the unresolved product choice and why it matters. A small decision need not disqualify a high-value recommendation.
- **Needs evidence/data:** identify the missing input and whether Codex can obtain it independently within an authorized follow-up or Rebecca must supply it.
- **Blocked:** name unfinished executable prerequisites outside the proposed work. When prerequisites are included in a path, show their order and distinguish the ready first step from later conditional steps.

Multiple gaps can coexist. State the consequential ones; do not force a misleading single label. "No unshipped dependency IDs" does not establish readiness.

## Trace enough to justify the recommendation

- Read the candidate's full row, notes, scope, and dependencies. Follow `BL-###` dependencies recursively only as far as needed to establish a startable sequence, checking referenced rows and relevant textual requirements.
- Shipped prerequisites are foundations, not unfinished work to repeat. A shipped label supports planning readiness but is not proof of current runtime behavior or complete data coverage.
- A parent/umbrella relationship is not automatically an executable prerequisite. If a dependency names an open umbrella, inspect its purpose and child notes before deciding whether it blocks the candidate. Do not silently remove explicit dependencies.
- Flag missing IDs, cycles, ambiguous dependency text, stale status, and conflicting notes when they affect a recommendation. Do not repair planning metadata during a read-only workflow.
- Check non-code gates in notes: reviewed reference data, unresolved assumptions, user inputs, manual checks, and explicit deferrals. Separate data needed to implement a capability from values users will normally enter after it ships.

## Evidence and stopping points

- Label readiness as supported by planning records unless implementation was actually inspected. Use a bounded source check only when a specific uncertainty could change the choice. If unresolved, qualify the recommendation; do not launch an audit.
- Explain the first visible payoff and a point where work can stop usefully. Group rows because they deliver a coherent outcome or share a necessary dependency, not merely because they occupy the same area.
- Separate essential prerequisites from optional polish and later extensions. Name any manual checkpoint where it changes sequencing; leave detailed test plans to implementation unless they affect the choice.
- Prefer honest limits over invented quantities, durations, coverage claims, or certainty. Do not modify files, user state, memories, chats, or external systems while assessing readiness.
