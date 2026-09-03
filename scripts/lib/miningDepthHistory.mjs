export const MINING_HISTORY_KIND = 'farmrpg-mining-depth-history';
export const MINING_HISTORY_SCHEMA_VERSION = 1;
export const MINING_HISTORY_STORAGE_KEY = 'farmrpg_mining_depth_history_v1';
export const MINING_RECENT_CAPTURE_STORAGE_KEY = 'farmrpg_mining_depth_recent_capture_v1';
export const MINING_HISTORY_LOCK_NAME = 'farmrpg-mining-depth-history-write-v1';
export const MINING_HISTORY_DEDUPE_WINDOW_MS = 10_000;

const FALLBACK_WRITE_ATTEMPTS = 4;

function cleanText(value) {
  return String(value ?? '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function readTitleText(titleElement) {
  const textParts = [];

  for (const node of titleElement?.childNodes ?? []) {
    if (node.nodeType === 1 && node.nodeName === 'BR') {
      break;
    }

    if (node.nodeType === 3) {
      textParts.push(node.textContent ?? '');
    }
  }

  return cleanText(textParts.join(' '));
}

function parseFloor(value) {
  const match = cleanText(value).match(/^Floor\s+(\d+|\d{1,3}(?:,\d{3})+)$/iu);
  if (!match) return null;

  const digits = match[1].replace(/,/gu, '');
  if (!/^\d+$/u.test(digits)) return null;

  const floor = Number.parseInt(digits, 10);
  return Number.isSafeInteger(floor) && floor > 0 ? floor : null;
}

function parseMineId(href) {
  try {
    const value = new URL(href, 'https://farmrpg.com/').searchParams.get('id');
    if (!/^\d+$/u.test(value ?? '')) return null;
    const mineId = Number.parseInt(value, 10);
    return Number.isSafeInteger(mineId) && mineId > 0 ? mineId : null;
  } catch {
    return null;
  }
}

export function parseMiningLocationRows(root) {
  const rows = Array.from(root?.querySelectorAll?.('a.item-link[href^="mining.php?id="]') ?? []);
  const mines = [];
  const errors = [];
  const seenIds = new Set();
  const seenNames = new Set();

  if (rows.length === 0) {
    errors.push('No mining location rows were found.');
  }

  rows.forEach((row, index) => {
    const rowNumber = index + 1;
    const mineId = parseMineId(row.getAttribute('href'));
    const name = readTitleText(row.querySelector('.item-title'));
    const floor = parseFloor(row.querySelector('.item-after')?.textContent);

    if (mineId === null) errors.push(`Mining row ${rowNumber} has an invalid mine ID.`);
    if (!name) errors.push(`Mining row ${rowNumber} has no readable mine name.`);
    if (floor === null) errors.push(`Mining row ${rowNumber} has no valid floor.`);

    if (mineId !== null && seenIds.has(mineId)) {
      errors.push(`Mining row ${rowNumber} repeats mine ID ${mineId}.`);
    }

    const nameKey = name.toLocaleLowerCase('en-US');
    if (name && seenNames.has(nameKey)) {
      errors.push(`Mining row ${rowNumber} repeats mine name ${name}.`);
    }

    if (mineId !== null) seenIds.add(mineId);
    if (name) seenNames.add(nameKey);

    if (mineId !== null && name && floor !== null) {
      mines.push({ mineId, name, floor });
    }
  });

  return {
    ok: errors.length === 0 && mines.length === rows.length,
    mines,
    errors,
  };
}

export function createEmptyMiningHistory() {
  return {
    kind: MINING_HISTORY_KIND,
    schemaVersion: MINING_HISTORY_SCHEMA_VERSION,
    snapshots: [],
  };
}

function isValidMine(mine) {
  return (
    mine &&
    Number.isSafeInteger(mine.mineId) &&
    mine.mineId > 0 &&
    typeof mine.name === 'string' &&
    mine.name.trim().length > 0 &&
    Number.isSafeInteger(mine.floor) &&
    mine.floor > 0
  );
}

function isValidSnapshot(snapshot) {
  if (
    !snapshot ||
    typeof snapshot.snapshotId !== 'string' ||
    snapshot.snapshotId.length === 0 ||
    typeof snapshot.observedAt !== 'string' ||
    Number.isNaN(Date.parse(snapshot.observedAt)) ||
    !Number.isInteger(snapshot.timezoneOffsetMinutes) ||
    snapshot.timezoneOffsetMinutes < -840 ||
    snapshot.timezoneOffsetMinutes > 840 ||
    !Array.isArray(snapshot.mines) ||
    snapshot.mines.length === 0 ||
    !snapshot.mines.every(isValidMine)
  ) {
    return false;
  }

  const mineIds = new Set(snapshot.mines.map((mine) => mine.mineId));
  const mineNames = new Set(snapshot.mines.map((mine) => mine.name.toLocaleLowerCase('en-US')));
  return mineIds.size === snapshot.mines.length && mineNames.size === snapshot.mines.length;
}

export function normalizeMiningHistory(value) {
  if (value === null || value === undefined) {
    return createEmptyMiningHistory();
  }

  if (
    !value ||
    value.kind !== MINING_HISTORY_KIND ||
    value.schemaVersion !== MINING_HISTORY_SCHEMA_VERSION ||
    !Array.isArray(value.snapshots)
  ) {
    throw new Error('Stored mining history has an unsupported or corrupted format. Export or inspect it before clearing.');
  }

  if (!value.snapshots.every(isValidSnapshot)) {
    throw new Error('Stored mining history contains an invalid snapshot. No data was changed.');
  }

  const snapshotIds = new Set(value.snapshots.map((snapshot) => snapshot.snapshotId));
  if (snapshotIds.size !== value.snapshots.length) {
    throw new Error('Stored mining history contains duplicate snapshot IDs. No data was changed.');
  }

  return {
    kind: MINING_HISTORY_KIND,
    schemaVersion: MINING_HISTORY_SCHEMA_VERSION,
    snapshots: value.snapshots.map((snapshot) => ({
      snapshotId: snapshot.snapshotId,
      observedAt: new Date(snapshot.observedAt).toISOString(),
      timezoneOffsetMinutes: snapshot.timezoneOffsetMinutes,
      mines: snapshot.mines.map((mine) => ({ ...mine, name: cleanText(mine.name) })),
    })),
  };
}

export function createMiningSnapshot({ mines, observedAt = new Date(), snapshotId }) {
  const date = observedAt instanceof Date ? observedAt : new Date(observedAt);
  const snapshot = {
    snapshotId: cleanText(snapshotId),
    observedAt: date.toISOString(),
    timezoneOffsetMinutes: -date.getTimezoneOffset(),
    mines: mines.map((mine) => ({
      mineId: mine.mineId,
      name: cleanText(mine.name),
      floor: mine.floor,
    })),
  };

  if (!isValidSnapshot(snapshot)) {
    throw new Error('Cannot create a mining snapshot from invalid observations.');
  }

  return snapshot;
}

export function getMiningSnapshotSignature(snapshot) {
  return snapshot.mines
    .map((mine) => `${mine.mineId}:${mine.name}:${mine.floor}`)
    .sort((left, right) => left.localeCompare(right, 'en-US'))
    .join('|');
}

export function mergeMiningSnapshot(historyValue, snapshot) {
  const history = normalizeMiningHistory(historyValue);
  if (!isValidSnapshot(snapshot)) {
    throw new Error('Cannot store an invalid mining snapshot.');
  }

  if (history.snapshots.some((candidate) => candidate.snapshotId === snapshot.snapshotId)) {
    return history;
  }

  return {
    ...history,
    snapshots: [...history.snapshots, snapshot].sort(
      (left, right) => left.observedAt.localeCompare(right.observedAt) || left.snapshotId.localeCompare(right.snapshotId),
    ),
  };
}

export function isRecentCrossTabDuplicate(recentCapture, snapshot, instanceId, dedupeWindowMs = MINING_HISTORY_DEDUPE_WINDOW_MS) {
  if (
    !recentCapture ||
    typeof recentCapture.instanceId !== 'string' ||
    typeof recentCapture.signature !== 'string' ||
    typeof recentCapture.observedAt !== 'string' ||
    recentCapture.instanceId === instanceId ||
    recentCapture.signature !== getMiningSnapshotSignature(snapshot)
  ) {
    return false;
  }

  const previousTime = Date.parse(recentCapture.observedAt);
  const currentTime = Date.parse(snapshot.observedAt);
  return Number.isFinite(previousTime) && Number.isFinite(currentTime) && Math.abs(currentTime - previousTime) <= dedupeWindowMs;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/u.test(text) ? `"${text.replace(/"/gu, '""')}"` : text;
}

function formatOffset(offsetMinutes) {
  const sign = offsetMinutes < 0 ? '-' : '+';
  const absoluteMinutes = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absoluteMinutes / 60)).padStart(2, '0');
  const minutes = String(absoluteMinutes % 60).padStart(2, '0');
  return `${sign}${hours}:${minutes}`;
}

