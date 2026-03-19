export type CraftingModifierCategory =
  | 'resource_saver'
  | 'mastery_bonus'
  | 'crafting_behavior_note'
  | 'related_mastery_note';

export type CraftingModifierSourceType =
  | 'skill_perk'
  | 'gold_perk'
  | 'artifact_reward'
  | 'meal'
  | 'event'
  | 'system_behavior';

export type CraftingModifierAffects =
  | 'crafted_output'
  | 'mastery_gain'
  | 'crafting_inventory_overflow'
  | 'non_crafting_overflow_mastery';

export type CraftingModifierValueRepresentation =
  | {
      kind: 'percent_additive';
      percent: number | null;
      variable: boolean;
      examplePercent: number | null;
    }
  | {
      kind: 'behavior_note';
      percent: null;
      variable: false;
      examplePercent: null;
    };

export type CraftingModifierStackingBehavior =
  | 'additive_with_family'
  | 'behavior_only'
  | 'documented_interaction_only';

export type CraftingModifierDefinition = {
  key: string;
  name: string;
  familyKey: 'resource_saver' | 'mastery_bonus' | 'crafting_behavior' | 'related_mastery_behavior';
  category: CraftingModifierCategory;
  sourceType: CraftingModifierSourceType;
  affects: CraftingModifierAffects;
  value: CraftingModifierValueRepresentation;
  stackingBehavior: CraftingModifierStackingBehavior;
  userSpecific: boolean;
  temporaryOrConditional: boolean;
  notes: string;
  formulaNotes: string[];
  assumptions: string[];
  confidence: 'confirmed' | 'working_assumption';
};

export type CraftingModifierFamilyDefinition = {
  familyKey: 'resource_saver' | 'mastery_bonus';
  name: string;
  affects: 'crafted_output' | 'mastery_gain';
  stackingRule: 'additive';
  deterministicPlanningInterpretation: boolean;
  formula: string;
  notes: string[];
};

export type CraftingMasteryRulesCatalog = {
  families: CraftingModifierFamilyDefinition[];
  modifiers: CraftingModifierDefinition[];
  scopeNotes: string[];
};

