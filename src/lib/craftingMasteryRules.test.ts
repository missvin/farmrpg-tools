import { describe, expect, it } from 'vitest';

import {
  CRAFTING_MASTERY_RULES_CATALOG,
  getCraftingModifierDefinition,
  getCraftingModifierFamilyDefinition,
} from './craftingMasteryRules';

describe('CRAFTING_MASTERY_RULES_CATALOG', () => {
  it('defines additive resource saver and mastery bonus families with formula notes', () => {
    expect(getCraftingModifierFamilyDefinition('resource_saver')).toEqual({
      familyKey: 'resource_saver',
      name: 'Resource saver',
      affects: 'crafted_output',
      stackingRule: 'additive',
      deterministicPlanningInterpretation: true,
      formula: 'effective_output = base_output * (1 + total_resource_saver_percent)',
      notes: expect.arrayContaining([
        'Resource saver applies only to crafted items.',
        'For planning, resource saver should be treated deterministically rather than probabilistically.',
      ]),
    });

    expect(getCraftingModifierFamilyDefinition('mastery_bonus')).toEqual({
      familyKey: 'mastery_bonus',
      name: 'Mastery bonus',
      affects: 'mastery_gain',
      stackingRule: 'additive',
      deterministicPlanningInterpretation: true,
      formula: 'effective_mastery_gain = base_mastery_gain * (1 + total_mastery_bonus_percent)',
      notes: expect.arrayContaining([
        'total_mastery_bonus_percent includes meal and event mastery bonuses.',
      ]),
    });
  });

  it('captures confirmed resource saver sources as additive crafted-output modifiers', () => {
    expect(getCraftingModifierDefinition('resource_saver_i')).toMatchObject({
      name: 'Resource Saver I',
      category: 'resource_saver',
      sourceType: 'skill_perk',
      affects: 'crafted_output',
      stackingBehavior: 'additive_with_family',
      userSpecific: true,
      temporaryOrConditional: false,
      value: {
        kind: 'percent_additive',
        percent: 0.1,
        variable: false,
      },
    });

    expect(getCraftingModifierDefinition('resource_saver_ii')).toMatchObject({
      sourceType: 'gold_perk',
      value: {
        kind: 'percent_additive',
        percent: 0.15,
        variable: false,
      },
    });

    expect(getCraftingModifierDefinition('resource_saver_iii')).toMatchObject({
      sourceType: 'artifact_reward',
      value: {
        kind: 'percent_additive',
        percent: 0.2,
        variable: false,
      },
    });

    expect(getCraftingModifierDefinition('event_resource_saver_bonus')).toMatchObject({
      sourceType: 'event',
      temporaryOrConditional: true,
      value: {
        kind: 'percent_additive',
        percent: null,
        variable: true,
      },
    });
  });

  it('keeps mastery bonuses separate from resource saver and documents broader mastery interactions', () => {
    expect(getCraftingModifierDefinition('mushroom_stew_mastery_bonus')).toMatchObject({
      familyKey: 'mastery_bonus',
      sourceType: 'meal',
      affects: 'mastery_gain',
      value: {
        kind: 'percent_additive',
        percent: 0.1,
        variable: false,
      },
      notes: expect.stringContaining('applies broadly to mastery, including meal mastery'),
    });

    expect(getCraftingModifierDefinition('event_item_mastery_bonus')).toMatchObject({
      familyKey: 'mastery_bonus',
      sourceType: 'event',
      value: {
        kind: 'percent_additive',
        percent: null,
        variable: true,
        examplePercent: 0.17,
      },
    });

    expect(getCraftingModifierDefinition('non_crafting_overflow_mastery_note')).toMatchObject({
      category: 'related_mastery_note',
      affects: 'non_crafting_overflow_mastery',
      stackingBehavior: 'documented_interaction_only',
    });
  });

  it('documents crafting inventory overflow as a behavior note rather than a mastery bonus', () => {
    expect(getCraftingModifierDefinition('crafting_inventory_overflow_refund')).toEqual({
      key: 'crafting_inventory_overflow_refund',
      name: 'Crafting inventory overflow refund behavior',
      familyKey: 'crafting_behavior',
      category: 'crafting_behavior_note',
      sourceType: 'system_behavior',
      affects: 'crafting_inventory_overflow',
      value: {
        kind: 'behavior_note',
        percent: null,
        variable: false,
        examplePercent: null,
      },
      stackingBehavior: 'behavior_only',
      userSpecific: false,
      temporaryOrConditional: true,
      notes: 'If crafting would exceed inventory max, extra crafted items are not received and the crafting resources are refunded.',
      formulaNotes: ['Blocked crafted output from inventory overflow does not grant additional crafted-item mastery.'],
      assumptions: ['Record this as crafting-specific behavior rather than a mastery bonus.'],
      confidence: 'confirmed',
    });
  });

  it('keeps BL-031 scoped to rule definitions rather than user-specific active state', () => {
    expect(CRAFTING_MASTERY_RULES_CATALOG.scopeNotes).toEqual(
      expect.arrayContaining([
        'BL-031 catalogs the universe of crafting mastery-affecting rules and formula behavior, not per-user active/unlocked state.',
        'BL-032 should handle user-specific unlocked or active modifier state such as perks, artifacts, meals, and event conditions.',
      ]),
    );
  });
});
