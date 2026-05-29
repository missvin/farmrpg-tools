import { toCanonicalItemKey } from './normalizeItemKey';

export const MEMORY_HELPER_SLOT_COUNT = 24;
export const MEMORY_HELPER_COLUMNS = 6;
export const MEMORY_HELPER_ROWS = 4;
export const MEMORY_HELPER_STORAGE_KEY = 'farmrpg-tools.memoryHelperState';

export type MemoryHelperItem = {
  itemName: string;
  canonicalKey: string;
};

export type MemoryHelperSlot = {
  slotId: string;
  row: number;
  column: number;
  item: MemoryHelperItem | null;
  matched: boolean;
};

export type MemoryHelperState = {
  schemaVersion: 1;
  slots: MemoryHelperSlot[];
  undoSlots: MemoryHelperSlot[] | null;
  updatedAt: string | null;
};

export type MemoryHelperSlotStatus = 'empty' | 'single' | 'detected' | 'matched';

export type MemoryHelperDerivedSlot = MemoryHelperSlot & {
  status: MemoryHelperSlotStatus;
  pairSlotIds: string[];
};

export type MemoryHelperPairGroup = {
  canonicalKey: string;
  itemName: string;
  slotIds: string[];
  matched: boolean;
  overfilled: boolean;
};

export type MemoryHelperBoardDerivation = {
  slots: MemoryHelperDerivedSlot[];
  pairs: MemoryHelperPairGroup[];
  warnings: string[];
  summary: {
    filledSlots: number;
    emptySlots: number;
    detectedPairs: number;
    matchedPairs: number;
    remainingPairs: number;
  };
};

function nowIso(): string {
  return new Date().toISOString();
}

function createSlot(index: number, item: MemoryHelperItem | null = null, matched = false): MemoryHelperSlot {
  return {
    slotId: `slot-${index + 1}`,
    row: Math.floor(index / MEMORY_HELPER_COLUMNS) + 1,
    column: (index % MEMORY_HELPER_COLUMNS) + 1,
    item,
    matched: item ? matched : false,
  };
}

function normalizeItem(value: unknown): MemoryHelperItem | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const itemName = typeof record.itemName === 'string' ? record.itemName.trim() : '';
  const canonicalInput = typeof record.canonicalKey === 'string' ? record.canonicalKey.trim() : '';
  const canonicalKey = toCanonicalItemKey(canonicalInput || itemName);

  if (!itemName || !canonicalKey) {
    return null;
  }

  return {
    itemName,
    canonicalKey,
  };
}

function normalizeSlots(value: unknown): MemoryHelperSlot[] {
  const inputSlots = Array.isArray(value) ? value : [];

  return Array.from({ length: MEMORY_HELPER_SLOT_COUNT }, (_, index) => {
    const record = inputSlots[index] && typeof inputSlots[index] === 'object'
      ? (inputSlots[index] as Record<string, unknown>)
      : {};
    const item = normalizeItem(record.item);

    return createSlot(index, item, item ? record.matched === true : false);
  });
}

function cloneSlots(slots: MemoryHelperSlot[]): MemoryHelperSlot[] {
  return slots.map((slot) => ({
    ...slot,
    item: slot.item ? { ...slot.item } : null,
  }));
}

export function createDefaultMemoryHelperState(): MemoryHelperState {
  return {
    schemaVersion: 1,
    slots: normalizeSlots([]),
    undoSlots: null,
    updatedAt: null,
  };
}

