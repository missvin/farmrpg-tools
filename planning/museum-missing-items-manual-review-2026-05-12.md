# Museum Missing Items Manual Review - 2026-05-12

Purpose: planning and test evidence for the museum completion follow-up work. This is not canonical reference data and should not be loaded by the app at runtime.

Source: Rebecca manually reviewed the missing slots from the personal museum Items section after the first parser/page pass could not safely name all missing items from the stale full museum list.

Raw samples preserved:

- `planning/museum-full-raw-sample-2026-05-12.txt`
- `planning/museum-me-raw-sample-2026-05-12.txt`

These are intentionally raw page-text samples, including surrounding page chrome, because that is the format parser/import workflows need to tolerate.

Summary:

- Personal museum Items section showed 907 / 963, so 56 item slots were missing.
- The manual list below has 45 written rows, with grouped rows accounting for the remaining count:
  - Certificates of Farm Giving x8
  - Farmaversary Trophies 2-6 x5
- Expanded slot count from this review: 56.
- Exact local catalog matches at the time of review: Duck Feather, Fancy Pillow, Gainite, Orange Butterfly, Painite.

Use this file for:

- Testing the manual missing-slot override workbench in BL-190.
- Checking that grouped manual entries can preserve slot counts without pretending they are individual canonical data rows.
- Seeding BL-189 acquisition-context design with real note categories such as DI, Tower, seasonal quest, flex spending, and not-yet-available.

Do not use this file for:

- Automatic updates to `data/`.
- Treating unavailable or ambiguous items as canonical identities.
- Inferring exact item IDs, Buddy slugs, or mastery eligibility.

| Missing item label | Slot count | User note | Exact local catalog match on 2026-05-12 |
|---|---:|---|---|
| Apple Basket | 1 |  | no |
| Baba Bobble | 1 |  | no |
| Banana Peel | 1 | not yet available | no |
| Beach Towel | 1 |  | no |
| Beatrix Bobblehead | 1 |  | no |
| Borgen Bobblehead | 1 |  | no |
| Brooch of the Bahltruvian Elite | 1 | Flex spending | no |
| Buddy Bobblehead | 1 |  | no |
| Buddy's School Bag | 1 |  | no |
| Cecil Bobblehead | 1 |  | no |
| Certificates of Farm Giving | 8 | grouped manual row: x8 | no |
| Charles Bobblehead | 1 |  | no |
| Cid Bobblehead | 1 |  | no |
| Corn Bread | 1 | not yet available | no |
| Cornucopia 01 | 1 |  | no |
| Cpt Thomas Bobblehead | 1 |  | no |
| Duck Egg | 1 | not yet available | no |
| Duck Feather | 1 | not yet available | yes |
| Egg of Duck | 1 | not yet available | no |
| Fall Basket | 1 |  | no |
| Fancy Pillow | 1 | not yet available | yes |
| Farmaversary Trophies 2-6 | 5 | grouped manual row | no |
| Frank Bobblehead | 1 |  | no |
| Fungus Processing and You | 1 | DI | no |
| Gainite | 1 | DI | yes |
| Gary's Diary Page 12 | 1 | DI? | no |
| Gary's Diary Page 86 | 1 | DI | no |
| Geist Bobblehead | 1 |  | no |
| Goostav Bobblehead | 1 |  | no |
| Harpoon | 1 | not yet available | no |
| Holger Bobblehead | 1 |  | no |
| Magic Lamp | 1 | not yet available-ish | no |
| Mariya Bobblehead | 1 |  | no |
| Mechanical Heart | 1 | Tower 300 | no |
| Mummy Bobblehead | 1 |  | no |
| Orange Butterfly | 1 |  | yes |
| Painite | 1 | DI | yes |
| Pearl Berry Jam | 1 | T300 quest in November | no |
| Peculiar Gem | 1 | not yet available | no |
| Raptor Chicken Egg | 1 |  | no |
| Ric Ryph Bobblehead | 1 |  | no |
| Rosalie Bobblehead | 1 |  | no |
| Santa Bobblehead | 1 | Christmas quest | no |
| Thomas Bobblehead | 1 |  | no |
| Vincent Bobblehead | 1 |  | no |
