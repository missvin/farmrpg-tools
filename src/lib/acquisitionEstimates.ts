import type {
  AcquisitionPlannerInputState,
  AcquisitionPlanningHorizon,
} from './acquisitionPlannerState';

export type ConsumableAcquisitionSourceKey = 'apple_cider' | 'lemonade' | 'arnold_palmer';

export type ConsumableAcquisitionEstimate = {
  sourceKey: ConsumableAcquisitionSourceKey;
  label: string;
  ownedUses: number;
  craftableNowUses: number;
  futureCraftableUses: number;
  immediateUses: number;
  futureUses: number;
  totalUses: number;
  standardItemsPerUse: number;
  boostedItemsPerUse: number | null;
  boostedUsesApplied: number;
  immediateItemCapacity: number;
  futureItemCapacity: number;
  totalItemCapacity: number;
  staminaPerUse: number | null;
  notes: string[];
  provenance: string[];
};

export type ManualExploreAcquisitionInput = {
  itemName: string;
  requiredItemCount: number;
  dropRatePercent: number;
  itemsPerDrop: number;
  availableStamina: number;
  wandererPercent: number;
};

export type ManualExploreAcquisitionEstimate = {
  itemName: string;
  calculable: boolean;
  requiredItemCount: number;
  dropRatePercent: number;
  itemsPerDrop: number;
  expectedItemsPerExplore: number;
  exploresNeeded: number;
  staminaNeeded: number;
  availableStamina: number;
  coveredByAvailableStamina: number;
  remainingAfterAvailableStamina: number;
  blockerReason: string | null;
  notes: string[];
  provenance: string[];
};

const CIDER_BASE_EXPLORES = 1010;
const CIDER_CINNAMON_EXPLORES = 1263;
const CIDER_ITEM_DROP_RATE = 0.4;
const CIDER_EE_EXPLORES_PER_POINT = 10.1;
const CIDER_CINNAMON_EE_EXPLORES_PER_POINT = 12.5;

const LEMONADE_BASE_ITEMS = 10;
const LEMONADE_SQUEEZER_ITEMS = 20;
const ARNOLD_PALMER_BASE_ITEMS = 200;
const ARNOLD_PALMER_SQUEEZER_ITEMS = 500;
const QUANDARY_CHOWDER_MULTIPLIER = 1.1;
const LEMON_SELTZER_MULTIPLIER = 1.5;

function clampNonNegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(value, 0), 100);
}

function getFutureUses(value: number, planningHorizon: AcquisitionPlanningHorizon): number {
  return planningHorizon === 'include_future' ? clampNonNegative(value) : 0;
}

function applyRoundedMultiplier(value: number, multiplier: number): number {
  return Math.round(value * multiplier);
}

function getAppleCiderExploresPerUse(state: AcquisitionPlannerInputState): number {
  const baseExplores = state.explore.cinnamonSticksActive
    ? CIDER_CINNAMON_EXPLORES
    : CIDER_BASE_EXPLORES;
  const eePerPoint = state.explore.cinnamonSticksActive
    ? CIDER_CINNAMON_EE_EXPLORES_PER_POINT
    : CIDER_EE_EXPLORES_PER_POINT;

  return baseExplores + Math.round(clampNonNegative(state.explore.exploringEffectivenessPercent) * eePerPoint);
}

function getCiderStaminaPerUse(state: AcquisitionPlannerInputState, exploresPerUse: number): number {
  const wandererMultiplier = 1 - clampPercent(state.explore.wandererPercent) / 100;
  return Math.ceil(exploresPerUse * wandererMultiplier);
}

function splitCapacityByImmediateAndFuture(
  standardItemsPerUse: number,
  boostedItemsPerUse: number | null,
  boostedUsesAvailable: number,
  immediateUses: number,
  futureUses: number,
): Pick<
  ConsumableAcquisitionEstimate,
  'immediateItemCapacity' | 'futureItemCapacity' | 'totalItemCapacity' | 'boostedUsesApplied'
