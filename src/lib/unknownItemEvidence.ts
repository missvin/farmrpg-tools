import { toCanonicalItemKey } from './normalizeItemKey';

export const UNKNOWN_ITEM_EVIDENCE_STORAGE_KEY = 'farmrpg-tools.unknown-item-evidence.v1';

export type UnknownItemEvidenceSourceType =
  | 'current_inventory_import'
  | 'stored_pet_inventory_import'
  | 'locksmith_import'
  | 'lost_and_found'
  | 'museum_tools'
  | 'quest_source'
  | 'local_reference_review'
  | 'manual'
  | 'other';

export type UnknownItemReviewState = 'new' | 'ignored' | 'needs_more_evidence' | 'reviewed';

export type UnknownItemPromotionTarget =
  | 'needs_more_evidence'
  | 'item_catalog'
  | 'item_aliases'
  | 'museum_lookup_coverage'
  | 'memory_game_allowed_items'
  | 'buddy_icon_candidates';

export type UnknownItemEvidenceRecord = {
  evidenceId: string;
  sourceType: UnknownItemEvidenceSourceType;
  sourceLabel: string;
  observedName: string;
  normalizedKey: string;
  occurrenceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  sampleContext: string;
  warningText: string;
};

export type UnknownItemReviewDecision = {
  normalizedKey: string;
  displayName: string;
  reviewState: Exclude<UnknownItemReviewState, 'new'>;
  targetDestination: UnknownItemPromotionTarget;
  notes: string;
  updatedAt: string;
};

export type UnknownItemEvidenceState = {
  schemaVersion: 1;
  evidenceRecords: UnknownItemEvidenceRecord[];
  reviewDecisions: UnknownItemReviewDecision[];
};

export type UnknownItemEvidenceInput = {
  sourceType: UnknownItemEvidenceSourceType;
  sourceLabel: string;
  observedName: string;
  sampleContext?: string;
  warningText?: string;
  occurrenceCount?: number;
  observedAt?: string;
};

export type UnknownItemReviewGroup = {
  normalizedKey: string;
  displayName: string;
  reviewState: UnknownItemReviewState;
  targetDestination: UnknownItemPromotionTarget;
  notes: string;
  totalOccurrences: number;
  sourceLabels: string[];
  sourceTypes: UnknownItemEvidenceSourceType[];
  firstSeenAt: string;
  lastSeenAt: string;
  evidenceRecords: UnknownItemEvidenceRecord[];
};

const UNKNOWN_ITEM_WARNING_PATTERNS = [
  /item\s+"([^"]+)"\s+was not found in local reference data and was kept as entered/i,
  /^"([^"]+)"\s+was not found in local reference data and was kept as entered/i,
];

const FIRST_UNKNOWN_BATCH_ITEMS = [
  'Planet Egg',
  'Sun Egg',
  'Moon Egg',
  'Lucky Bacon',
  'Nebula Egg',
  'Gloorp',
  'Lucky Eggs',
  'Day Off Voucher',
  'Comet Egg',
  'Asteroid Egg',
  'Black Hole Egg',
  'Egg Buddy Doll',
  'Slimed Buddy Doll',
  "Thomas's Red Velvet Cake",
  'Red Velvet Cake',
];

export const UNKNOWN_ITEM_PROMOTION_TARGET_LABELS: Record<UnknownItemPromotionTarget, string> = {
  needs_more_evidence: 'Needs more evidence',
  item_catalog: 'Item catalog candidate',
  item_aliases: 'Item alias candidate',
  museum_lookup_coverage: 'Museum lookup coverage candidate',
  memory_game_allowed_items: 'Borgen allowed-item candidate',
  buddy_icon_candidates: 'Buddy/icon candidate',
};

export const UNKNOWN_ITEM_REVIEW_STATE_LABELS: Record<UnknownItemReviewState, string> = {
  new: 'New',
  ignored: 'Ignored',
  needs_more_evidence: 'Needs more evidence',
  reviewed: 'Reviewed',
};