export const CRAFTING_MASTERY_RULES_CATALOG: CraftingMasteryRulesCatalog = {
  families: [
    {
      familyKey: 'resource_saver',
      name: 'Resource saver',
      affects: 'crafted_output',
      stackingRule: 'additive',
      deterministicPlanningInterpretation: true,
      formula: 'effective_output = base_output * (1 + total_resource_saver_percent)',
      notes: [
        'Resource saver applies only to crafted items.',
        'For planning, resource saver should be treated deterministically rather than probabilistically.',
        'total_resource_saver_percent includes Resource Saver I/II/III plus any event resource saver modifier.',
      ],
    },
    {
      familyKey: 'mastery_bonus',
      name: 'Mastery bonus',
      affects: 'mastery_gain',
      stackingRule: 'additive',
      deterministicPlanningInterpretation: true,
      formula: 'effective_mastery_gain = base_mastery_gain * (1 + total_mastery_bonus_percent)',
      notes: [
        'total_mastery_bonus_percent includes meal and event mastery bonuses.',
        'Mushroom Stew applies broadly to mastery, including meal mastery, but BL-031 remains focused on crafting/item mastery rules.',
      ],
    },
  ],
  modifiers: [
    {
      key: 'resource_saver_i',
      name: 'Resource Saver I',
      familyKey: 'resource_saver',
      category: 'resource_saver',
      sourceType: 'skill_perk',
      affects: 'crafted_output',
      value: {
        kind: 'percent_additive',
        percent: 0.1,
        variable: false,
        examplePercent: null,
      },
      stackingBehavior: 'additive_with_family',
      userSpecific: true,
      temporaryOrConditional: false,
      notes: 'Skill point perk that contributes +10% crafted output.',
      formulaNotes: ['Included in total_resource_saver_percent.'],
      assumptions: [],
      confidence: 'confirmed',
    },
    {
      key: 'resource_saver_ii',
      name: 'Resource Saver II',
      familyKey: 'resource_saver',
      category: 'resource_saver',
      sourceType: 'gold_perk',
      affects: 'crafted_output',
      value: {
        kind: 'percent_additive',
        percent: 0.15,
        variable: false,
        examplePercent: null,
      },
      stackingBehavior: 'additive_with_family',
      userSpecific: true,
      temporaryOrConditional: false,
      notes: 'Gold perk that contributes +15% crafted output.',
      formulaNotes: ['Included in total_resource_saver_percent.'],
      assumptions: [],
      confidence: 'confirmed',
    },
    {
      key: 'resource_saver_iii',
      name: 'Resource Saver III',
      familyKey: 'resource_saver',
      category: 'resource_saver',
      sourceType: 'artifact_reward',
      affects: 'crafted_output',
      value: {
        kind: 'percent_additive',
        percent: 0.2,
        variable: false,
        examplePercent: null,
      },
      stackingBehavior: 'additive_with_family',
      userSpecific: true,
      temporaryOrConditional: false,
      notes: 'Headdress of Luna artifact reward from Tower floor 90 that contributes +20% crafted output.',
      formulaNotes: ['Included in total_resource_saver_percent.', 'Observed in-game stacking with I and II reaches +45% total.'],
      assumptions: [],
      confidence: 'confirmed',
    },
    {
      key: 'event_resource_saver_bonus',
      name: 'Event resource saver bonus',
      familyKey: 'resource_saver',
      category: 'resource_saver',
      sourceType: 'event',
      affects: 'crafted_output',
      value: {
        kind: 'percent_additive',
        percent: null,
        variable: true,
        examplePercent: null,
      },
      stackingBehavior: 'additive_with_family',
      userSpecific: false,
      temporaryOrConditional: true,
      notes: 'Temporary event resource saver modifier that stacks additively with the normal resource saver sources.',
      formulaNotes: ['Included in total_resource_saver_percent when an event grants a resource saver bonus.'],
      assumptions: ['Exact event percentage varies by event window and should remain configurable later in BL-032.'],
      confidence: 'confirmed',
    },
    {
      key: 'mushroom_stew_mastery_bonus',
      name: 'Mushroom Stew mastery bonus',
      familyKey: 'mastery_bonus',
      category: 'mastery_bonus',
      sourceType: 'meal',
      affects: 'mastery_gain',
      value: {
        kind: 'percent_additive',
        percent: 0.1,
        variable: false,
        examplePercent: null,
      },
      stackingBehavior: 'additive_with_family',
      userSpecific: true,
      temporaryOrConditional: true,
      notes: 'Consumable meal that grants +10% mastery for 5 minutes and applies broadly to mastery, including meal mastery.',
      formulaNotes: ['Included in total_mastery_bonus_percent.'],
      assumptions: ['Broader meal-mastery modeling is out of scope for BL-031, but this interaction is documented for correctness.'],
      confidence: 'confirmed',
    },
    {
      key: 'event_item_mastery_bonus',
      name: 'Event item mastery bonus',
      familyKey: 'mastery_bonus',
      category: 'mastery_bonus',
      sourceType: 'event',
      affects: 'mastery_gain',
      value: {
        kind: 'percent_additive',
        percent: null,
        variable: true,
        examplePercent: 0.17,
      },
      stackingBehavior: 'additive_with_family',
      userSpecific: false,
      temporaryOrConditional: true,
      notes: 'Temporary event-driven item mastery bonus; a confirmed observed example was +17% item mastery during March 17–20.',
      formulaNotes: ['Included in total_mastery_bonus_percent when an event grants item mastery.'],
      assumptions: ['Exact event percentage varies by event window and should remain configurable later in BL-032.'],
      confidence: 'confirmed',
    },
    {
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
    },
    {
      key: 'non_crafting_overflow_mastery_note',
      name: 'Non-crafting overflow mastery note',
      familyKey: 'related_mastery_behavior',
      category: 'related_mastery_note',
      sourceType: 'system_behavior',
      affects: 'non_crafting_overflow_mastery',
      value: {
        kind: 'behavior_note',
        percent: null,
        variable: false,
        examplePercent: null,
      },
      stackingBehavior: 'documented_interaction_only',
      userSpecific: false,
      temporaryOrConditional: true,
      notes: 'Non-crafting item acquisition can still grant mastery on overflow even when excess items are not retained, such as opening a chest at inventory cap.',
      formulaNotes: ['Mushroom Stew applies to that mastery too.'],
      assumptions: ['This is documented as a related mastery rule, but BL-031 remains focused on crafting/item mastery rules needed for later crafting calculations.'],
      confidence: 'confirmed',
    },
  ],
  scopeNotes: [
    'BL-031 catalogs the universe of crafting mastery-affecting rules and formula behavior, not per-user active/unlocked state.',
    'BL-032 should handle user-specific unlocked or active modifier state such as perks, artifacts, meals, and event conditions.',
    'Cooking or meal mastery modeling should be handled separately; broader mastery interactions are documented here only when needed for correctness.',
  ],
};

export function getCraftingModifierDefinition(key: string): CraftingModifierDefinition | undefined {
  return CRAFTING_MASTERY_RULES_CATALOG.modifiers.find((modifier) => modifier.key === key);
}

export function getCraftingModifierFamilyDefinition(
  familyKey: CraftingModifierFamilyDefinition['familyKey'],
): CraftingModifierFamilyDefinition | undefined {
  return CRAFTING_MASTERY_RULES_CATALOG.families.find((family) => family.familyKey === familyKey);
}
