import { describe, expect, it } from 'vitest';
import { buildItemPageMaterialRows, getItemPageTargets, getVisibleItemPageMaterials, withItemPageIngredientBuildingSources } from './itemPagePlanning';
import { buildItemGoalCalculatorResult } from './itemGoalCalculator';
import { createDefaultAcquisitionPlannerInputState } from './acquisitionPlannerState';
import { createDefaultBuildingProductionState } from './buildingProductionState';
import type { BuildingProductionReferenceData } from './loadBuildingProductionReference';
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
    const cyclic = { ...result, expansionEdges: [...result.expansionEdges, { ...result.expansionEdges[0], fromCanonicalKey: 'wood', toCanonicalKey: 'a' }] };
    const cycleRows = buildItemPageMaterialRows(cyclic, graph, 'target');
    expect(cycleRows.find(entry => entry.row.canonicalKey === 'a')!.descendantKeys).not.toContain('a');
    expect(new Set(getVisibleItemPageMaterials(cycleRows, new Set(), true).map(entry => entry.row.canonicalKey)).size).toBe(cycleRows.length);
  });

  it('composes the shared sawmill planner for ingredients without altering demand or supply', () => {
    const graph = buildRecipeGraph(parseRecipesCsv('output_item_name,output_canonical_key,recipe_type,recipe_book_item_name,recipe_book_canonical_key,cooking_level,base_time,source_buddy_url,source_page_data_url,cache_file_name,parser_version,notes\nFancy Violin,fancy violin,craft'),
      parseRecipeInputsCsv('output_canonical_key,output_item_name,input_order,input_item_name,input_canonical_key,quantity,source_buddy_url,source_page_data_url,cache_file_name,parser_version,notes\nfancy violin,Fancy Violin,1,Pine Board,pine board,5'));
    const result = buildItemGoalCalculatorResult({ itemName: 'Fancy Violin', canonicalKey: 'fancy violin', currentMastery: 0, acquisitionState: createDefaultAcquisitionPlannerInputState(), modifierState: createDefaultCraftingModifierState(), recipeGraph: graph,
      settings: { goalMode: 'quantity', targetMastery: 100_000, targetQuantity: 10 } });
    const process = { productionKey: 'sawmill', buildingName: 'Sawmill', outputItemName: 'Pine Board', outputCanonicalKey: 'pine board', outputQuantity: 2, processingMinutes: 1, perkGroup: 'sawmill', evidence: 'test', notes: [], inputs: [{ itemName: 'Pine Tree', canonicalKey: 'pine tree', quantity: 1 }] };
    const reference: BuildingProductionReferenceData = { productions: [process], conversions: [], byOutputCanonicalKey: { 'pine board': [process] }, conversionsByFinalCanonicalKey: {} };
    const state = createDefaultBuildingProductionState(); state.queuedOutputByCanonicalKey['pine board'] = 20;
    const presented = withItemPageIngredientBuildingSources(result, reference, state);
    expect(presented.buildingSources[0]).toMatchObject({ buildingName: 'Sawmill', outputCanonicalKey: 'pine board', queuedOutputQuantity: 20 });
    expect(presented.plannerResult).toBe(result.plannerResult);
    expect(presented.supplyPool).toBe(result.supplyPool);
    expect(result.buildingSources).toHaveLength(0);
  });
});

