import { toCanonicalItemKey } from './normalizeItemKey';

export const MEMORY_GAME_OBSERVATION_STORAGE_KEY = 'farmrpg-tools.memoryGameObservationState.v1';
export const MEMORY_GAME_OBSERVATION_EXPORT_MIME_TYPE = 'text/csv;charset=utf-8';

export type MemoryGameObservedTier = '4' | 'unknown';

export type MemoryGameObservationRecord = {
  canonicalKey: string;
  itemName: string;
  observedTier: MemoryGameObservedTier;
  observationCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  sampleSessionIds: string[];
  sampleSlots: string[];
  warningTexts: string[];
};

export type MemoryGameObservationState = {
  schemaVersion: 1;
  records: MemoryGameObservationRecord[];
  updatedAt: string | null;
};

export type RecordMemoryGameObservationInput = {
  itemName: string;
  canonicalKey?: string;
  observedTier?: MemoryGameObservedTier;
  observedAt?: string;
  sessionId?: string | null;
  slotSummary?: string | null;
  warningTexts?: string[];
};

const MAX_SAMPLE_VALUES = 5;

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map(normalizeText).filter(Boolean))].slice(0, MAX_SAMPLE_VALUES);
}

function normalizeObservedTier(value: unknown): MemoryGameObservedTier {
  return value === '4' ? '4' : 'unknown';
}

function normalizeRecord(value: unknown): MemoryGameObservationRecord | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Partial<MemoryGameObservationRecord>;
  const itemName = normalizeText(record.itemName);
  const canonicalKey = toCanonicalItemKey(normalizeText(record.canonicalKey) || itemName);

  if (!itemName || !canonicalKey) {
    return null;
  }

  const observationCount =
    typeof record.observationCount === 'number' && Number.isFinite(record.observationCount)
      ? Math.max(1, Math.floor(record.observationCount))
      : 1;
  const observedAt = normalizeText(record.lastSeenAt) || normalizeText(record.firstSeenAt) || nowIso();

  return {
    canonicalKey,
    itemName,
    observedTier: normalizeObservedTier(record.observedTier),
    observationCount,
    firstSeenAt: normalizeText(record.firstSeenAt) || observedAt,
    lastSeenAt: observedAt,
    sampleSessionIds: normalizeStringList(record.sampleSessionIds),
    sampleSlots: normalizeStringList(record.sampleSlots),
    warningTexts: normalizeStringList(record.warningTexts),
  };
}

export function createDefaultMemoryGameObservationState(): MemoryGameObservationState {
  return {
    schemaVersion: 1,
    records: [],
    updatedAt: null,
  };
}