export function createDefaultUnknownItemEvidenceState(): UnknownItemEvidenceState {
  return {
    schemaVersion: 1,
    evidenceRecords: [],
    reviewDecisions: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSourceType(value: unknown): value is UnknownItemEvidenceSourceType {
  return (
    value === 'current_inventory_import' ||
    value === 'stored_pet_inventory_import' ||
    value === 'locksmith_import' ||
    value === 'lost_and_found' ||
    value === 'museum_tools' ||
    value === 'quest_source' ||
    value === 'local_reference_review' ||
    value === 'manual' ||
    value === 'other'
  );
}

function isReviewState(value: unknown): value is UnknownItemReviewDecision['reviewState'] {
  return value === 'ignored' || value === 'needs_more_evidence' || value === 'reviewed';
}

function isPromotionTarget(value: unknown): value is UnknownItemPromotionTarget {
  return (
    value === 'needs_more_evidence' ||
    value === 'item_catalog' ||
    value === 'item_aliases' ||
    value === 'museum_lookup_coverage' ||
    value === 'memory_game_allowed_items' ||
    value === 'buddy_icon_candidates'
  );
}

function normalizeEvidenceRecord(value: unknown): UnknownItemEvidenceRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  const normalizedKey =
    typeof value.normalizedKey === 'string'
      ? value.normalizedKey
      : typeof value.observedName === 'string'
        ? toCanonicalItemKey(value.observedName)
        : '';

  if (
    typeof value.evidenceId !== 'string' ||
    !isSourceType(value.sourceType) ||
    typeof value.sourceLabel !== 'string' ||
    typeof value.observedName !== 'string' ||
    normalizedKey.length === 0 ||
    typeof value.firstSeenAt !== 'string' ||
    typeof value.lastSeenAt !== 'string'
  ) {
    return null;
  }

  const occurrenceCount = typeof value.occurrenceCount === 'number' && Number.isFinite(value.occurrenceCount)
    ? Math.max(1, Math.floor(value.occurrenceCount))
    : 1;

  return {
    evidenceId: value.evidenceId,
    sourceType: value.sourceType,
    sourceLabel: value.sourceLabel,
    observedName: value.observedName,
    normalizedKey,
    occurrenceCount,
    firstSeenAt: value.firstSeenAt,
    lastSeenAt: value.lastSeenAt,
    sampleContext: typeof value.sampleContext === 'string' ? value.sampleContext : '',
    warningText: typeof value.warningText === 'string' ? value.warningText : '',
  };
}

function normalizeReviewDecision(value: unknown): UnknownItemReviewDecision | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.normalizedKey !== 'string' ||
    value.normalizedKey.length === 0 ||
    typeof value.displayName !== 'string' ||
    !isReviewState(value.reviewState) ||
    !isPromotionTarget(value.targetDestination) ||
    typeof value.updatedAt !== 'string'
  ) {
    return null;
  }

  return {
    normalizedKey: value.normalizedKey,
    displayName: value.displayName,
    reviewState: value.reviewState,
    targetDestination: value.targetDestination,
    notes: typeof value.notes === 'string' ? value.notes : '',
    updatedAt: value.updatedAt,
  };
}

export function normalizeUnknownItemEvidenceState(value: unknown): UnknownItemEvidenceState {
  if (!isRecord(value) || value.schemaVersion !== 1) {
    return createDefaultUnknownItemEvidenceState();
  }

  return {
    schemaVersion: 1,
    evidenceRecords: Array.isArray(value.evidenceRecords)
      ? value.evidenceRecords.map(normalizeEvidenceRecord).filter((record): record is UnknownItemEvidenceRecord => record !== null)
      : [],
    reviewDecisions: Array.isArray(value.reviewDecisions)
      ? value.reviewDecisions.map(normalizeReviewDecision).filter((decision): decision is UnknownItemReviewDecision => decision !== null)
      : [],
  };
}

