# Openable Contents Semantics

`data/openable_contents.csv` is reviewed canonical reference data. It is not a direct dump of Buddy openable candidates.

## Quantity Kinds

- `fixed`: exact, whole-number contents that are reviewed as received every time the openable is opened.
- `expected`: expected-value contents from a reviewed random outcome pool.

Buddy candidate rows may say `fixed` when `quantity_min` equals `quantity_max`, but that only means the quantity for that candidate outcome is fixed. It does not prove the item is guaranteed every open. Broad promotion must review the openable's outcome model first.

## Expected-Value Rows

Expected-value rows must keep the assumptions visible in `notes`:

- `quantity_range=min-max`
- `outcome_count=N`
- `outcome_model=...`
- `ev_formula=...`

For equal outcome pools, use:

```text
((max - min) / 2 + min) / outcome_count
```

Example: if Borgen Bag 01 has 12 possible outcomes and Borgen Buck can appear as 1-10, the expected value is `((10 - 1) / 2 + 1) / 12`, or about `0.46` Borgen Buck per bag.

Current random openable promotion uses cached Buddy pages marked `locksmithGrabBag=true` and treats each listed outcome as equally likely. Rows without that reviewed grab-bag marker should not be promoted as expected-value rows without separate review.

## Promotion Guardrails

- Do not promote `quantity_kind=range` directly into canonical data.
- Do not copy `evidence=container_to_content` directly from `openable_contents_candidates.csv`; replace it with reviewed evidence such as `reviewed_fixed_content` or `reviewed_expected_value`.
- Keep uncertain rows out of `data/openable_contents.csv` until the outcome model is reviewed.
- Do not treat expected values as exact inventory counts in user-facing copy.