export function normalizeMemoryGameObservationState(value: unknown): MemoryGameObservationState {
  if (!value || typeof value !== 'object') {
    return createDefaultMemoryGameObservationState();
  }

  const record = value as Partial<MemoryGameObservationState>;
  const records = Array.isArray(record.records)
    ? record.records.map(normalizeRecord).filter((entry): entry is MemoryGameObservationRecord => entry !== null)
    : [];

  return {
    schemaVersion: 1,
    records: mergeObservationRecords(records),
    updatedAt: normalizeText(record.updatedAt) || null,
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

export function loadMemoryGameObservationState(storage?: Storage): MemoryGameObservationState {
  const rawValue = getLocalStorage(storage).getItem(MEMORY_GAME_OBSERVATION_STORAGE_KEY);

  if (!rawValue) {
    return createDefaultMemoryGameObservationState();
  }

  try {
    return normalizeMemoryGameObservationState(JSON.parse(rawValue));
  } catch {
    return createDefaultMemoryGameObservationState();
  }
}

export function saveMemoryGameObservationState(
  state: MemoryGameObservationState,
  storage?: Storage,
): MemoryGameObservationState {
  const normalizedState = normalizeMemoryGameObservationState(state);
  getLocalStorage(storage).setItem(MEMORY_GAME_OBSERVATION_STORAGE_KEY, JSON.stringify(normalizedState));
  return normalizedState;
}

export function clearMemoryGameObservationState(storage?: Storage): void {
  getLocalStorage(storage).removeItem(MEMORY_GAME_OBSERVATION_STORAGE_KEY);
}

function appendSampleValue(values: string[], value: string | null | undefined): string[] {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue || values.includes(normalizedValue)) {
    return values;
  }

  return [...values, normalizedValue].slice(-MAX_SAMPLE_VALUES);
}

function mergeRecordPair(
  currentRecord: MemoryGameObservationRecord,
  nextRecord: MemoryGameObservationRecord,
): MemoryGameObservationRecord {
  return {
    canonicalKey: currentRecord.canonicalKey,
    itemName:
      nextRecord.lastSeenAt >= currentRecord.lastSeenAt
        ? nextRecord.itemName
        : currentRecord.itemName,
    observedTier:
      currentRecord.observedTier === '4' || nextRecord.observedTier === '4'
        ? '4'
        : 'unknown',
    observationCount: currentRecord.observationCount + nextRecord.observationCount,
    firstSeenAt:
      currentRecord.firstSeenAt <= nextRecord.firstSeenAt
        ? currentRecord.firstSeenAt
        : nextRecord.firstSeenAt,
    lastSeenAt:
      currentRecord.lastSeenAt >= nextRecord.lastSeenAt
        ? currentRecord.lastSeenAt
        : nextRecord.lastSeenAt,
    sampleSessionIds: [...new Set([...currentRecord.sampleSessionIds, ...nextRecord.sampleSessionIds])].slice(
      -MAX_SAMPLE_VALUES,
    ),
    sampleSlots: [...new Set([...currentRecord.sampleSlots, ...nextRecord.sampleSlots])].slice(-MAX_SAMPLE_VALUES),
    warningTexts: [...new Set([...currentRecord.warningTexts, ...nextRecord.warningTexts])].slice(-MAX_SAMPLE_VALUES),
  };
}

function mergeObservationRecords(records: MemoryGameObservationRecord[]): MemoryGameObservationRecord[] {
  const recordsByCanonicalKey = new Map<string, MemoryGameObservationRecord>();

  for (const record of records) {
    const existingRecord = recordsByCanonicalKey.get(record.canonicalKey);
    recordsByCanonicalKey.set(record.canonicalKey, existingRecord ? mergeRecordPair(existingRecord, record) : record);
  }

  return [...recordsByCanonicalKey.values()].sort(
    (left, right) =>
      right.observationCount - left.observationCount ||
      right.lastSeenAt.localeCompare(left.lastSeenAt) ||
      left.itemName.localeCompare(right.itemName) ||
      left.canonicalKey.localeCompare(right.canonicalKey),
  );
}

export function recordMemoryGameObservation(
  state: MemoryGameObservationState,
  input: RecordMemoryGameObservationInput,
): MemoryGameObservationState {
  const itemName = normalizeText(input.itemName);
  const canonicalKey = toCanonicalItemKey(normalizeText(input.canonicalKey) || itemName);

  if (!itemName || !canonicalKey) {
    return normalizeMemoryGameObservationState(state);
  }

  const observedAt = input.observedAt ?? nowIso();
  const nextRecord: MemoryGameObservationRecord = {
    canonicalKey,
    itemName,
    observedTier: input.observedTier ?? '4',
    observationCount: 1,
    firstSeenAt: observedAt,
    lastSeenAt: observedAt,
    sampleSessionIds: appendSampleValue([], input.sessionId),
    sampleSlots: appendSampleValue([], input.slotSummary),
    warningTexts: normalizeStringList(input.warningTexts ?? []),
  };

  return normalizeMemoryGameObservationState({
    schemaVersion: 1,
    records: mergeObservationRecords([...state.records, nextRecord]),
    updatedAt: observedAt,
  });
}

function toCsvCell(value: string | number | null | undefined): string {
  const rawValue = String(value ?? '');
  return /[",\r\n]/.test(rawValue) ? `"${rawValue.replace(/"/g, '""')}"` : rawValue;
}

export function toMemoryGameObservationCsv(state: MemoryGameObservationState): string {
  const normalizedState = normalizeMemoryGameObservationState(state);
  const rows = [
    [
      'item_name',
      'canonical_key',
      'observed_tier',
      'observation_count',
      'first_seen_at',
      'last_seen_at',
      'sample_session_ids',
      'sample_slots',
      'warning_text',
      'promotion_note',
    ],
  ];

  for (const record of normalizedState.records) {
    rows.push([
      record.itemName,
      record.canonicalKey,
      record.observedTier,
      String(record.observationCount),
      record.firstSeenAt,
      record.lastSeenAt,
      record.sampleSessionIds.join('; '),
      record.sampleSlots.join('; '),
      record.warningTexts.join('; '),
      'Local observation evidence only; review before promoting to data/memory_game_allowed_items.csv.',
    ]);
  }

  return `${rows.map((row) => row.map(toCsvCell).join(',')).join('\n')}\n`;
}

export function createMemoryGameObservationExportFilename(exportedAt = nowIso()): string {
  const safeTimestamp = exportedAt.replace(/[:.]/g, '-');
  return `borgen-lost-and-found-observations-${safeTimestamp}.csv`;
}
