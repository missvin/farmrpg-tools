import { describe, expect, it } from 'vitest';

import { reconcileWorkshopReferenceData } from '../../scripts/promoteFarmRpgWorkshopReferenceData.mjs';

describe('reconcileWorkshopReferenceData', () => {
  it('deduplicates against canonical data and promotes only listed outputs as masterable', () => {
    const result = reconcileWorkshopReferenceData({
      itemRows: [
        {
          observed_item_name: 'Existing Item',
          canonical_key: 'existing item',
          review_status: 'recipe_normalized_pending_reconciliation',
        },
        {
          observed_item_name: 'New Item',
          canonical_key: 'new item',
          review_status: 'recipe_normalized_pending_reconciliation',
        },
      ],
      workshopInputRows: [
        {
          output_canonical_key: 'existing item',
          input_order: '1',
          input_item_name: 'Known Input',
          input_canonical_key: 'known input',
          per_craft_quantity: '2',
        },
        {
          output_canonical_key: 'new item',
          input_order: '1',
          input_item_name: 'Input Only',
          input_canonical_key: 'input only',
          per_craft_quantity: '3',
        },
      ],
      questionRows: [],
      catalogRows: [
        {
          item_name: 'Existing Item',
          canonical_key: 'existing item',
          mastery_possible: 'no',
          source_datasets: 'old_source',
          notes: 'Earlier review.',
        },
        {
          item_name: 'Known Input',
          canonical_key: 'known input',
          mastery_possible: 'unknown',
          source_datasets: 'old_source',
          notes: '',
        },
      ],
      recipeRows: [{ output_canonical_key: 'existing item' }],
      recipeInputRows: [
        {
          output_canonical_key: 'existing item',
          input_order: '3',
          input_canonical_key: 'known input',
          quantity: '2',
        },
      ],
    });

    expect(result.catalogUpdates).toEqual([
      expect.objectContaining({
        canonical_key: 'existing item',
        mastery_possible: 'yes',
        source_datasets: 'old_source;workshop_paste_2026_08_31',
      }),
    ]);
    expect(result.catalogAdds).toEqual([
      expect.objectContaining({ canonical_key: 'new item', mastery_possible: 'yes' }),
      expect.objectContaining({ canonical_key: 'input only', mastery_possible: 'unknown' }),
    ]);
    expect(result.recipeAdds).toEqual([
      expect.objectContaining({ output_canonical_key: 'new item', recipe_type: 'craft' }),
    ]);
    expect(result.recipeInputAdds).toEqual([
      expect.objectContaining({ output_canonical_key: 'new item', input_canonical_key: 'input only', quantity: '3' }),
    ]);
    expect(result.reconciliationRows).toHaveLength(2);
  });

  it('blocks unresolved questions and conflicting canonical recipes', () => {
    const base = {
      itemRows: [{ observed_item_name: 'Item', canonical_key: 'item', review_status: 'recipe_normalized_pending_reconciliation' }],
      workshopInputRows: [{ output_canonical_key: 'item', input_order: '1', input_item_name: 'Input', input_canonical_key: 'input', per_craft_quantity: '2' }],
      catalogRows: [{ item_name: 'Item', canonical_key: 'item', mastery_possible: 'yes', source_datasets: '', notes: '' }],
      recipeRows: [{ output_canonical_key: 'item' }],
      recipeInputRows: [{ output_canonical_key: 'item', input_order: '1', input_canonical_key: 'input', quantity: '3' }],
    };

    expect(() => reconcileWorkshopReferenceData({
      ...base,
      questionRows: [{ blocking_canonical_promotion: 'yes', resolution: '' }],
    })).toThrow(/unresolved Workshop question/);

    expect(() => reconcileWorkshopReferenceData({ ...base, questionRows: [] })).toThrow(/conflicts with canonical recipe/);
  });
});
