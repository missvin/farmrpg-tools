# New Item Reference Intake

Use this checklist when FarmRPG adds visible new items before the local reference data is current. The goal is to capture evidence and review questions first, then promote only confirmed facts into `data/` in a later batch.

## Intake Steps

1. Record the observed item names in a seed CSV under `planning/new-item-intake/`.
2. Derive tentative `canonical_key` values with `toCanonicalItemKey`: normalized item name remains the canonical identity.
3. Generate a tentative Buddy slug and candidate Buddy URL from the item name using the existing slug-candidate rules. Treat this as an unverified candidate only.
4. Check whether each item already exists in `data/item_catalog.csv` or is recognized through aliases before adding new canonical rows.
5. Confirm the Buddy slug with a small, polite, cache-first scrape through the existing reference-maintenance workflow. Do not broad-crawl or repeatedly fetch sparse new-item pages.
6. Parse confirmed Buddy evidence for recipe behavior and observed icon asset URLs. Recipe and icon evidence should come from Buddy page evidence, not from the screenshot and not from slug-derived FarmRPG asset guesses.
7. Keep mastery eligibility as `unknown` until manually confirmed with Rebecca. A confirmed recipe is a strong hint that an item is likely mastery-eligible, but it should not be locked into `mastery_difficulty.csv` or `mastery_possible=true` until confirmation.
8. Leave `farmrpg_item_id`, confirmed `buddy_slug`, mastery eligibility, recipe, source, and icon fields unpromoted until reviewed evidence confirms them.
9. Promote reviewed facts in a dedicated data batch:
   - `data/item_catalog.csv` for local item recognition and optional IDs/slugs.
   - `data/mastery_difficulty.csv` only when mastery eligibility is separately confirmed.
   - `data/recipes.csv` and `data/recipe_inputs.csv` only when recipe evidence is reviewed.
   - source CSVs only when source/drop/openable/Wishing Well/pet evidence is reviewed.
   - icon observation/cache/manifest files only when an observed FarmRPG asset URL is reviewed.
10. Keep unresolved matches non-fatal and document missing evidence in the batch notes instead of guessing.

## Review Questions

- Is the item already represented under another reviewed canonical name or alias?
- Is the item masterable, non-masterable, or still unknown?
- If Buddy shows a recipe, has Rebecca manually confirmed that recipe-bearing item as mastery-eligible?
- Is there an observed FarmRPG item ID?
- Is the generated Buddy slug confirmed by a small cache-first Buddy scrape?
- Is there an observed icon asset URL, and does it differ from the Buddy slug?
- Does the item have a recipe, openable behavior, drop/source rows, or quest relevance?
- Which evidence artifact should be cited when promoting each fact?

## June 2026 Seed

The first seed created for this workflow is [new-items-2026-06-30.csv](new-item-intake/new-items-2026-06-30.csv), based on the user-provided New Items screenshot from 2026-06-30.
