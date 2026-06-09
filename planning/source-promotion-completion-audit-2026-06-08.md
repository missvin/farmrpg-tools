# Source Promotion Completion Audit - 2026-06-08

## Scope

This audit closes `BL-265` by checking whether the `BL-251` current-universe recipe and source promotion umbrella still has unclear in-progress work after its child rows shipped.

The audit used the complete local Buddy evidence cache at `probe-output/buddy-item-evidence-cache-current-2026-06-04`. No network fetches, canonical data promotion, or `mastery_difficulty.csv` edits were performed for this audit.

## Validation

Run:

```powershell
node scripts\auditCurrentUniverseSourcePromotion.mjs
```

Result on 2026-06-08: pass.

## Coverage Summary

| Area | Fan-out rows | Canonical rows | Status |
| --- | ---: | ---: | --- |
| Evidence manifest | 1,461 | n/a | Complete current museum universe cache from `BL-253`. |
| Item catalog | 1,461 | 1,461 | Covered by the current-universe catalog-recognition batch under `BL-251`. |
| Icons | 1,461 | 1,461 | Covered by `BL-250`; relevant to current-universe reference readiness but outside direct `BL-251` source promotion. |
| Recipes | 273 | 273 | Covered by shipped `BL-259`. |
| Recipe inputs | 998 | 998 | Covered by shipped `BL-259`. |
| Drop rates | 1,244 | 1,244 | Covered by shipped `BL-260`. |
| Pet sources | 336 | 336 | Covered by shipped `BL-242`; moved out of the `BL-251` child lane but closes the pet-source coverage dependency. |
| Fixed openable contents | 897 candidate rows | 634 promoted rows | Covered by shipped `BL-261` and `BL-262` for reviewed fixed contents. |
| Wishing Well | 361 | 361 | Covered by the Wishing Well promotion batch under `BL-251`; quantity remains defaulted where Buddy exposes chance but not quantity. |
| Source hints | 1,258 | 1,262 | Covered by shipped `BL-263`; the 4 extra canonical rows are preserved reviewed seed hints. |
| Aliases | n/a | 89 | Covered by shipped `BL-264`. |

## Confirmed Remaining Work

- `263` random/grab-bag openable outcome candidates remain intentionally unpromoted as exact supply. This is correct: the openable guardrails define those as expected-value work, not fixed contents.
- A follow-up row, `BL-269`, tracks reviewing and promoting random openable expected-value rows when that source type becomes useful enough to support.
- Sparse or blank Buddy pages remain handled by the existing freshness/recheck flow from `BL-244`; they are not hidden inside `BL-251`.
- Wishing Well reward quantity remains an explicit defaulted assumption where the local evidence only proves chance, not quantity.

## BL-251 Closure

`BL-251` can be marked shipped because its scoped current-universe source-promotion child batches are complete and the remaining source-shape gap is explicitly tracked as follow-up work instead of being left inside an unclear umbrella.

This closure does not mean every possible Buddy-derived source type is now canonical. It means the current reviewed promotion batches for catalog recognition, recipes, recipe inputs, drop rates, fixed openables, Wishing Well, source hints, aliases, and pet-source coverage have landed, and known exclusions are documented.
