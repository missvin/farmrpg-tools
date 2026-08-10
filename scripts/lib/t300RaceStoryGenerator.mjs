export const T300_MM_TARGET = 1_000_000;
export const T300_STORY_SCHEMA_VERSION = 1;

const HOUR_MS = 60 * 60 * 1000;
const FINALIST_KEYS = ['red trunk', 'water lily', 'wizard hat'];
const FORBIDDEN_PUBLIC_KEYS = new Set([
  'profileId',
  'rawText',
  'parsedRows',
  'parseSummary',
  'preferences',
  'inventory',
  'petInventory',
  'locksmith',
  'restoreStrategy',
]);

export function toCanonicalItemKey(input) {
  return String(input ?? '')
    .replace(/[\u2018\u2019\u201a\u201b\u2032]/gu, "'")
    .replace(/[\u201c\u201d\u201e\u201f\u2033]/gu, '"')
    .toLowerCase()
    .trim()
    .replace(/\s+/gu, ' ');
}

export function parseCsvRow(line) {
  const values = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"') {
      if (quoted && nextCharacter === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      values.push(value);
      value = '';
    } else {
      value += character;
    }
  }

  values.push(value);
  return values;
}

export function parseTowerRequirementsCsv(csvText) {
  const lines = csvText.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvRow(lines[0]).map((header) => header.trim().toLowerCase());
  const indexByHeader = Object.fromEntries(headers.map((header, index) => [header, index]));
  const requiredHeaders = ['tower_level', 'slot_index', 'item_name', 'mastery_level_needed'];

  for (const header of requiredHeaders) {
    if (indexByHeader[header] === undefined) {
      throw new Error(`Tower requirements CSV is missing ${header}.`);
    }
  }

  const requirements = lines.slice(1).flatMap((line) => {
    const values = parseCsvRow(line);
    const towerLevel = Number(values[indexByHeader.tower_level]);
    const masteryLevelNeeded = values[indexByHeader.mastery_level_needed]?.trim().toUpperCase();

    if (!Number.isInteger(towerLevel) || towerLevel < 201 || towerLevel > 300 || masteryLevelNeeded !== 'MM') {
      return [];
    }

    const itemName = values[indexByHeader.item_name]?.trim() ?? '';
    const slotIndex = Number(values[indexByHeader.slot_index]);
    if (!itemName || !Number.isInteger(slotIndex)) {
      throw new Error(`Invalid T300 Tower requirement row: ${line}`);
    }

    return [{
      towerLevel,
      slotIndex,
      itemName,
      canonicalKey: toCanonicalItemKey(itemName),
    }];
  });

  return requirements.sort((left, right) =>
    left.towerLevel - right.towerLevel || left.slotIndex - right.slotIndex || left.itemName.localeCompare(right.itemName));
}

function getSnapshotTimestamp(snapshot) {
  return snapshot.savedAt ?? snapshot.createdAt;
}

function normalizeMasteryLookup(masteryByItem) {
  return Object.fromEntries(
    Object.entries(masteryByItem ?? {}).map(([itemName, mastery]) => [
      toCanonicalItemKey(itemName),
      Number.isFinite(Number(mastery)) ? Math.max(0, Math.floor(Number(mastery))) : 0,
    ]),
  );
}

export function normalizeBackupSnapshots(backup) {
  if (!backup || backup.kind !== 'farmrpg-tools-backup' || !Array.isArray(backup.state?.snapshots)) {
    throw new Error('Expected a FarmRPG Tools backup with state.snapshots.');
  }

  return backup.state.snapshots
    .map((snapshot) => {
      const observedAt = getSnapshotTimestamp(snapshot);
      if (!observedAt || Number.isNaN(Date.parse(observedAt))) {
        throw new Error('Backup contains a snapshot without a valid saved timestamp.');
      }

      return {
        observedAt,
        observedAtMs: Date.parse(observedAt),
        masteryByItem: normalizeMasteryLookup(snapshot.masteryByItem),
      };
    })
    .sort((left, right) => left.observedAtMs - right.observedAtMs);
}