export function formatObservedAtLocal(observedAt, offsetMinutes) {
  const adjusted = new Date(Date.parse(observedAt) + offsetMinutes * 60_000);
  return `${adjusted.toISOString().replace(/Z$/u, '')}${formatOffset(offsetMinutes)}`;
}

export function miningHistoryToCsv(historyValue) {
  const history = normalizeMiningHistory(historyValue);
  const rows = [
    [
      'snapshot_id',
      'observed_at_utc',
      'observed_at_local',
      'timezone_offset_minutes',
      'mine_id',
      'mine_name',
      'floor',
    ],
  ];

  for (const snapshot of history.snapshots) {
    for (const mine of snapshot.mines) {
      rows.push([
        snapshot.snapshotId,
        snapshot.observedAt,
        formatObservedAtLocal(snapshot.observedAt, snapshot.timezoneOffsetMinutes),
        snapshot.timezoneOffsetMinutes,
        mine.mineId,
        mine.name,
        mine.floor,
      ]);
    }
  }

  return `${rows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`;
}

async function loadHistory(getValue) {
  return normalizeMiningHistory(await getValue(MINING_HISTORY_STORAGE_KEY, null));
}

async function runWithWebLock(lockManager, mode, operation) {
  if (!lockManager || typeof lockManager.request !== 'function') {
    return { usedWebLock: false, value: await operation() };
  }

  const value = await lockManager.request(MINING_HISTORY_LOCK_NAME, { mode }, operation);
  return { usedWebLock: true, value };
}