export function isValidUnknownItemEvidenceState(value: unknown): value is UnknownItemEvidenceState {
  if (!isRecord(value) || value.schemaVersion !== 1) {
    return false;
  }

  if (!Array.isArray(value.evidenceRecords) || !Array.isArray(value.reviewDecisions)) {
    return false;
  }

  return (
    value.evidenceRecords.every((record) => normalizeEvidenceRecord(record) !== null) &&
    value.reviewDecisions.every((decision) => normalizeReviewDecision(decision) !== null)
  );
}

export function loadUnknownItemEvidenceState(): UnknownItemEvidenceState {
  if (!('localStorage' in globalThis)) {
    return createDefaultUnknownItemEvidenceState();
  }

  try {
    return normalizeUnknownItemEvidenceState(
      JSON.parse(globalThis.localStorage.getItem(UNKNOWN_ITEM_EVIDENCE_STORAGE_KEY) ?? 'null'),
    );
  } catch {
    return createDefaultUnknownItemEvidenceState();
  }
}

export function saveUnknownItemEvidenceState(state: UnknownItemEvidenceState): UnknownItemEvidenceState {
  const normalizedState = normalizeUnknownItemEvidenceState(state);

  if ('localStorage' in globalThis) {
    globalThis.localStorage.setItem(UNKNOWN_ITEM_EVIDENCE_STORAGE_KEY, JSON.stringify(normalizedState));
  }

  return normalizedState;
}

export function clearUnknownItemEvidenceState(): void {
  if ('localStorage' in globalThis) {
    globalThis.localStorage.removeItem(UNKNOWN_ITEM_EVIDENCE_STORAGE_KEY);
  }
}

function createEvidenceId(input: UnknownItemEvidenceInput, normalizedKey: string): string {
  const base = [
    normalizedKey,
    input.sourceType,
    input.sourceLabel,
    input.sampleContext ?? '',
    input.warningText ?? '',
  ].join('|');

  return toCanonicalItemKey(base) || `${normalizedKey}|${input.sourceType}`;
}

export function createUnknownItemEvidenceRecord(input: UnknownItemEvidenceInput): UnknownItemEvidenceRecord | null {
  const observedName = input.observedName.trim();
  const normalizedKey = toCanonicalItemKey(observedName);
  const observedAt = input.observedAt ?? new Date().toISOString();

  if (!observedName || !normalizedKey) {
    return null;
  }

  return {
    evidenceId: createEvidenceId(input, normalizedKey),
    sourceType: input.sourceType,
    sourceLabel: input.sourceLabel.trim() || 'Unknown source',
    observedName,
    normalizedKey,
    occurrenceCount: Math.max(1, Math.floor(input.occurrenceCount ?? 1)),
    firstSeenAt: observedAt,
    lastSeenAt: observedAt,
    sampleContext: input.sampleContext?.trim() ?? '',
    warningText: input.warningText?.trim() ?? '',
  };
}

export function createUnknownItemEvidenceFromWarnings(
  warnings: string[],
  source: Pick<UnknownItemEvidenceInput, 'sourceType' | 'sourceLabel'>,
  observedAt = new Date().toISOString(),
): UnknownItemEvidenceRecord[] {
  const records: UnknownItemEvidenceRecord[] = [];

  for (const warning of warnings) {
    for (const pattern of UNKNOWN_ITEM_WARNING_PATTERNS) {
      const match = pattern.exec(warning);

      if (!match) {
        continue;
      }

      const record = createUnknownItemEvidenceRecord({
        ...source,
        observedName: match[1],
        sampleContext: warning,
        warningText: warning,
        observedAt,
      });

      if (record) {
        records.push(record);
      }

      break;
    }
  }

  return records;
}