function getCompletedKey(requirements, snapshot) {
  return requirements
    .filter((requirement) => (snapshot.masteryByItem[requirement.canonicalKey] ?? 0) >= T300_MM_TARGET)
    .map((requirement) => requirement.canonicalKey)
    .sort()
    .join('|');
}

function collapseEquivalentCampaignSnapshots(requirements, snapshots) {
  const collapsed = [];

  for (const snapshot of snapshots) {
    const statusKey = getCompletedKey(requirements, snapshot);
    const previous = collapsed[collapsed.length - 1];

    if (previous && previous.statusKey === statusKey && snapshot.observedAtMs - previous.observedAtMs <= HOUR_MS) {
      collapsed[collapsed.length - 1] = { ...snapshot, statusKey };
    } else {
      collapsed.push({ ...snapshot, statusKey });
    }
  }

  return collapsed;
}

function validateSupplement(supplement) {
  if (!supplement || supplement.schemaVersion !== 1 || typeof supplement.profileLabel !== 'string') {
    throw new Error('Expected a schemaVersion 1 T300 race supplement.');
  }

  if (!Array.isArray(supplement.finalistCheckpoints)) {
    throw new Error('T300 race supplement must include finalistCheckpoints.');
  }
}

function buildFinalistSeries(snapshots, supplement) {
  const points = snapshots.map((snapshot) => ({
    observedAt: snapshot.observedAt,
    source: 'backup',
    approximate: false,
    values: Object.fromEntries(FINALIST_KEYS.map((key) => [key, snapshot.masteryByItem[key] ?? 0])),
  }));

  for (const checkpoint of supplement.finalistCheckpoints) {
    const observedAtMs = Date.parse(checkpoint.observedAt);
    if (Number.isNaN(observedAtMs)) {
      throw new Error(`Invalid supplement checkpoint timestamp: ${checkpoint.observedAt}`);
    }

    const values = Object.fromEntries(FINALIST_KEYS.map((key) => {
      const value = Number(checkpoint.values?.[key]);
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`Supplement checkpoint ${checkpoint.observedAt} is missing ${key}.`);
      }
      return [key, Math.floor(value)];
    }));
    const overlap = points.find((point) =>
      Math.abs(Date.parse(point.observedAt) - observedAtMs) <= HOUR_MS
      && FINALIST_KEYS.every((key) => point.values[key] === values[key]));

    if (overlap) {
      overlap.source = 'backup+chat';
      continue;
    }

    points.push({
      observedAt: checkpoint.observedAt,
      source: 'chat',
      approximate: Boolean(checkpoint.approximate),
      values,
    });
  }

  return points.sort((left, right) => Date.parse(left.observedAt) - Date.parse(right.observedAt));
}

function findNonMonotonicWarnings(requirements, snapshots) {
  const warnings = [];

  for (const requirement of requirements) {
    let previous = null;
    for (const snapshot of snapshots) {
      const current = snapshot.masteryByItem[requirement.canonicalKey] ?? 0;
      if (previous !== null && current < previous) {
        warnings.push(`${requirement.itemName} decreased between saved snapshots.`);
        break;
      }
      previous = current;
    }
  }

  return warnings;
}

function auditPublicKeys(value, path = 'story') {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => auditPublicKeys(entry, `${path}[${index}]`));
    return;
  }

  if (!value || typeof value !== 'object') {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_PUBLIC_KEYS.has(key)) {
      throw new Error(`Public story privacy audit rejected ${path}.${key}.`);
    }
    auditPublicKeys(child, `${path}.${key}`);
  }
}

