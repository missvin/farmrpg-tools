import { describe, expect, it } from 'vitest';

import {
  deriveWorkshopRecipeQuantities,
  parseFarmRpgWorkshopPaste,
} from '../../scripts/lib/farmRpgWorkshopPaste.mjs';

describe('deriveWorkshopRecipeQuantities', () => {
  it('normalizes the supplied Acid Extract example by the uniquely derived craft count', () => {
    const result = deriveWorkshopRecipeQuantities([
      { inputItemName: 'Horned Beetle', inventoryQuantity: 10081, displayedRequiredQuantity: 15 },
      { inputItemName: 'Glass Bottle', inventoryQuantity: 6230, displayedRequiredQuantity: 5 },
      { inputItemName: 'Pestle and Mortar', inventoryQuantity: 5, displayedRequiredQuantity: 5 },
    ]);

    expect(result.status).toBe('ready');
    expect(result.derivedCraftQuantity).toBe(5);
    expect(result.inputs.map((input) => input.perCraftQuantity)).toEqual([3, 1, 1]);
  });

  it('correctly normalizes the earlier Tin Goblet totals', () => {
    const result = deriveWorkshopRecipeQuantities([
      { inputItemName: 'Stone', inventoryQuantity: 10714, displayedRequiredQuantity: 10712 },
      { inputItemName: 'Tin Scraps', inventoryQuantity: 32180, displayedRequiredQuantity: 10712 },
    ]);

    expect(result.derivedCraftQuantity).toBe(2678);
    expect(result.inputs.map((input) => input.perCraftQuantity)).toEqual([4, 4]);
  });

  it('treats displayed requirements as one-craft quantities when the UI craft count is zero', () => {
    const result = deriveWorkshopRecipeQuantities([
      { inputItemName: 'Unpolished Peridot', inventoryQuantity: 0, displayedRequiredQuantity: 2 },
    ]);

    expect(result.derivedCraftQuantity).toBe(0);
    expect(result.inputs[0].perCraftQuantity).toBe(2);
  });
});

describe('parseFarmRpgWorkshopPaste', () => {
  it('parses and deduplicates craftable outputs inside the Workshop section', () => {
    const result = parseFarmRpgWorkshopPaste(`
Farm RPG
Items that you can craft are below.
heart_fill
Acid Extract (1)
10,081 / 15 Horned Beetle
6,230 / 5 Glass Bottle
5 / 5 Pestle and Mortar
heart_fill
Peridot (0)
0 / 2 Unpolished Peridot
heart_fill
Peridot (0)
0 / 2 Unpolished Peridot
Consume a meal
`);

    expect(result.summary).toMatchObject({
      outputCount: 2,
      readyOutputCount: 2,
      ingredientRowCount: 4,
      questionCount: 0,
    });
    expect(result.outputs[0]).toMatchObject({
      outputItemName: 'Acid Extract',
      derivedCraftQuantity: 5,
    });
  });
});
