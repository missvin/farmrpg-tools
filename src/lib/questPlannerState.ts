import { toCanonicalItemKey } from './normalizeItemKey';

export const QUEST_PLANNER_STATE_STORAGE_KEY = 'farmrpg-tools.questPlannerState.v1';

export type QuestPlannerStatus = 'unknown' | 'active' | 'watched' | 'completed';

export type QuestPlannerQuestState = {
  questKey: string;
  status: QuestPlannerStatus;
  hidden: boolean;
  observedNpc: string | null;
  observedCompletionPercent: number | null;
  lastObservedAt: string | null;
};

export type QuestPlannerState = {
  schemaVersion: 1;
  questStates: QuestPlannerQuestState[];
};

const STATUS_VALUES = new Set<QuestPlannerStatus>(['unknown', 'active', 'watched', 'completed']);

export const DEFAULT_QUEST_PLANNER_STATE: QuestPlannerState = {
  schemaVersion: 1,
  questStates: [],
};

function clampPercent(value: unknown): number | null {
  const numericValue = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return Math.max(0, Math.min(100, numericValue));
}

function normalizeStatus(value: unknown): QuestPlannerStatus {
  return typeof value === 'string' && STATUS_VALUES.has(value as QuestPlannerStatus)
    ? (value as QuestPlannerStatus)
    : 'unknown';
}

function normalizeQuestState(value: unknown): QuestPlannerQuestState | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const rawQuestKey = typeof record.questKey === 'string' ? record.questKey : '';
  const questKey = toCanonicalItemKey(rawQuestKey);

  if (!questKey) {
    return null;
  }

  const observedNpc = typeof record.observedNpc === 'string' && record.observedNpc.trim()
    ? record.observedNpc.trim()
    : null;
  const lastObservedAt = typeof record.lastObservedAt === 'string' && record.lastObservedAt.trim()
    ? record.lastObservedAt.trim()
    : null;

  return {
    questKey,
    status: normalizeStatus(record.status),
    hidden: record.hidden === true,
    observedNpc,
    observedCompletionPercent: clampPercent(record.observedCompletionPercent),
    lastObservedAt,
  };
}

export function normalizeQuestPlannerState(value: unknown): QuestPlannerState {
  if (!value || typeof value !== 'object') {
    return DEFAULT_QUEST_PLANNER_STATE;
  }

  const record = value as Record<string, unknown>;
  const questStatesInput = Array.isArray(record.questStates) ? record.questStates : [];
  const statesByQuestKey = new Map<string, QuestPlannerQuestState>();

  for (const questStateInput of questStatesInput) {
    const questState = normalizeQuestState(questStateInput);

    if (questState) {
      statesByQuestKey.set(questState.questKey, questState);
    }
  }

  return {
    schemaVersion: 1,
    questStates: Array.from(statesByQuestKey.values()).sort((left, right) => {
      return left.questKey.localeCompare(right.questKey);
    }),
  };
}

export function isValidQuestPlannerState(value: unknown): value is QuestPlannerState {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return record.schemaVersion === 1 && Array.isArray(record.questStates) &&
    record.questStates.every((questStateInput) => normalizeQuestState(questStateInput) !== null);
}

export function getQuestState(
  state: QuestPlannerState,
  questKey: string,
): QuestPlannerQuestState {
  const normalizedQuestKey = toCanonicalItemKey(questKey);
  return (
    state.questStates.find((questState) => questState.questKey === normalizedQuestKey) ?? {
      questKey: normalizedQuestKey,
      status: 'unknown',
      hidden: false,
      observedNpc: null,
      observedCompletionPercent: null,
      lastObservedAt: null,
    }
  );
}

export function upsertQuestState(
  state: QuestPlannerState,
  questKey: string,
  patch: Partial<Omit<QuestPlannerQuestState, 'questKey'>>,
): QuestPlannerState {
  const normalizedQuestKey = toCanonicalItemKey(questKey);
  const currentState = getQuestState(state, normalizedQuestKey);
  const nextQuestState = normalizeQuestState({
    ...currentState,
    ...patch,
    questKey: normalizedQuestKey,
  });

  if (!nextQuestState) {
    return state;
  }

  const nextQuestStates = state.questStates
    .filter((questState) => questState.questKey !== normalizedQuestKey)
    .concat(nextQuestState)
    .sort((left, right) => left.questKey.localeCompare(right.questKey));

  return {
    schemaVersion: 1,
    questStates: nextQuestStates,
  };
}

export function loadQuestPlannerState(storage: Storage | undefined = globalThis.localStorage): QuestPlannerState {
  if (!storage) {
    return DEFAULT_QUEST_PLANNER_STATE;
  }

  try {
    const rawValue = storage.getItem(QUEST_PLANNER_STATE_STORAGE_KEY);
    return normalizeQuestPlannerState(rawValue ? JSON.parse(rawValue) : null);
  } catch {
    return DEFAULT_QUEST_PLANNER_STATE;
  }
}

export function saveQuestPlannerState(
  state: QuestPlannerState,
  storage: Storage | undefined = globalThis.localStorage,
): QuestPlannerState {
  const normalizedState = normalizeQuestPlannerState(state);

  storage?.setItem(QUEST_PLANNER_STATE_STORAGE_KEY, JSON.stringify(normalizedState));

  return normalizedState;
}

export function clearQuestPlannerState(storage: Storage | undefined = globalThis.localStorage): void {
  storage?.removeItem(QUEST_PLANNER_STATE_STORAGE_KEY);
}
