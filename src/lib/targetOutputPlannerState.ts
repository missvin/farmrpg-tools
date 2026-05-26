import type { AvailableSupplyOverrideInput } from './availableSupply';
import { toCanonicalItemKey } from './normalizeItemKey';
import type { TargetOutputPlanningGoalInput } from './targetOutputPlanningModel';

export const TARGET_OUTPUT_PLANNER_STATE_STORAGE_KEY = 'farmrpg-tools.targetOutputPlannerState';

export type TargetOutputPlannerState = {
  schemaVersion: 1;
  targets: TargetOutputPlanningGoalInput[];
  supplyOverrides: AvailableSupplyOverrideInput[];
};

function clampQuantity(value: unknown): number {
  const numericValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0;
}

function normalizeTarget(value: unknown, index: number): TargetOutputPlanningGoalInput | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const itemName = typeof record.itemName === 'string' ? record.itemName.trim() : '';
  const canonicalInput = typeof record.canonicalKey === 'string' ? record.canonicalKey.trim() : '';
  const canonicalKey = toCanonicalItemKey(canonicalInput || itemName);
  const desiredQuantity = clampQuantity(record.desiredQuantity);

  if (canonicalKey.length === 0 || desiredQuantity <= 0) {
    return null;
  }

  const targetId = typeof record.targetId === 'string' && record.targetId.trim().length > 0
    ? record.targetId.trim()
    : `target:${index + 1}:${canonicalKey}`;

  return {
    targetId,
    itemName: itemName || canonicalKey,
    canonicalKey,
    desiredQuantity,
  };
}

function normalizeSupplyOverride(value: unknown): AvailableSupplyOverrideInput | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const itemName = typeof record.itemName === 'string' ? record.itemName.trim() : '';
  const canonicalInput = typeof record.canonicalKey === 'string' ? record.canonicalKey.trim() : '';
  const canonicalKey = toCanonicalItemKey(canonicalInput || itemName);
  const quantity = clampQuantity(record.quantity);

  if (canonicalKey.length === 0) {
    return null;
  }

  return {
    canonicalKey,
    itemName: itemName || canonicalKey,
    quantity,
  };
}

export function createDefaultTargetOutputPlannerState(): TargetOutputPlannerState {
  return {
    schemaVersion: 1,
    targets: [],
    supplyOverrides: [],
  };
}

export function normalizeTargetOutputPlannerState(value: unknown): TargetOutputPlannerState {
  if (!value || typeof value !== 'object') {
    return createDefaultTargetOutputPlannerState();
  }

  const record = value as Partial<TargetOutputPlannerState>;
  const targets = Array.isArray(record.targets)
    ? record.targets.map(normalizeTarget).filter((target): target is TargetOutputPlanningGoalInput => Boolean(target))
    : [];
  const dedupedTargets = new Map<string, TargetOutputPlanningGoalInput>();

  for (const target of targets) {
    dedupedTargets.set(target.targetId ?? target.canonicalKey, target);
  }

  const overrides = Array.isArray(record.supplyOverrides)
    ? record.supplyOverrides.map(normalizeSupplyOverride).filter((entry): entry is AvailableSupplyOverrideInput => Boolean(entry))
    : [];
  const dedupedOverrides = new Map<string, AvailableSupplyOverrideInput>();

  for (const override of overrides) {
    dedupedOverrides.set(override.canonicalKey, override);
  }

  return {
    schemaVersion: 1,
    targets: Array.from(dedupedTargets.values()),
    supplyOverrides: Array.from(dedupedOverrides.values()).sort((left, right) => {
      return left.itemName.localeCompare(right.itemName) || left.canonicalKey.localeCompare(right.canonicalKey);
    }),
  };
}

function getLocalStorage(storage?: Storage): Storage {
  if (storage) {
    return storage;
  }

  if (!('localStorage' in globalThis)) {
    throw new Error('localStorage is not available in this browser.');
  }

  return globalThis.localStorage;
}

export function loadTargetOutputPlannerState(storage?: Storage): TargetOutputPlannerState {
  const activeStorage = getLocalStorage(storage);
  const rawValue = activeStorage.getItem(TARGET_OUTPUT_PLANNER_STATE_STORAGE_KEY);

  if (!rawValue) {
    return createDefaultTargetOutputPlannerState();
  }

  try {
    return normalizeTargetOutputPlannerState(JSON.parse(rawValue));
  } catch {
    return createDefaultTargetOutputPlannerState();
  }
}

export function saveTargetOutputPlannerState(
  state: TargetOutputPlannerState,
  storage?: Storage,
): TargetOutputPlannerState {
  const normalizedState = normalizeTargetOutputPlannerState(state);
  getLocalStorage(storage).setItem(TARGET_OUTPUT_PLANNER_STATE_STORAGE_KEY, JSON.stringify(normalizedState));
  return normalizedState;
}

export function clearTargetOutputPlannerState(storage?: Storage): void {
  getLocalStorage(storage).removeItem(TARGET_OUTPUT_PLANNER_STATE_STORAGE_KEY);
}

export function addTargetOutputPlannerTarget(
  state: TargetOutputPlannerState,
  input: { itemName: string; desiredQuantity: number },
): TargetOutputPlannerState {
  const itemName = input.itemName.trim();
  const canonicalKey = toCanonicalItemKey(itemName);
  const desiredQuantity = clampQuantity(input.desiredQuantity);

  if (canonicalKey.length === 0 || desiredQuantity <= 0) {
    return state;
  }

  return normalizeTargetOutputPlannerState({
    ...state,
    targets: [
      ...state.targets,
      {
        targetId: `target:${Date.now().toString(36)}:${canonicalKey}`,
        itemName: itemName || canonicalKey,
        canonicalKey,
        desiredQuantity,
      },
    ],
  });
}

export function removeTargetOutputPlannerTarget(
  state: TargetOutputPlannerState,
  targetId: string,
): TargetOutputPlannerState {
  return normalizeTargetOutputPlannerState({
    ...state,
    targets: state.targets.filter((target) => target.targetId !== targetId),
  });
}

export function upsertTargetOutputSupplyOverride(
  state: TargetOutputPlannerState,
  input: { itemName: string; quantity: number },
): TargetOutputPlannerState {
  const itemName = input.itemName.trim();
  const canonicalKey = toCanonicalItemKey(itemName);

  if (canonicalKey.length === 0) {
    return state;
  }

  const nextOverrides = state.supplyOverrides.filter((entry) => entry.canonicalKey !== canonicalKey);

  if (input.quantity > 0) {
    nextOverrides.push({
      canonicalKey,
      itemName: itemName || canonicalKey,
      quantity: clampQuantity(input.quantity),
    });
  }

  return normalizeTargetOutputPlannerState({
    ...state,
    supplyOverrides: nextOverrides,
  });
}

export function removeTargetOutputSupplyOverride(
  state: TargetOutputPlannerState,
  canonicalKey: string,
): TargetOutputPlannerState {
  const normalizedKey = toCanonicalItemKey(canonicalKey);

  return normalizeTargetOutputPlannerState({
    ...state,
    supplyOverrides: state.supplyOverrides.filter((entry) => entry.canonicalKey !== normalizedKey),
  });
}
