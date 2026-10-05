import { describe, expect, it } from 'vitest';
import { buildItemPageMaterialRows, getItemPageTargets, getVisibleItemPageMaterials } from './itemPagePlanning';
import { resolveItemProfile } from './itemProfileResolver';
import { buildRecipeGraph, parseRecipesCsv, parseRecipeInputsCsv } from './loadRecipeGraph';
import { buildTargetOutputPlannerResult } from './targetOutputPlannerEngine';
import { createDefaultCraftingModifierState } from './craftingModifierState';

describe('item page planning presentation', () => {
  it('offers explicit mastery eligibility and falls back to quantity', () => {
    const profile = resolveItemProfile({ canonicalKey: 'unknown' });
    expect(getItemPageTargets(profile, false).map(target => target.id)).toEqual(['custom-quantity']);
    expect(getItemPageTargets(profile, true)[0].amount).toBe(10_000);
    expect(getItemPageTargets({ ...profile, currentMastery: 1_000_000 }, true)[0].id).toBe('custom-quantity');
  });

  it('retains shared engine totals once when expanding converging ingredient paths', () => {
    const graph = buildRecipeGraph(parseRecipesCsv('output_item_name,output_canonical_key,recipe_type,recipe_book_item_name,recipe_book_canonical_key,cooking_level,base_time,source_buddy_url,source_page_data_url,cache_file_name,parser_version,notes\nTarget,target,craft\nA,a,craft\nB,b,craft'),
      parseRecipeInputsCsv('output_canonical_key,output_item_name,input_order,input_item_name,input_canonical_key,quantity,source_buddy_url,source_page_data_url,cache_file_name,parser_version,notes\ntarget,Target,1,A,a,2\ntarget,Target,2,B,b,3\na,A,1,Wood,wood,4\nb,B,1,Wood,wood,5'));
    const result = buildTargetOutputPlannerResult({ goals: [{ targetId: 'test', itemName: 'Target', canonicalKey: 'target', desiredQuantity: 10 }], recipeGraph: graph,
      modifierState: createDefaultCraftingModifierState(), supplyPool: { items: [], byCanonicalKey: {}, warnings: [] } });
    const rows = buildItemPageMaterialRows(result, graph, 'target');
    expect(getVisibleItemPageMaterials(rows, new Set(), false).map(entry => entry.row.canonicalKey)).toEqual(['a', 'b']);
    const expanded = getVisibleItemPageMaterials(rows, new Set(['a', 'b']), false);
    expect(expanded.filter(entry => entry.row.canonicalKey === 'wood')).toHaveLength(1);
    expect(expanded.find(entry => entry.row.canonicalKey === 'wood')!.row).toBe(result.rowsByCanonicalKey.wood);
    expect(expanded.find(entry => entry.row.canonicalKey === 'wood')!.parentKeys.sort()).toEqual(['a', 'b']);
    expect(getVisibleItemPageMaterials(rows, new Set(), true)).toEqual(rows);
    expect(getVisibleItemPageMaterials(rows, new Set(), false)).toHaveLength(2);
  });
});

