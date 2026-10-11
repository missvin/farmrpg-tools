# Rasbit Tower PJ benchmark intake

Captured from the user-provided guide and discussion on 2026-10-11. Planning only; no recommendations have been promoted into runtime reference data.

## Intended behavior

Add a separate sortable Tower column, provisionally `Rasbit Δ`:

`row PJ remaining - selected recommendation benchmark`

Provide one global `Benchmark` selector: **Less grind / Midpoint / More grind**, defaulting to **Less grind**. Less grind uses the recommended maximum (24 for 20–24): reaching it enters the recommended range. Midpoint uses the arithmetic midpoint (22). More grind uses the recommended minimum (20): reaching it completes the ordinary grind through the range. Explain: `More grinding leaves fewer PJ needed to finish.` Avoid top/bottom labels, which reverse the apparent direction of mastery progress.

Keep half-point midpoint values. A single recommendation has equal minimum and maximum and behaves identically under every selection. Positive deltas mean above the selected benchmark; negative values mean ordinary grinding has already passed it. Sort by the numeric delta, with missing, qualitative or inapplicable recommendations last in either direction. Retain individual GM/MM requirement rows and their existing row-specific PJ estimates; do not alter deduplicated totals.

Show the original range, selected benchmark label/value, applicable condition, source date and attribution in hover/focus/tap details. This is contextual guidance, not an instruction to spend PJ, a spending allocation, affordability claim, market optimizer or replacement difficulty rating. It does not change mastery goals, materials, inventory or PJ calculations. Do not introduce an aggregate recommended-spend summary in this slice.

### Mastery threshold in tooltip

Show the ordinary mastery needed before using the selected PJ benchmark of the applicable recommendation to reach the confirmed target tier, plus the player's mastery gap to that threshold. The same selector drives both the numeric column and tooltip threshold; do not retain a separate lower-bound tooltip calculation. For 20–24, Less grind uses 24, Midpoint uses 22, and More grind uses 20 for both.

Use the existing shared PJ calculation rules to find the minimum eligible starting mastery that reaches the target with that number of PJ, including integer rounding and baseline requirements. Do not approximate by repeated division if that disagrees with the shared forward calculator. Zero PJ means the target mastery itself. For a fractional midpoint, keep its exact value for column sorting but resolve and explicitly label the whole-PJ threshold policy during implementation design; never silently round or imply a fractional PJ can be consumed. Missing tier/condition or unsupported calculations remain unavailable.

Use compact mastery formatting with one decimal place where abbreviated, e.g. `45.2k`, matching the user's example (rather than literally one significant figure). Example tooltip structure: `Less grind benchmark: 6 PJ · Mastery needed before PJ: [threshold] · [gap] mastery away`. The example 45.2k is a formatting illustration, not a validated threshold for six PJ. Compare against mastery in the same snapshot as the row; if already reached, report at/past the threshold instead of implying more grind is required. Round only the displayed mastery values, not the threshold calculation or mastery comparison.

## Replaceable source

Rasbit revises recommendations. Keep the guide as replaceable, dated, reviewed input rather than constants embedded in UI code. Preserve original min/max and qualitative text, conditions and target tier separately from the derived midpoint. Identify the active revision and retain prior source evidence when a newer user-supplied file supersedes it. Missing entries in a replacement must remain missing, not silently inherit old guidance. Never infer numeric zero from missing or qualitative recommendations.

The supplied guide says `Updated as of 10/02`; its year is not explicitly stated. Record source date separately from receipt date. Confirm intended mastery tier before comparisons: the pasted guide does not explicitly establish it. Conditional recommendations must remain unavailable until the applicable condition is known or explicitly selected; do not guess from inventory alone. A future replacement file's format and the smallest suitable review/update mechanism can be settled at implementation time; no full in-app import editor is required by this intake.

## Initial recommendation transcription

These are provisional source evidence, not validated runtime values. Grouped names must resolve individually through normalized item identity; aliases such as Bamboo Trellis require review rather than fuzzy matching. Costs and trade conversion assumptions are intentionally outside this feature.

| Item(s) | PJ recommendation | Original condition or context |
| --- | --- | --- |
| Orange Juice | 0–2 | Explore WC or convert. |
| Lemonade | 0 | Explore WC or convert. |
| Large Net | 0 | Explore Forest or convert. |
| Salt; Red Trunk; Oak Table; Canoe; Gazebo | 0 | Explore WC and upgrade Steel. |
| Water Lily | 0 | Grab Bag 01 is very useful for crafting. |
| Wizard Hat | 0 | Need Caterpillar to make Silk. |
| Yellow Butterfly; Purple Butterfly | 0–2 | It gets worse from here. |
| Pair of Boots | 0 | Cost comparison uses cookie set or Prune Juice. |
| Magus Hat | 0 | Cost ignores Antler. |
| Grand Piano | 0–2 / 3–7 | With passive Steel / otherwise. |
| Seaweed | 0–3 | |
| Frost Shield | 20 | If no need for Silver and no Frost Snapper Shell. |
| Fancy Violin | 20 | If no Moonstone. |
| Pinecone Bird Feeder | 0 | Explore Misty Forest for Crown of Clover. |
| Bamboo Chair; Bamboo Trellis | 0 | Explore Swamp for Propeller Hat. |
| Mushroom Stew | 0 | Slowly cook; otherwise three-minute taste and Fruit Punch / trash. |
| Fancy Table | 0–1 | Cost ignores Steel Vise. |
| Re'taw Pail | 0 | Get Bag of Re'taw from Borgen Mercantile. |
| Engine | Use when stuck | Hard to evaluate because there are many inputs. |
| Ship Mast | TBD | |
| Propeller Hat | 20–24 | After being done with Bamboo crafts. |
| Watermelon | 0–1 | Patreon has slightly lower cost. |
| Tie Dye Scarf | 0 | Time consuming; consider overnight CW. |
| Crown of Clover | 5–9 | Open Grab Bag 01; source cost uses three-leaf Clover trade price. |

The guide's author's personal 30-PJ usage is anecdotal, not an alternate recommendation set. The guide also calls Magus Hat, Veggie Juice, Grand Piano, Mushroom Stew, Tie Dye Scarf and Watermelon slow items worth starting early; that list does not assign missing numeric recommendations.

## Acceptance boundaries

- Verify exact values, half-point midpoints, numeric sorting and unknowns-last behavior.
- Verify all three selector choices and the Less grind default update sorting and tooltip thresholds together. Single-number recommendations remain unchanged.
- Verify the selected PJ mastery threshold against the shared forward calculator, including minimality, zero PJ, integer rounding, explicit fractional-midpoint policy, missing baseline, and already-past cases; verify one-decimal compact mastery/gap formatting.
- Verify repeated GM/MM targets retain individual estimates without affecting the shared total.
- Verify target-tier mismatch, conditional applicability, qualitative advice and absent recommendations remain explicit.
- Verify a replacement revision updates the benchmark and provenance without silently mixing guides or changing player state.
- Preserve compact table layout, keyboard/touch details, item links and current sort behavior.
- Reuse shared PJ derivation; no canonical data edits are authorized by this planning intake.