export function createFirstUnknownInventoryBatchEvidence(
  observedAt = new Date().toISOString(),
): UnknownItemEvidenceRecord[] {
  return FIRST_UNKNOWN_BATCH_ITEMS.map((itemName) =>
    createUnknownItemEvidenceRecord({
      sourceType: 'current_inventory_import',
      sourceLabel: 'First unknown inventory review batch',
      observedName: itemName,
      sampleContext: 'Seeded from recent inventory import warnings for review.',
      warningText: `${itemName} was reported as missing local reference coverage.`,
      observedAt,
    }),
  ).filter((record): record is UnknownItemEvidenceRecord => record !== null);
}

export function addUnknownItemEvidenceRecords(
  state: UnknownItemEvidenceState,
  records: UnknownItemEvidenceRecord[],
): UnknownItemEvidenceState {
  const recordsById = new Map<string, UnknownItemEvidenceRecord>();

  for (const record of normalizeUnknownItemEvidenceState(state).evidenceRecords) {
    recordsById.set(record.evidenceId, { ...record });
  }

  for (const record of records) {
    const existingRecord = recordsById.get(record.evidenceId);

    if (existingRecord) {
      existingRecord.occurrenceCount += record.occurrenceCount;
      existingRecord.firstSeenAt =
        existingRecord.firstSeenAt <= record.firstSeenAt ? existingRecord.firstSeenAt : record.firstSeenAt;
      existingRecord.lastSeenAt =
        existingRecord.lastSeenAt >= record.lastSeenAt ? existingRecord.lastSeenAt : record.lastSeenAt;
      continue;
    }

    recordsById.set(record.evidenceId, { ...record });
  }

  return {
    schemaVersion: 1,
    evidenceRecords: [...recordsById.values()].sort(
      (left, right) =>
        left.normalizedKey.localeCompare(right.normalizedKey) ||
        left.sourceLabel.localeCompare(right.sourceLabel) ||
        left.evidenceId.localeCompare(right.evidenceId),
    ),
    reviewDecisions: normalizeUnknownItemEvidenceState(state).reviewDecisions,
  };
}

export function recordUnknownItemEvidence(records: UnknownItemEvidenceRecord[]): UnknownItemEvidenceState {
  if (records.length === 0) {
    return loadUnknownItemEvidenceState();
  }

  return saveUnknownItemEvidenceState(addUnknownItemEvidenceRecords(loadUnknownItemEvidenceState(), records));
}

export function setUnknownItemReviewDecision(
  state: UnknownItemEvidenceState,
  input: {
    normalizedKey: string;
    displayName: string;
    reviewState: UnknownItemReviewDecision['reviewState'];
    targetDestination: UnknownItemPromotionTarget;
    notes?: string;
    updatedAt?: string;
  },
): UnknownItemEvidenceState {
  const normalizedState = normalizeUnknownItemEvidenceState(state);
  const nextDecisions = normalizedState.reviewDecisions.filter((decision) => {
    return decision.normalizedKey !== input.normalizedKey;
  });

  nextDecisions.push({
    normalizedKey: input.normalizedKey,
    displayName: input.displayName.trim() || input.normalizedKey,
    reviewState: input.reviewState,
    targetDestination: input.targetDestination,
    notes: input.notes?.trim() ?? '',
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  });

  return {
    ...normalizedState,
    reviewDecisions: nextDecisions.sort((left, right) => left.normalizedKey.localeCompare(right.normalizedKey)),
  };
}

