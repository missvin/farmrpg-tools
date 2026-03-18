import { describe, expect, it } from 'vitest';

import {
  generateCanonicalRecipeData,
  toCanonicalRecipeInputsCsv,
  toCanonicalRecipesCsv,
  validateCanonicalRecipeData,
} from '../../scripts/lib/generateCanonicalRecipeData.mjs';

describe('generateCanonicalRecipeData', () => {
  it('builds canonical recipe and input rows from reconciled intermediate outputs', () => {
    const canonicalData = generateCanonicalRecipeData(
      JSON.stringify({
        results: [
          {
            itemName: 'Fancy Pipe',
            candidateBuddyUrl: 'https://buddy.farm/i/fancy-pipe/',
            extractionStatus: 'recipe_found',
            recipeType: 'craft',
            recipe: {
              recipeBookItem: null,
              parameters: [],
              ingredients: [
                { itemName: 'Wood', quantity: 10 },
                { itemName: 'Coal', quantity: 2 },
              ],
            },
          },
          {
            itemName: 'Quandary Chowder',
            candidateBuddyUrl: 'https://buddy.farm/i/quandary-chowder/',
            extractionStatus: 'recipe_found',
            recipeType: 'cooking',
            recipe: {
              recipeBookItem: { itemName: "Jill's Quandary Chowder" },
              parameters: [
                { label: 'Cooking Level', value: '25' },
                { label: 'Base Time', value: '4h' },
              ],
              ingredients: [{ itemName: 'Salt', quantity: 1 }],
            },
          },
          {
            itemName: 'Wood',
            candidateBuddyUrl: 'https://buddy.farm/i/wood/',
            extractionStatus: 'no_recipe',
            recipeType: null,
            recipe: null,
          },
        ],
      }),
      JSON.stringify({
        summary: { unmatchedCount: 0, ambiguousCount: 0 },
        entities: [
          { normalizedKey: 'fancy pipe', matchStatus: 'matched', matchedUniverseRow: { itemName: 'Fancy Pipe', canonicalKey: 'fancy pipe' } },
          { normalizedKey: 'wood', matchStatus: 'matched', matchedUniverseRow: { itemName: 'Wood', canonicalKey: 'wood' } },
          { normalizedKey: 'coal', matchStatus: 'matched', matchedUniverseRow: { itemName: 'Coal', canonicalKey: 'coal' } },
          { normalizedKey: 'quandary chowder', matchStatus: 'matched', matchedUniverseRow: { itemName: 'Quandary Chowder', canonicalKey: 'quandary chowder' } },
          { normalizedKey: "jill's quandary chowder", matchStatus: 'matched', matchedUniverseRow: { itemName: "Jill's Quandary Chowder", canonicalKey: "jill's quandary chowder" } },
          { normalizedKey: 'salt', matchStatus: 'matched', matchedUniverseRow: { itemName: 'Salt', canonicalKey: 'salt' } },
        ],
      }),
    );

    expect(canonicalData.summary).toEqual({
      totalRecipes: 2,
      totalRecipeInputs: 3,
      excludedNonRecipePages: 1,
      unresolvedEntitiesExcluded: 0,
    });
    expect(canonicalData.recipeRows).toEqual([
      {
        outputItemName: 'Fancy Pipe',
        outputCanonicalKey: 'fancy pipe',
        recipeType: 'craft',
        recipeBookItemName: '',
        recipeBookCanonicalKey: '',
        cookingLevel: '',
        baseTime: '',
        sourceBuddyUrl: 'https://buddy.farm/i/fancy-pipe/',
      },
      {
        outputItemName: 'Quandary Chowder',
        outputCanonicalKey: 'quandary chowder',
        recipeType: 'cooking',
        recipeBookItemName: "Jill's Quandary Chowder",
        recipeBookCanonicalKey: "jill's quandary chowder",
        cookingLevel: '25',
        baseTime: '4h',
        sourceBuddyUrl: 'https://buddy.farm/i/quandary-chowder/',
      },
    ]);
    expect(canonicalData.recipeInputRows).toHaveLength(3);
    expect(toCanonicalRecipesCsv(canonicalData)).toContain('Fancy Pipe');
    expect(toCanonicalRecipeInputsCsv(canonicalData)).toContain('Wood');
  });

  it('fails clearly if reconciliation still has unresolved entities', () => {
    expect(() =>
      generateCanonicalRecipeData(
        JSON.stringify({ results: [] }),
        JSON.stringify({
          summary: { unmatchedCount: 1, ambiguousCount: 0 },
          entities: [],
        }),
      ),
    ).toThrow(/Cannot generate canonical recipe data while reconciliation still has 1 unmatched and 0 ambiguous entities/);
  });

  it('validates canonical rows and duplicate input pairs', () => {
    expect(() =>
      validateCanonicalRecipeData({
        recipeRows: [
          {
            outputItemName: 'Fancy Pipe',
            outputCanonicalKey: 'fancy pipe',
            recipeType: 'craft',
            recipeBookItemName: '',
            recipeBookCanonicalKey: '',
            cookingLevel: '',
            baseTime: '',
            sourceBuddyUrl: 'https://buddy.farm/i/fancy-pipe/',
          },
        ],
        recipeInputRows: [
          {
            outputCanonicalKey: 'fancy pipe',
            outputItemName: 'Fancy Pipe',
            inputOrder: 1,
            inputItemName: 'Wood',
            inputCanonicalKey: 'wood',
            quantity: 10,
          },
          {
            outputCanonicalKey: 'fancy pipe',
            outputItemName: 'Fancy Pipe',
            inputOrder: 2,
            inputItemName: 'Wood',
            inputCanonicalKey: 'wood',
            quantity: 12,
          },
        ],
      }),
    ).toThrow(/Duplicate canonical recipe input pair "fancy pipe::wood"/);
  });
});