export function buildT300RaceStoryData({ backup, towerRequirementsCsv, supplement }) {
  validateSupplement(supplement);
  const requirements = parseTowerRequirementsCsv(towerRequirementsCsv);
  const snapshots = normalizeBackupSnapshots(backup);

  if (requirements.length === 0 || snapshots.length === 0) {
    throw new Error('T300 story generation requires Tower requirements and at least one snapshot.');
  }

  const firstSnapshot = snapshots[0];
  const latestSnapshot = snapshots[snapshots.length - 1];
  const missingRequirementKeys = requirements
    .filter((requirement) => snapshots.some((snapshot) => snapshot.masteryByItem[requirement.canonicalKey] === undefined))
    .map((requirement) => requirement.canonicalKey);
  const campaignSnapshots = collapseEquivalentCampaignSnapshots(requirements, snapshots).map((snapshot) => ({
    observedAt: snapshot.observedAt,
    mmCount: requirements.filter((requirement) =>
      (snapshot.masteryByItem[requirement.canonicalKey] ?? 0) >= T300_MM_TARGET).length,
  }));
  const publicRequirements = requirements.map((requirement) => {
    const masteryAtStart = firstSnapshot.masteryByItem[requirement.canonicalKey] ?? 0;
    const masteryAtLatest = latestSnapshot.masteryByItem[requirement.canonicalKey] ?? 0;
    const firstCompletedIndex = snapshots.findIndex((snapshot) =>
      (snapshot.masteryByItem[requirement.canonicalKey] ?? 0) >= T300_MM_TARGET);
    const completedBeforeTracking = masteryAtStart >= T300_MM_TARGET;

    return {
      ...requirement,
      masteryAtStart,
      masteryAtLatest,
      completedBeforeTracking,
      firstObservedMmAt: completedBeforeTracking || firstCompletedIndex < 0
        ? null
        : snapshots[firstCompletedIndex].observedAt,
      previousObservedAt: completedBeforeTracking || firstCompletedIndex <= 0
        ? null
        : snapshots[firstCompletedIndex - 1].observedAt,
    };
  });
  const startMmCount = publicRequirements.filter((requirement) => requirement.completedBeforeTracking).length;
  const latestMmCount = publicRequirements.filter((requirement) => requirement.masteryAtLatest >= T300_MM_TARGET).length;
  const story = {
    schemaVersion: T300_STORY_SCHEMA_VERSION,
    title: 'The Race to T300: 169 mastery requirements over 169 days',
    profileLabel: supplement.profileLabel,
    trackingStartedAt: supplement.trackingStartedAt ?? firstSnapshot.observedAt,
    deadlineAt: supplement.deadlineAt,
    generatedAt: backup.exportedAt ?? latestSnapshot.observedAt,
    summary: {
      requirementCount: publicRequirements.length,
      startMmCount,
      startingGapCount: publicRequirements.length - startMmCount,
      latestMmCount,
      observedCompletionCount: latestMmCount - startMmCount,
      remainingCount: publicRequirements.length - latestMmCount,
      rawBackupSnapshotCount: snapshots.length,
      campaignSnapshotCount: campaignSnapshots.length,
      matchedRequirementCount: publicRequirements.length - new Set(missingRequirementKeys).size,
    },
    requirements: publicRequirements,
    campaignSnapshots,
    finalists: FINALIST_KEYS.map((canonicalKey) => {
      const requirement = publicRequirements.find((entry) => entry.canonicalKey === canonicalKey);
      if (!requirement) {
        throw new Error(`Missing finalist Tower requirement: ${canonicalKey}`);
      }
      return {
        canonicalKey,
        itemName: requirement.itemName,
        towerLevel: requirement.towerLevel,
      };
    }),
    finalistSeries: buildFinalistSeries(snapshots, supplement),
    warnings: [
      ...new Set(missingRequirementKeys).size > 0
        ? [`${new Set(missingRequirementKeys).size} Tower requirements are missing from at least one snapshot.`]
        : [],
      ...findNonMonotonicWarnings(requirements, snapshots),
    ],
  };

  auditPublicKeys(story);
  return story;
}

export function assertT300StoryPrivacy(story) {
  auditPublicKeys(story);
  return true;
}