export function groupUnknownItemEvidence(state: UnknownItemEvidenceState): UnknownItemReviewGroup[] {
  const normalizedState = normalizeUnknownItemEvidenceState(state);
  const decisionsByKey = new Map(
    normalizedState.reviewDecisions.map((decision) => [decision.normalizedKey, decision]),
  );
  const evidenceByKey = new Map<string, UnknownItemEvidenceRecord[]>();

  for (const record of normalizedState.evidenceRecords) {
    const records = evidenceByKey.get(record.normalizedKey) ?? [];
    records.push(record);
    evidenceByKey.set(record.normalizedKey, records);
  }

  return [...evidenceByKey.entries()]
    .map(([normalizedKey, evidenceRecords]) => {
      const decision = decisionsByKey.get(normalizedKey);
      const reviewState: UnknownItemReviewState = decision?.reviewState ?? 'new';
      const sourceLabels = [...new Set(evidenceRecords.map((record) => record.sourceLabel))].sort((left, right) =>
        left.localeCompare(right),
      );
      const sourceTypes = [...new Set(evidenceRecords.map((record) => record.sourceType))].sort((left, right) =>
        left.localeCompare(right),
      );
      const sortedRecords = [...evidenceRecords].sort((left, right) => {
        return right.lastSeenAt.localeCompare(left.lastSeenAt) || left.sourceLabel.localeCompare(right.sourceLabel);
      });

      return {
        normalizedKey,
        displayName: decision?.displayName ?? sortedRecords[0]?.observedName ?? normalizedKey,
        reviewState,
        targetDestination: decision?.targetDestination ?? 'needs_more_evidence',
        notes: decision?.notes ?? '',
        totalOccurrences: evidenceRecords.reduce((total, record) => total + record.occurrenceCount, 0),
        sourceLabels,
        sourceTypes,
        firstSeenAt: evidenceRecords.reduce((earliest, record) => {
          return earliest <= record.firstSeenAt ? earliest : record.firstSeenAt;
        }, sortedRecords[0]?.firstSeenAt ?? ''),
        lastSeenAt: evidenceRecords.reduce((latest, record) => {
          return latest >= record.lastSeenAt ? latest : record.lastSeenAt;
        }, sortedRecords[0]?.lastSeenAt ?? ''),
        evidenceRecords: sortedRecords,
      };
    })
    .sort((left, right) => {
      const stateRank = { new: 0, needs_more_evidence: 1, reviewed: 2, ignored: 3 };
      return (
        stateRank[left.reviewState] - stateRank[right.reviewState] ||
        right.lastSeenAt.localeCompare(left.lastSeenAt) ||
        left.displayName.localeCompare(right.displayName)
      );
    });
}

function escapeCsvValue(value: string): string {
  if (/[",\n]/u.test(value)) {
    return `"${value.replace(/"/gu, '""')}"`;
  }

  return value;
}

function toBuddySlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .replace(/-+/gu, '-');
}

export function toUnknownItemPromotionReviewCsv(groups: UnknownItemReviewGroup[]): string {
  const rows = [
    'observed_item_name,normalized_key,review_state,target_destination,mastery_possible_default,source_types,source_labels,total_occurrences,first_seen_at,last_seen_at,sample_context,warning_text,notes',
  ];

  for (const group of groups.filter((entry) => entry.reviewState !== 'ignored')) {
    const sample = group.evidenceRecords[0];

    rows.push(
      [
        group.displayName,
        group.normalizedKey,
        group.reviewState,
        group.targetDestination,
        'unknown',
        group.sourceTypes.join('; '),
        group.sourceLabels.join('; '),
        String(group.totalOccurrences),
        group.firstSeenAt,
        group.lastSeenAt,
        sample?.sampleContext ?? '',
        sample?.warningText ?? '',
        group.notes,
      ]
        .map(escapeCsvValue)
        .join(','),
    );
  }

  return rows.join('\n');
}

export function toUnknownItemIconCandidateCsv(groups: UnknownItemReviewGroup[]): string {
  const rows = [
    'item_name,canonical_key,generated_buddy_slug,candidate_buddy_url,derivation_status,source_labels,notes',
  ];

  for (const group of groups.filter((entry) => {
    return entry.reviewState === 'reviewed' && entry.targetDestination === 'buddy_icon_candidates';
  })) {
    const slug = toBuddySlug(group.displayName);

    rows.push(
      [
        group.displayName,
        group.normalizedKey,
        slug,
        slug ? `https://buddy.farm/i/${slug}/` : '',
        'candidate_name_slug_unverified',
        group.sourceLabels.join('; '),
        group.notes || 'Candidate only; verify Buddy page and observed icon HTML before promotion.',
      ]
        .map(escapeCsvValue)
        .join(','),
    );
  }

  return rows.join('\n');
}
