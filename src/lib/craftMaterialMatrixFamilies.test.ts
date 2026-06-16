import { describe, expect, it } from 'vitest';

import type { CraftMaterialMatrixRow } from './craftMaterialMatrix';
import { classifyCraftMaterialMatrixRow } from './craftMaterialMatrixFamilies';

function makeRow(overrides: Partial<CraftMaterialMatrixRow>): CraftMaterialMatrixRow {
  const outputItemName = overrides.outputItemName ?? 'Test Output';
  const outputCanonicalKey = overrides.outputCanonicalKey ?? outputItemName.toLowerCase();

  return {
    seedItemName: 'Red Dye',
    seedCanonicalKey: 'red dye',
    outputItemName,
    outputCanonicalKey,
    outputProfilePath: `/items/${outputCanonicalKey}`,
    recipeType: 'craft',
    pathType: 'direct',
    depth: 0,
    consumedSeedQuantity: 1,
    outputRecipe: {
      outputItemName,
      outputCanonicalKey,
      recipeType: 'craft',
      recipeBookItemName: null,
      recipeBookCanonicalKey: null,
      cookingLevel: null,
      baseTime: null,
      sourceBuddyUrl: '',
      inputs: [{ inputOrder: 1, itemName: 'Red Dye', canonicalKey: 'red dye', quantity: 1 }],
    },
    matchedInput: { inputOrder: 1, itemName: 'Red Dye', canonicalKey: 'red dye', quantity: 1 },
    intermediateOutput: null,
    path: [
      {
        inputItemName: 'Red Dye',
        inputCanonicalKey: 'red dye',
        outputItemName,
        outputCanonicalKey,
        quantity: 1,
      },
    ],
    currentMastery: 0,
    matchedSnapshotRow: false,
    towerRelevant: false,
    towerTargets: [],
    ...overrides,
  };
}

describe('classifyCraftMaterialMatrixRow', () => {
  it('classifies color family outputs by item name', () => {
    expect(classifyCraftMaterialMatrixRow(makeRow({ outputItemName: 'Red Shirt' })).id).toBe('shirt');
    expect(classifyCraftMaterialMatrixRow(makeRow({ outputItemName: 'Purple Scarf' })).id).toBe('scarf');
    expect(classifyCraftMaterialMatrixRow(makeRow({ outputItemName: 'Green Shield' })).id).toBe('shield');
    expect(classifyCraftMaterialMatrixRow(makeRow({ outputItemName: 'White Purse' })).id).toBe('purse');
    expect(classifyCraftMaterialMatrixRow(makeRow({ outputItemName: 'Blue Butterfly' })).id).toBe('butterfly');
    expect(classifyCraftMaterialMatrixRow(makeRow({ outputItemName: 'Brown Bag' })).id).toBe('bag');
  });

  it('keeps explicit color craft exceptions in useful families', () => {
    const family = classifyCraftMaterialMatrixRow(
      makeRow({
        seedItemName: 'Black Twine',
        seedCanonicalKey: 'black twine',
        outputItemName: 'Black Cloak',
        outputCanonicalKey: 'black cloak',
        matchedInput: { inputOrder: 1, itemName: 'Black Twine', canonicalKey: 'black twine', quantity: 1 },
        outputRecipe: {
          outputItemName: 'Black Cloak',
          outputCanonicalKey: 'black cloak',
          recipeType: 'craft',
          recipeBookItemName: null,
          recipeBookCanonicalKey: null,
          cookingLevel: null,
          baseTime: null,
          sourceBuddyUrl: '',
          inputs: [{ inputOrder: 1, itemName: 'Black Twine', canonicalKey: 'black twine', quantity: 1 }],
        },
        path: [
          {
            inputItemName: 'Black Twine',
            inputCanonicalKey: 'black twine',
            outputItemName: 'Black Cloak',
            outputCanonicalKey: 'black cloak',
            quantity: 1,
          },
        ],
      }),
    );

    expect(family.id).toBe('cloak');
  });

  it('routes ambiguous color-adjacent uses to practical other buckets', () => {
    expect(classifyCraftMaterialMatrixRow(makeRow({ outputItemName: 'Fancy Pipe' })).id).toBe('other_dye_uses');

    expect(
      classifyCraftMaterialMatrixRow(
        makeRow({
          seedItemName: 'Orange Twine',
          seedCanonicalKey: 'orange twine',
          outputItemName: 'Signal Kite',
          outputCanonicalKey: 'signal kite',
          matchedInput: { inputOrder: 1, itemName: 'Orange Twine', canonicalKey: 'orange twine', quantity: 1 },
          outputRecipe: {
            outputItemName: 'Signal Kite',
            outputCanonicalKey: 'signal kite',
            recipeType: 'craft',
            recipeBookItemName: null,
            recipeBookCanonicalKey: null,
            cookingLevel: null,
            baseTime: null,
            sourceBuddyUrl: '',
            inputs: [{ inputOrder: 1, itemName: 'Orange Twine', canonicalKey: 'orange twine', quantity: 1 }],
          },
          path: [
            {
              inputItemName: 'Orange Twine',
              inputCanonicalKey: 'orange twine',
              outputItemName: 'Signal Kite',
              outputCanonicalKey: 'signal kite',
              quantity: 1,
            },
          ],
        }),
      ).id,
    ).toBe('colored_twine_uses');

    expect(
      classifyCraftMaterialMatrixRow(
        makeRow({
          seedItemName: 'Orange',
          seedCanonicalKey: 'orange',
          outputItemName: 'Orange Dye',
          outputCanonicalKey: 'orange dye',
          matchedInput: { inputOrder: 1, itemName: 'Orange', canonicalKey: 'orange', quantity: 1 },
          outputRecipe: {
            outputItemName: 'Orange Dye',
            outputCanonicalKey: 'orange dye',
            recipeType: 'craft',
            recipeBookItemName: null,
            recipeBookCanonicalKey: null,
            cookingLevel: null,
            baseTime: null,
            sourceBuddyUrl: '',
            inputs: [{ inputOrder: 1, itemName: 'Orange', canonicalKey: 'orange', quantity: 1 }],
          },
          path: [
            {
              inputItemName: 'Orange',
              inputCanonicalKey: 'orange',
              outputItemName: 'Orange Dye',
              outputCanonicalKey: 'orange dye',
              quantity: 1,
            },
          ],
        }),
      ).id,
    ).toBe('dye');
  });
});
