import { describe, expect, it } from 'vitest';

import {
  extractRecipeEntities,
  normalizeItemKey,
  parseBuddyRecipeResultsJson,
  parseMuseumSeedCsv,
  reconcileRecipeEntities,
  toRecipeReconciliationSubsetCsv,
} from '../../scripts/lib/buddyRecipeReconcile.mjs';

describe('buddyRecipeReconcile', () => {
  it('normalizes item names with the same smart punctuation rules as the app', () => {
    expect(normalizeItemKey("Cecil’s Shrimp-a-Plenty")).toBe("cecil's shrimp-a-plenty");
  });

  it('parses museum seed rows', () => {
    const rows = parseMuseumSeedCsv(`museum_category,category,item_name,canonical_key,obtainable
Items,Item,Wood,wood,Y
Event,Event,Piñata Whop Stick,piñata whop stick,Y`);

    expect(rows).toEqual([
      {
        museumCategory: 'Items',
        category: 'Item',
        itemName: 'Wood',
        canonicalKey: 'wood',
        obtainable: true,
      },
      {
        museumCategory: 'Event',
        category: 'Event',
        itemName: 'Piñata Whop Stick',
        canonicalKey: 'piñata whop stick',
        obtainable: true,
      },
    ]);
  });

  it('extracts unique recipe entities across page, ingredient, recipe-book, and used-in roles', () => {
    const extractionResult = parseBuddyRecipeResultsJson(`{
      "results": [
        {
          "itemName": "Quandary Chowder",
          "candidateBuddyUrl": "https://buddy.farm/i/quandary-chowder/",
          "recipe": {
            "recipeBookItem": { "itemName": "Jill's Quandary Chowder" },
            "ingredients": [{ "itemName": "Coal" }, { "itemName": "Salt" }]
          },
          "usedIn": []
        },
        {
          "itemName": "Red Twine",
          "candidateBuddyUrl": "https://buddy.farm/i/red-twine/",
          "recipe": {
            "recipeBookItem": null,
            "ingredients": [{ "itemName": "Twine" }]
          },
          "usedIn": [{ "itemName": "Rucksack" }]
        }
      ]
    }`);

    const entities = extractRecipeEntities(extractionResult);
    const normalizedKeys = entities.map((entity) => entity.normalizedKey).sort();

    expect(normalizedKeys).toEqual([
      'coal',
      "jill's quandary chowder",
      'quandary chowder',
      'red twine',
      'rucksack',
      'salt',
      'twine',
    ]);
  });

  it('reconciles matched, unmatched, and ambiguous entities', () => {
    const extractionResult = parseBuddyRecipeResultsJson(`{
      "results": [
        {
          "itemName": "Fancy Pipe",
          "candidateBuddyUrl": "https://buddy.farm/i/fancy-pipe/",
          "recipe": {
            "recipeBookItem": null,
            "ingredients": [{ "itemName": "Wood" }, { "itemName": "Mystery Dust" }]
          },
          "usedIn": [{ "itemName": "Crown of Clover" }]
        }
      ]
    }`);

    const reconciliationResult = reconcileRecipeEntities(extractionResult, [
      {
        museumCategory: 'Items',
        category: 'Item',
        itemName: 'Fancy Pipe',
        canonicalKey: 'fancy pipe',
        obtainable: true,
      },
      {
        museumCategory: 'Items',
        category: 'Item',
        itemName: 'Wood',
        canonicalKey: 'wood',
        obtainable: true,
      },
      {
        museumCategory: 'Event',
        category: 'Event',
        itemName: 'Crown of Clover',
        canonicalKey: 'crown of clover',
        obtainable: true,
      },
      {
        museumCategory: 'Items',
        category: 'Item',
        itemName: 'Crown of Clover',
        canonicalKey: 'crown of clover',
        obtainable: true,
      },
    ]);

    expect(reconciliationResult.summary).toEqual({
      extractedEntityCount: 4,
      matchedCount: 2,
      unmatchedCount: 1,
      ambiguousCount: 1,
    });

    expect(reconciliationResult.unmatched[0].normalizedKey).toBe('mystery dust');
    expect(reconciliationResult.ambiguous[0].normalizedKey).toBe('crown of clover');
    expect(toRecipeReconciliationSubsetCsv(reconciliationResult.matched)).toContain('Fancy Pipe');
  });
});
