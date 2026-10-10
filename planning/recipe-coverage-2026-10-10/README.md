# Missing recipe coverage review — BL-386

Checked on 2026-10-10 after the user reported Acid Extract's empty Tower ingredients and Re'taw's missing icon.

## Coverage

- All 273 recipe outputs and 998 ingredient rows in the June 4 cached Buddy promotion candidates already match local data after normalizing item names. No omissions or quantity differences found in that batch.
- Checked live Buddy page-data for all 296 catalog items marked masterable that had no local recipe before this repair. Requests were sequential and spaced by at least 500ms. Exact item-name matches were required; all 296 succeeded.
- 15 had complete crafting recipes; 281 reported neither crafting nor cooking. No missing cooking recipes were found in this population. This is a missing-output audit, not a fresh comparison of every already-imported recipe or every non-masterable item's current page.
- All inputs for the 15 confirmed recipes already exist in the canonical catalog. Added 15 recipe outputs and 61 ingredient rows; existing recipes, eligibility, source rates and seasonal classifications were preserved.

`audit.csv` records every checked item, source URL and observed craft/cook flags. `confirmed-recipes.json` preserves the reviewed recipe inputs from those public source responses. Recipe presence does not establish seasonal availability.

## Recipes added

Acid Extract; Ancient Bird Fossil; Ancient Ram Fossil; Cave Paste; Flarite Ring; Green Halite Earrings; Green Halite Ring; Heavy Pickaxe; Ocean Stone; Pumpkin Spiced Milk; QED Cell; Sparkle Dust; Spooky Scarecrow; Witch's Brew; Witch's Broom.

Acid Extract's direct recipe is Pestle and Mortar ×1, Glass Bottle ×1 and Horned Beetle ×3. Ocean Stone now exposes Acid Extract as a deeper planning dependency.

## Icon repair

The downloaded Re'taw icon was indexed under legacy `re taw`. The runtime icon adapter now derives canonical keys from item names with the existing shared normalizer, preserving apostrophes and hyphens consistently with the catalog. It retains ready-status, asset-existence and first-entry duplicate safeguards. No player storage or canonical identity rules changed.