async function persistMiningSnapshot({ getValue, setValue, snapshot, instanceId, dedupeWindowMs }) {
  const history = await loadHistory(getValue);
  const recentCapture = await getValue(MINING_RECENT_CAPTURE_STORAGE_KEY, null);

  if (isRecentCrossTabDuplicate(recentCapture, snapshot, instanceId, dedupeWindowMs)) {
    return { status: 'deduplicated', history };
  }

  const merged = mergeMiningSnapshot(history, snapshot);
  await setValue(MINING_HISTORY_STORAGE_KEY, merged);
  await setValue(MINING_RECENT_CAPTURE_STORAGE_KEY, {
    instanceId,
    observedAt: snapshot.observedAt,
    signature: getMiningSnapshotSignature(snapshot),
  });

  const verified = await loadHistory(getValue);
  if (!verified.snapshots.some((candidate) => candidate.snapshotId === snapshot.snapshotId)) {
    throw new Error('The mining snapshot was not present after saving.');
  }

  return { status: 'saved', history: verified };
}

export async function appendMiningSnapshotSafely({
  getValue,
  setValue,
  lockManager,
  snapshot,
  instanceId,
  dedupeWindowMs = MINING_HISTORY_DEDUPE_WINDOW_MS,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  random = Math.random,
}) {
  if (typeof instanceId !== 'string' || instanceId.length === 0) {
    throw new Error('A stable tab instance ID is required to save mining history safely.');
  }

  const operation = () => persistMiningSnapshot({ getValue, setValue, snapshot, instanceId, dedupeWindowMs });
  if (lockManager && typeof lockManager.request === 'function') {
    const lockedResult = await runWithWebLock(lockManager, 'exclusive', operation);
    return { ...lockedResult.value, usedWebLock: true };
  }

  let lastError;
  for (let attempt = 1; attempt <= FALLBACK_WRITE_ATTEMPTS; attempt += 1) {
    try {
      const result = await operation();
      if (result.status === 'deduplicated') {
        return { ...result, usedWebLock: false, attempts: attempt };
      }

      await sleep(20 + Math.floor(random() * 40));
      const firstVerification = await loadHistory(getValue);
      await sleep(20 + Math.floor(random() * 40));
      const secondVerification = await loadHistory(getValue);

      if (
        firstVerification.snapshots.some((candidate) => candidate.snapshotId === snapshot.snapshotId) &&
        secondVerification.snapshots.some((candidate) => candidate.snapshotId === snapshot.snapshotId)
      ) {
        return { status: 'saved', history: secondVerification, usedWebLock: false, attempts: attempt };
      }

      lastError = new Error('Another tab replaced the mining history during fallback verification.');
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`Unable to confirm a safe mining history write after ${FALLBACK_WRITE_ATTEMPTS} attempts. ${lastError?.message ?? ''}`.trim());
}

export async function readMiningHistorySafely({ getValue, lockManager }) {
  const result = await runWithWebLock(lockManager, 'shared', () => loadHistory(getValue));
  return { history: result.value, usedWebLock: result.usedWebLock };
}

export async function clearMiningHistorySafely({
  getValue,
  setValue,
  lockManager,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  random = Math.random,
}) {
  const operation = async () => {
    await setValue(MINING_HISTORY_STORAGE_KEY, createEmptyMiningHistory());
    await setValue(MINING_RECENT_CAPTURE_STORAGE_KEY, null);
    const verified = await loadHistory(getValue);

    if (verified.snapshots.length !== 0) {
      throw new Error('Mining history could not be confirmed empty after clearing.');
    }

    return verified;
  };

  if (lockManager && typeof lockManager.request === 'function') {
    const result = await runWithWebLock(lockManager, 'exclusive', operation);
    return { history: result.value, usedWebLock: true };
  }

  let lastError;
  for (let attempt = 1; attempt <= FALLBACK_WRITE_ATTEMPTS; attempt += 1) {
    try {
      await operation();
      await sleep(20 + Math.floor(random() * 40));
      const firstVerification = await loadHistory(getValue);
      await sleep(20 + Math.floor(random() * 40));
      const secondVerification = await loadHistory(getValue);
      if (firstVerification.snapshots.length === 0 && secondVerification.snapshots.length === 0) {
        return { history: secondVerification, usedWebLock: false, attempts: attempt };
      }

      lastError = new Error('Another tab changed the mining history during fallback clear verification.');
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`Unable to confirm a safe mining history clear after ${FALLBACK_WRITE_ATTEMPTS} attempts. ${lastError?.message ?? ''}`.trim());
}
