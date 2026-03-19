import { describe, expect, it } from 'vitest';

import { createDefaultCraftingModifierState } from './craftingModifierState';
import {
  buildRecipeGraph,
  parseRecipeInputsCsv,
  parseRecipesCsv,
} from './loadRecipeGraph';
import {
  calculateCraftRecipeEffectiveOutput,
  calculateCraftRecipeRequiredCraftCount,
  calculateEffectiveCraftedOutput,
  calculateEffectiveMasteryGain,
  calculateRequiredCraftCountForEffectiveOutput,
  getCraftingModifierTotals,
} from './craftingMasteryEngine';

const RECIPES_CSV = `output_item_name,output_canonical_key,recipe_type,recipe_book_item_name,recipe_book_canonical_key,cooking_level,base_time,source_buddy_url
Fancy Pipe,fancy pipe,craft,,,,,https://buddy.farm/i/fancy-pipe/
Quandary Chowder,quandary chowder,cooking,Jill's Quandary Chowder,jill's quandary chowder,25,4h,https://buddy.farm/i/quandary-chowder/`;

const RECIPE_INPUTS_CSV = `output_canonical_key,output_item_name,input_order,input_item_name,input_canonical_key,quantity
fancy pipe,Fancy Pipe,1,Wood,wood,10
quandary chowder,Quandary Chowder,1,Coal,coal,240`;

describe('craftingMasteryEngine', () => {
  it('returns zero totals with no active modifiers', () => {
    expect(getCraftingModifierTotals(createDefaultCraftingModifierState())).toMatchObject({
      totalResourceSaverPercent: 0,
      totalMasteryBonusPercent: 0,
      resourceSaverModifiers: [],
      masteryBonusModifiers: [],
    });
  });

  it('applies additive deterministic resource saver to crafted output and required crafts', () => {
    const resourceSaverOneState = {
      schemaVersion: 1 as const,
      persistent: {
        resourceSaver1Unlocked: true,
        resourceSaver2Unlocked: false,
        resourceSaver3Unlocked: false,
      },
      temporary: {
        mushroomStewActive: false,
        eventMasteryBonusPercent: 0,
        eventResourceSaverBonusPercent: 0,
      },
    };

    const craftedOutput = calculateEffectiveCraftedOutput({
      craftCount: 100,
      baseOutputPerCraft: 1,
      modifierState: resourceSaverOneState,
    });

    expect(craftedOutput.effectiveOutputPerCraft).toBeCloseTo(1.1);
    expect(craftedOutput.effectiveOutput).toBeCloseTo(110);

    const requiredCrafts = calculateRequiredCraftCountForEffectiveOutput({
      desiredEffectiveOutput: 110,
      baseOutputPerCraft: 1,
      modifierState: resourceSaverOneState,
    });

    expect(requiredCrafts.requiredCraftCount).toBe(100);
    expect(requiredCrafts.projectedEffectiveOutput).toBeCloseTo(110);
    expect(requiredCrafts.projectedExcessEffectiveOutput).toBeCloseTo(0);
  });

  it('stacks Resource Saver I + II + III additively and supports event resource saver bonuses', () => {
    const stackedState = {
      schemaVersion: 1 as const,
      persistent: {
        resourceSaver1Unlocked: true,
        resourceSaver2Unlocked: true,
        resourceSaver3Unlocked: true,
      },
      temporary: {
        mushroomStewActive: false,
        eventMasteryBonusPercent: 0,
        eventResourceSaverBonusPercent: 0.17,
      },
    };

    const totals = getCraftingModifierTotals(stackedState);
    expect(totals.totalResourceSaverPercent).toBeCloseTo(0.62);
    expect(
      calculateEffectiveCraftedOutput({
        craftCount: 50,
        baseOutputPerCraft: 2,
        modifierState: stackedState,
      }).effectiveOutput,
    ).toBeCloseTo(162);

    const requiredCrafts = calculateRequiredCraftCountForEffectiveOutput({
      desiredEffectiveOutput: 146,
      baseOutputPerCraft: 1,
      modifierState: {
        ...stackedState,
        temporary: {
          ...stackedState.temporary,
          eventResourceSaverBonusPercent: 0,
        },
      },
    });

    expect(requiredCrafts.modifierTotals.totalResourceSaverPercent).toBeCloseTo(0.45);
    expect(requiredCrafts.requiredCraftCount).toBe(101);
    expect(requiredCrafts.projectedEffectiveOutput).toBeCloseTo(146.45);
  });

  it('keeps mastery bonus modifiers separate from resource saver totals', () => {
    const masteryBonusState = {
      schemaVersion: 1 as const,
      persistent: {
        resourceSaver1Unlocked: false,
        resourceSaver2Unlocked: false,
        resourceSaver3Unlocked: false,
      },
      temporary: {
        mushroomStewActive: true,
        eventMasteryBonusPercent: 0.17,
        eventResourceSaverBonusPercent: 0.05,
      },
    };

    const masteryGain = calculateEffectiveMasteryGain({
      baseMasteryGain: 100,
      modifierState: masteryBonusState,
    });

    expect(masteryGain.modifierTotals.totalMasteryBonusPercent).toBeCloseTo(0.27);
    expect(masteryGain.modifierTotals.totalResourceSaverPercent).toBeCloseTo(0.05);
    expect(masteryGain.effectiveMasteryGain).toBeCloseTo(127);
  });

  it('provides thin craft-recipe helpers over the recipe graph and rejects non-craft recipes', () => {
    const recipeGraph = buildRecipeGraph(
      parseRecipesCsv(RECIPES_CSV),
      parseRecipeInputsCsv(RECIPE_INPUTS_CSV),
    );
    const modifierState = {
      schemaVersion: 1 as const,
      persistent: {
        resourceSaver1Unlocked: true,
        resourceSaver2Unlocked: false,
        resourceSaver3Unlocked: false,
      },
      temporary: {
        mushroomStewActive: false,
        eventMasteryBonusPercent: 0,
        eventResourceSaverBonusPercent: 0,
      },
    };

    const craftResult = calculateCraftRecipeEffectiveOutput({
      recipeGraph,
      outputCanonicalKey: 'fancy pipe',
      craftCount: 100,
      modifierState,
    });

    expect(craftResult.recipe.outputItemName).toBe('Fancy Pipe');
    expect(craftResult.outputPerCraftAssumption).toBe(1);
    if (!('craftCount' in craftResult.result) || !('effectiveOutput' in craftResult.result)) {
      throw new Error('Expected crafted-output calculation result.');
    }

    expect(craftResult.result.craftCount).toBe(100);
    expect(craftResult.result.effectiveOutput).toBeCloseTo(110);

    const requiredResult = calculateCraftRecipeRequiredCraftCount({
      recipeGraph,
      outputCanonicalKey: 'fancy pipe',
      desiredEffectiveOutput: 110,
      modifierState,
    });

    expect(requiredResult.result).toMatchObject({
      requiredCraftCount: 100,
    });

    expect(() =>
      calculateCraftRecipeEffectiveOutput({
        recipeGraph,
        outputCanonicalKey: 'quandary chowder',
        craftCount: 1,
        modifierState,
      }),
    ).toThrow(/not a craft recipe/i);
  });
});
