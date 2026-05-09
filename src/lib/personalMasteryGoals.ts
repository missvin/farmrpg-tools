import { toCanonicalItemKey } from './normalizeItemKey';
import type { MasteryTargetTier } from './pumpkinJuiceEstimator';

export const PERSONAL_MASTERY_GOALS_STORAGE_KEY = 'farmrpg-tools.personalMasteryGoals';

export type PersonalMasteryGoal = {
  goalId: string;
  itemName: string;
  canonicalKey: string;
  targetTier: MasteryTargetTier;
  createdAt: string;
  updatedAt: string;
};

export type PersonalMasteryGoalsState = {
  schemaVersion: 1;
  goals: PersonalMasteryGoal[];
};

export type UpsertPersonalMasteryGoalInput = {
  goalId?: string;
  itemName: string;
  targetTier: MasteryTargetTier;
  now?: string;
};

const VALID_TARGET_TIERS = new Set<MasteryTargetTier>(['M', 'GM', 'MM']);

function getLocalStorage(storage?: Storage): Storage {
  if (storage) {
    return storage;
  }

  if (!('localStorage' in globalThis)) {
    throw new Error('localStorage is not available in this browser.');
  }

  return globalThis.localStorage;
}

function createGoalId(): string {
  if ('crypto' in globalThis && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `goal-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function normalizeTargetTier(value: unknown): MasteryTargetTier {
  return VALID_TARGET_TIERS.has(value as MasteryTargetTier) ? (value as MasteryTargetTier) : 'MM';
}

function normalizeGoal(value: unknown): PersonalMasteryGoal | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const itemName = typeof record.itemName === 'string' ? record.itemName.trim() : '';
  const canonicalKeyInput = typeof record.canonicalKey === 'string' ? record.canonicalKey.trim() : '';
  const canonicalKey = canonicalKeyInput.length > 0 ? toCanonicalItemKey(canonicalKeyInput) : toCanonicalItemKey(itemName);
  const targetTier = normalizeTargetTier(record.targetTier);
  const goalId = typeof record.goalId === 'string' && record.goalId.trim().length > 0
    ? record.goalId.trim()
    : `${canonicalKey}:${targetTier}`;
  const createdAt = typeof record.createdAt === 'string' && record.createdAt.length > 0
    ? record.createdAt
    : new Date(0).toISOString();
  const updatedAt = typeof record.updatedAt === 'string' && record.updatedAt.length > 0
    ? record.updatedAt
    : createdAt;

  if (canonicalKey.length === 0) {
    return null;
  }

  return {
    goalId,
    itemName: itemName.length > 0 ? itemName : canonicalKey,
    canonicalKey,
    targetTier,
    createdAt,
    updatedAt,
  };
}

export function createDefaultPersonalMasteryGoalsState(): PersonalMasteryGoalsState {
  return {
    schemaVersion: 1,
    goals: [],
  };
}

export function normalizePersonalMasteryGoalsState(value: unknown): PersonalMasteryGoalsState {
  if (!value || typeof value !== 'object') {
    return createDefaultPersonalMasteryGoalsState();
  }

  const record = value as Partial<PersonalMasteryGoalsState>;
  const dedupedGoals = new Map<string, PersonalMasteryGoal>();

  if (Array.isArray(record.goals)) {
    for (const goal of record.goals) {
      const normalizedGoal = normalizeGoal(goal);

      if (!normalizedGoal) {
        continue;
      }

      dedupedGoals.set(`${normalizedGoal.canonicalKey}:${normalizedGoal.targetTier}`, normalizedGoal);
    }
  }

  return {
    schemaVersion: 1,
    goals: [...dedupedGoals.values()].sort((left, right) => {
      return (
        left.itemName.localeCompare(right.itemName) ||
        left.targetTier.localeCompare(right.targetTier) ||
        left.goalId.localeCompare(right.goalId)
      );
    }),
  };
}

export function loadPersonalMasteryGoalsState(storage?: Storage): PersonalMasteryGoalsState {
  const activeStorage = getLocalStorage(storage);
  const rawValue = activeStorage.getItem(PERSONAL_MASTERY_GOALS_STORAGE_KEY);

  if (!rawValue) {
    return createDefaultPersonalMasteryGoalsState();
  }

  try {
    return normalizePersonalMasteryGoalsState(JSON.parse(rawValue));
  } catch {
    return createDefaultPersonalMasteryGoalsState();
  }
}

export function savePersonalMasteryGoalsState(
  state: PersonalMasteryGoalsState,
  storage?: Storage,
): PersonalMasteryGoalsState {
  const normalizedState = normalizePersonalMasteryGoalsState(state);
  const activeStorage = getLocalStorage(storage);

  activeStorage.setItem(PERSONAL_MASTERY_GOALS_STORAGE_KEY, JSON.stringify(normalizedState));
  return normalizedState;
}

export function clearPersonalMasteryGoalsState(storage?: Storage): void {
  const activeStorage = getLocalStorage(storage);
  activeStorage.removeItem(PERSONAL_MASTERY_GOALS_STORAGE_KEY);
}

export function upsertPersonalMasteryGoal(
  state: PersonalMasteryGoalsState,
  input: UpsertPersonalMasteryGoalInput,
): PersonalMasteryGoalsState {
  const itemName = input.itemName.trim();
  const canonicalKey = toCanonicalItemKey(itemName);
  const now = input.now ?? new Date().toISOString();

  if (canonicalKey.length === 0) {
    return state;
  }

  const existingGoal = state.goals.find((goal) => {
    if (input.goalId && goal.goalId === input.goalId) {
      return true;
    }

    return goal.canonicalKey === canonicalKey && goal.targetTier === input.targetTier;
  });
  const nextGoal: PersonalMasteryGoal = {
    goalId: existingGoal?.goalId ?? input.goalId ?? createGoalId(),
    itemName: itemName.length > 0 ? itemName : canonicalKey,
    canonicalKey,
    targetTier: input.targetTier,
    createdAt: existingGoal?.createdAt ?? now,
    updatedAt: now,
  };
  const goals = state.goals.filter((goal) => goal.goalId !== nextGoal.goalId);

  return normalizePersonalMasteryGoalsState({
    schemaVersion: 1,
    goals: [...goals, nextGoal],
  });
}

export function removePersonalMasteryGoal(
  state: PersonalMasteryGoalsState,
  goalId: string,
): PersonalMasteryGoalsState {
  return normalizePersonalMasteryGoalsState({
    schemaVersion: 1,
    goals: state.goals.filter((goal) => goal.goalId !== goalId),
  });
}
