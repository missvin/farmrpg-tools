# ClientCoin mastery ratings and history

Original workbook archived unchanged on 2026-10-04, including all 22 tabs, formulas, formatting, and history. SHA256: b2a0e59d43d1ec11846c013bf660498a9310f1733fdc731bff738d2bd0e2e852.

First tab: `20251125 Ranked by Tower, MM`. Column H is ClientCoin difficulty; D/E/F are community M/GM/MM counts; J is the weighted score. There are 497 named rows with numeric ratings, all matching the 607-item confirmed-masterable catalog; 110 masterable items are absent. Approved aliases were applied for matching. No runtime reference files were changed.

User-supplied rule: Score = MM*10000 + GM*10 + M. Rating = 13 - ROUNDDOWN(LOG(Score,4),0), with limited-time items forced to 13. The workbook implements the override through King's rating G=11, rather than the Event flag. Preserve that distinction for review. Formula discrepancies against cached H: 3. Board evaluates to -1; do not silently clamp it. Zero score has no defined logarithmic rating unless an explicit override applies.

The filename says last update May 27, 2026, and the first tab's displayed date says 20251125. Its Board M/GM/MM counts match the May 27 export. A separate September 1, 2026 export exists. Do not label column H as September-current or recalculate it from that later snapshot without a separate decision.

Files: first-tab-ratings.csv preserves the extracted ratings and score components; missing-masterable-ratings.csv is a fill-in list; sheet-index.csv inventories the workbook tabs. Historical raw workbook remains the source of truth. Missing ratings are not zero counts. No new seasonal classification, source rates, or aliases were inferred.

Potential uses: community MM completion velocity per day, dates when items cross difficulty thresholds, newly attainable or bottleneck items, and community-versus-personal rarity comparisons. Compare equal date windows and separate item age/seasonality from intrinsic difficulty.