> {
  const totalUses = immediateUses + futureUses;
  const boostedUsesApplied = boostedItemsPerUse
    ? Math.min(clampNonNegative(boostedUsesAvailable), totalUses)
    : 0;
  const immediateBoostedUses = Math.min(boostedUsesApplied, immediateUses);
  const futureBoostedUses = Math.max(0, boostedUsesApplied - immediateBoostedUses);
  const immediateStandardUses = immediateUses - immediateBoostedUses;
  const futureStandardUses = futureUses - futureBoostedUses;
  const boostedYield = boostedItemsPerUse ?? standardItemsPerUse;
  const immediateItemCapacity =
    immediateBoostedUses * boostedYield + immediateStandardUses * standardItemsPerUse;
  const futureItemCapacity =
    futureBoostedUses * boostedYield + futureStandardUses * standardItemsPerUse;

  return {
    immediateItemCapacity,
    futureItemCapacity,
    totalItemCapacity: immediateItemCapacity + futureItemCapacity,
    boostedUsesApplied,
  };
}

export function deriveConsumableAcquisitionEstimates(
  state: AcquisitionPlannerInputState,
): ConsumableAcquisitionEstimate[] {
  const planningHorizon = state.sourcePolicy.planningHorizon;
  const ciderExploresPerUse = getAppleCiderExploresPerUse(state);
  const ciderStaminaPerUse = getCiderStaminaPerUse(state, ciderExploresPerUse);
  const ciderItemsPerUse = Math.round(ciderExploresPerUse * CIDER_ITEM_DROP_RATE);
  const ciderAvailableUses = state.explore.availableStamina > 0
    ? Math.min(
      state.consumables.appleCider.ownedCount + state.consumables.appleCider.craftableNowCount,
      Math.floor(state.explore.availableStamina / ciderStaminaPerUse),
    )
    : state.consumables.appleCider.ownedCount + state.consumables.appleCider.craftableNowCount;
  const ciderCapacity = splitCapacityByImmediateAndFuture(
    ciderItemsPerUse,
    null,
    0,
    ciderAvailableUses,
    getFutureUses(state.consumables.appleCider.futureCraftableCount, planningHorizon),
  );
  const ciderNotes: string[] = [
    `${ciderExploresPerUse.toLocaleString()} explores per Apple Cider at current saved assumptions.`,
  ];

  if (state.explore.availableStamina > 0 && ciderAvailableUses < state.consumables.appleCider.ownedCount + state.consumables.appleCider.craftableNowCount) {
    ciderNotes.push('Current stamina limits how many immediate Apple Ciders can be fully used.');
  }

  if (state.explore.neighActive) {
    ciderNotes.push('Neigh is tracked in settings but not applied until its stamina rule is confirmed.');
  }

  const lemonadeBase = state.consumables.lemonade.lemonSqueezerActive
    ? LEMONADE_SQUEEZER_ITEMS
    : LEMONADE_BASE_ITEMS;
  const lemonadeItemsPerUse = state.consumables.lemonade.quandaryChowderActive
    ? applyRoundedMultiplier(lemonadeBase, QUANDARY_CHOWDER_MULTIPLIER)
    : lemonadeBase;
  const lemonadeImmediateUses =
    state.consumables.lemonade.ownedCount + state.consumables.lemonade.craftableNowCount;
  const lemonadeFutureUses = getFutureUses(state.consumables.lemonade.futureCraftableCount, planningHorizon);
  const lemonadeCapacity = splitCapacityByImmediateAndFuture(
    lemonadeItemsPerUse,
    null,
    0,
    lemonadeImmediateUses,
    lemonadeFutureUses,
  );

  const arnoldPalmerBase = state.consumables.arnoldPalmer.lemonSqueezerActive
    ? ARNOLD_PALMER_SQUEEZER_ITEMS
    : ARNOLD_PALMER_BASE_ITEMS;
  const arnoldPalmerStandardItemsPerUse = state.consumables.arnoldPalmer.quandaryChowderActive
    ? applyRoundedMultiplier(arnoldPalmerBase, QUANDARY_CHOWDER_MULTIPLIER)
    : arnoldPalmerBase;
  const arnoldPalmerBoostedItemsPerUse = state.consumables.arnoldPalmer.lemonSeltzerUsesRemaining > 0
    ? applyRoundedMultiplier(arnoldPalmerStandardItemsPerUse, LEMON_SELTZER_MULTIPLIER)
    : null;
  const arnoldPalmerImmediateUses =
    state.consumables.arnoldPalmer.ownedCount + state.consumables.arnoldPalmer.craftableNowCount;
  const arnoldPalmerFutureUses = getFutureUses(
    state.consumables.arnoldPalmer.futureCraftableCount,
    planningHorizon,
  );
  const arnoldPalmerCapacity = splitCapacityByImmediateAndFuture(
    arnoldPalmerStandardItemsPerUse,
    arnoldPalmerBoostedItemsPerUse,
    state.consumables.arnoldPalmer.lemonSeltzerUsesRemaining,
    arnoldPalmerImmediateUses,
    arnoldPalmerFutureUses,
  );
  const arnoldPalmerNotes: string[] = [];

  if (state.consumables.arnoldPalmer.lemonCreamPieActive) {
    arnoldPalmerNotes.push('Lemon Cream Pie is tracked but not applied until its exact throughput rule is confirmed.');
  }

  return [
    {
      sourceKey: 'apple_cider',
      label: 'Apple Cider',
      ownedUses: state.consumables.appleCider.ownedCount,
      craftableNowUses: state.consumables.appleCider.craftableNowCount,
      futureCraftableUses: state.consumables.appleCider.futureCraftableCount,
      immediateUses: ciderAvailableUses,
      futureUses: getFutureUses(state.consumables.appleCider.futureCraftableCount, planningHorizon),
      totalUses: ciderAvailableUses + getFutureUses(state.consumables.appleCider.futureCraftableCount, planningHorizon),
      standardItemsPerUse: ciderItemsPerUse,
      boostedItemsPerUse: null,
      boostedUsesApplied: ciderCapacity.boostedUsesApplied,
      immediateItemCapacity: ciderCapacity.immediateItemCapacity,
      futureItemCapacity: ciderCapacity.futureItemCapacity,
      totalItemCapacity: ciderCapacity.totalItemCapacity,
      staminaPerUse: ciderStaminaPerUse,
      notes: ciderNotes,
      provenance: [
        'Apple Cider uses saved Cinnamon Sticks, EE, Wanderer, available stamina, and future-use horizon assumptions.',
        'Each cider estimates item yield as 40% of its adjusted explore count.',
      ],
    },
    {
      sourceKey: 'lemonade',
      label: 'Lemonade',
      ownedUses: state.consumables.lemonade.ownedCount,
      craftableNowUses: state.consumables.lemonade.craftableNowCount,
      futureCraftableUses: state.consumables.lemonade.futureCraftableCount,
      immediateUses: lemonadeImmediateUses,
      futureUses: lemonadeFutureUses,
      totalUses: lemonadeImmediateUses + lemonadeFutureUses,
      standardItemsPerUse: lemonadeItemsPerUse,
      boostedItemsPerUse: null,
      boostedUsesApplied: lemonadeCapacity.boostedUsesApplied,
      immediateItemCapacity: lemonadeCapacity.immediateItemCapacity,
      futureItemCapacity: lemonadeCapacity.futureItemCapacity,
      totalItemCapacity: lemonadeCapacity.totalItemCapacity,
      staminaPerUse: null,
      notes: [
        state.consumables.lemonade.lemonSqueezerActive
          ? 'Lemon Squeezer active.'
          : 'Lemon Squeezer inactive.',
        state.consumables.lemonade.quandaryChowderActive
          ? 'Quandary Chowder bonus applied.'
          : 'Quandary Chowder inactive.',
      ],
      provenance: [
        'Lemonade uses saved Lemon Squeezer, Quandary Chowder, availability, and future-use horizon assumptions.',
      ],
    },
    {
      sourceKey: 'arnold_palmer',
      label: 'Arnold Palmer',
      ownedUses: state.consumables.arnoldPalmer.ownedCount,
      craftableNowUses: state.consumables.arnoldPalmer.craftableNowCount,
      futureCraftableUses: state.consumables.arnoldPalmer.futureCraftableCount,
      immediateUses: arnoldPalmerImmediateUses,
      futureUses: arnoldPalmerFutureUses,
      totalUses: arnoldPalmerImmediateUses + arnoldPalmerFutureUses,
      standardItemsPerUse: arnoldPalmerStandardItemsPerUse,
      boostedItemsPerUse: arnoldPalmerBoostedItemsPerUse,
      boostedUsesApplied: arnoldPalmerCapacity.boostedUsesApplied,
      immediateItemCapacity: arnoldPalmerCapacity.immediateItemCapacity,
      futureItemCapacity: arnoldPalmerCapacity.futureItemCapacity,
      totalItemCapacity: arnoldPalmerCapacity.totalItemCapacity,
      staminaPerUse: null,
      notes: [
        state.consumables.arnoldPalmer.lemonSqueezerActive
          ? 'Lemon Squeezer active.'
          : 'Lemon Squeezer inactive.',
        state.consumables.arnoldPalmer.quandaryChowderActive
          ? 'Quandary Chowder bonus applied.'
          : 'Quandary Chowder inactive.',
        ...arnoldPalmerNotes,
      ],
      provenance: [
        'Arnold Palmer uses saved Lemon Squeezer, Quandary Chowder, Lemon Seltzer, availability, and future-use horizon assumptions.',
      ],
    },
  ];
}