export function normalizeMemoryHelperState(value: unknown): MemoryHelperState {
  if (!value || typeof value !== 'object') {
    return createDefaultMemoryHelperState();
  }

  const record = value as Partial<MemoryHelperState>;
  const slots = normalizeSlots(record.slots);
  const undoSlots = Array.isArray(record.undoSlots) ? normalizeSlots(record.undoSlots) : null;

  return {
    schemaVersion: 1,
    slots,
    undoSlots,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : null,
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

export function loadMemoryHelperState(storage?: Storage): MemoryHelperState {
  const rawValue = getLocalStorage(storage).getItem(MEMORY_HELPER_STORAGE_KEY);

  if (!rawValue) {
    return createDefaultMemoryHelperState();
  }

  try {
    return normalizeMemoryHelperState(JSON.parse(rawValue));
  } catch {
    return createDefaultMemoryHelperState();
  }
}

export function saveMemoryHelperState(state: MemoryHelperState, storage?: Storage): MemoryHelperState {
  const normalizedState = normalizeMemoryHelperState(state);
  getLocalStorage(storage).setItem(MEMORY_HELPER_STORAGE_KEY, JSON.stringify(normalizedState));
  return normalizedState;
}

export function clearMemoryHelperState(storage?: Storage): void {
  getLocalStorage(storage).removeItem(MEMORY_HELPER_STORAGE_KEY);
}

function applySlotsChange(
  state: MemoryHelperState,
  slots: MemoryHelperSlot[],
  updatedAt: string | undefined,
): MemoryHelperState {
  return normalizeMemoryHelperState({
    schemaVersion: 1,
    slots,
    undoSlots: cloneSlots(state.slots),
    updatedAt: updatedAt ?? nowIso(),
  });
}

function unmatchCanonicalKey(slots: MemoryHelperSlot[], canonicalKey: string): MemoryHelperSlot[] {
  return slots.map((slot) =>
    slot.item?.canonicalKey === canonicalKey
      ? {
          ...slot,
          matched: false,
        }
      : slot,
  );
}

export function setMemoryHelperSlotItem(
  state: MemoryHelperState,
  input: { slotId: string; itemName: string; canonicalKey?: string; updatedAt?: string },
): MemoryHelperState {
  const slotIndex = state.slots.findIndex((slot) => slot.slotId === input.slotId);

  if (slotIndex < 0) {
    return state;
  }

  const itemName = input.itemName.trim();
  const canonicalKey = toCanonicalItemKey(input.canonicalKey?.trim() || itemName);

  if (!itemName || !canonicalKey) {
    return clearMemoryHelperSlot(state, input.slotId, input.updatedAt);
  }

  const previousItemKey = state.slots[slotIndex].item?.canonicalKey ?? null;
  const nextSlots = previousItemKey ? unmatchCanonicalKey(cloneSlots(state.slots), previousItemKey) : cloneSlots(state.slots);

  nextSlots[slotIndex] = {
    ...nextSlots[slotIndex],
    item: {
      itemName,
      canonicalKey,
    },
    matched: false,
  };

  return applySlotsChange(state, nextSlots, input.updatedAt);
}

export function clearMemoryHelperSlot(
  state: MemoryHelperState,
  slotId: string,
  updatedAt?: string,
): MemoryHelperState {
  const slotIndex = state.slots.findIndex((slot) => slot.slotId === slotId);

  if (slotIndex < 0) {
    return state;
  }

  const previousItemKey = state.slots[slotIndex].item?.canonicalKey ?? null;
  const nextSlots = previousItemKey ? unmatchCanonicalKey(cloneSlots(state.slots), previousItemKey) : cloneSlots(state.slots);
  nextSlots[slotIndex] = createSlot(slotIndex);

  return applySlotsChange(state, nextSlots, updatedAt);
}

export function setMemoryHelperPairMatched(
  state: MemoryHelperState,
  canonicalKey: string,
  matched: boolean,
  updatedAt?: string,
): MemoryHelperState {
  const normalizedKey = toCanonicalItemKey(canonicalKey);

  if (!normalizedKey || !state.slots.some((slot) => slot.item?.canonicalKey === normalizedKey)) {
    return state;
  }

  const nextSlots = state.slots.map((slot) =>
    slot.item?.canonicalKey === normalizedKey
      ? {
          ...slot,
          matched,
        }
      : slot,
  );

  return applySlotsChange(state, nextSlots, updatedAt);
}

export function resetMemoryHelperGame(state: MemoryHelperState, updatedAt?: string): MemoryHelperState {
  return applySlotsChange(state, normalizeSlots([]), updatedAt);
}

export function undoMemoryHelperAction(state: MemoryHelperState, updatedAt?: string): MemoryHelperState {
  if (!state.undoSlots) {
    return state;
  }

  return normalizeMemoryHelperState({
    schemaVersion: 1,
    slots: cloneSlots(state.undoSlots),
    undoSlots: null,
    updatedAt: updatedAt ?? nowIso(),
  });
}

export function deriveMemoryHelperBoard(state: MemoryHelperState): MemoryHelperBoardDerivation {
  const slots = normalizeMemoryHelperState(state).slots;
  const slotsByCanonicalKey = new Map<string, MemoryHelperSlot[]>();

  for (const slot of slots) {
    if (!slot.item) {
      continue;
    }

    const group = slotsByCanonicalKey.get(slot.item.canonicalKey) ?? [];
    group.push(slot);
    slotsByCanonicalKey.set(slot.item.canonicalKey, group);
  }

  const pairs: MemoryHelperPairGroup[] = [];
  const warnings: string[] = [];

  for (const [canonicalKey, groupSlots] of slotsByCanonicalKey.entries()) {
    if (groupSlots.length < 2) {
      continue;
    }

    const overfilled = groupSlots.length > 2;
    const matched = groupSlots.every((slot) => slot.matched);
    const itemName = groupSlots[0].item?.itemName ?? canonicalKey;

    if (overfilled) {
      warnings.push(`${itemName} appears in ${groupSlots.length} cells; the mini-game should only have one pair.`);
    }

    pairs.push({
      canonicalKey,
      itemName,
      slotIds: groupSlots.map((slot) => slot.slotId),
      matched,
      overfilled,
    });
  }

  const pairLookup = new Map(pairs.map((pair) => [pair.canonicalKey, pair]));
  const derivedSlots: MemoryHelperDerivedSlot[] = slots.map((slot) => {
    const pair = slot.item ? pairLookup.get(slot.item.canonicalKey) : null;

    return {
      ...slot,
      status: !slot.item ? 'empty' : pair?.matched ? 'matched' : pair ? 'detected' : 'single',
      pairSlotIds: pair?.slotIds ?? [],
    };
  });
  const matchedPairs = pairs.filter((pair) => pair.matched).length;

  return {
    slots: derivedSlots,
    pairs: pairs.sort((left, right) => left.itemName.localeCompare(right.itemName)),
    warnings,
    summary: {
      filledSlots: slots.filter((slot) => slot.item).length,
      emptySlots: slots.filter((slot) => !slot.item).length,
      detectedPairs: pairs.length,
      matchedPairs,
      remainingPairs: Math.max(0, 12 - matchedPairs),
    },
  };
}