export function estimateManualExploreAcquisition(
  input: ManualExploreAcquisitionInput,
): ManualExploreAcquisitionEstimate {
  const requiredItemCount = Math.ceil(clampNonNegative(input.requiredItemCount));
  const dropRatePercent = clampPercent(input.dropRatePercent);
  const itemsPerDrop = clampNonNegative(input.itemsPerDrop);
  const availableStamina = Math.floor(clampNonNegative(input.availableStamina));
  const expectedItemsPerExplore = (dropRatePercent / 100) * itemsPerDrop;
  const provenance = [
    'Manual Explore uses a user-entered expected drop rate because source coverage is not yet canonical reference data.',
  ];

  if (requiredItemCount <= 0) {
    return {
      itemName: input.itemName,
      calculable: true,
      requiredItemCount,
      dropRatePercent,
      itemsPerDrop,
      expectedItemsPerExplore,
      exploresNeeded: 0,
      staminaNeeded: 0,
      availableStamina,
      coveredByAvailableStamina: 0,
      remainingAfterAvailableStamina: 0,
      blockerReason: null,
      notes: ['No remaining item count to cover.'],
      provenance,
    };
  }

  if (dropRatePercent <= 0 || itemsPerDrop <= 0) {
    return {
      itemName: input.itemName,
      calculable: false,
      requiredItemCount,
      dropRatePercent,
      itemsPerDrop,
      expectedItemsPerExplore,
      exploresNeeded: 0,
      staminaNeeded: 0,
      availableStamina,
      coveredByAvailableStamina: 0,
      remainingAfterAvailableStamina: requiredItemCount,
      blockerReason: 'Enter a drop rate and items per drop to estimate manual exploring.',
      notes: ['Manual Explore needs item-specific assumptions before it can estimate this item.'],
      provenance,
    };
  }

  const exploresNeeded = Math.ceil(requiredItemCount / expectedItemsPerExplore);
  const staminaMultiplier = 1 - clampPercent(input.wandererPercent) / 100;
  const staminaNeeded = Math.ceil(exploresNeeded * staminaMultiplier);
  const availableExplores = staminaMultiplier > 0
    ? Math.floor(availableStamina / staminaMultiplier)
    : exploresNeeded;
  const coveredByAvailableStamina = Math.min(
    requiredItemCount,
    Math.floor(availableExplores * expectedItemsPerExplore),
  );
  const remainingAfterAvailableStamina = Math.max(0, requiredItemCount - coveredByAvailableStamina);

  return {
    itemName: input.itemName,
    calculable: true,
    requiredItemCount,
    dropRatePercent,
    itemsPerDrop,
    expectedItemsPerExplore,
    exploresNeeded,
    staminaNeeded,
    availableStamina,
    coveredByAvailableStamina,
    remainingAfterAvailableStamina,
    blockerReason: null,
    notes: [
      availableStamina > 0
        ? `${coveredByAvailableStamina.toLocaleString()} item(s) covered by saved stamina.`
        : 'Add available stamina in settings to compare against your current stamina budget.',
    ],
    provenance,
  };
}
