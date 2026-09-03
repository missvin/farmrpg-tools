// ==UserScript==
// @name         Farm RPG Mining Depth History
// @namespace    https://github.com/liquidthex/farmrpg-tools
// @version      1.0.0
// @description  Saves timestamped Mining Locations floor history locally and exports CSV or JSON.
// @author       Rebecca Young
// @match        https://farmrpg.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

// Companion to (and safe to run alongside) Farm RPG Mining Progress Display by ClientCoin.
// Navigation/storage approach inspired by its MIT-licensed source:
// https://greasyfork.org/en/scripts/546285-farm-rpg-mining-progress-display/code

(function farmRpgMiningDepthHistory() {
  'use strict';

  // Generated from scripts/lib/miningDepthHistory.mjs. Do not edit this embedded section directly.
const MINING_HISTORY_KIND = 'farmrpg-mining-depth-history';
const MINING_HISTORY_SCHEMA_VERSION = 1;
const MINING_HISTORY_STORAGE_KEY = 'farmrpg_mining_depth_history_v1';
const MINING_RECENT_CAPTURE_STORAGE_KEY = 'farmrpg_mining_depth_recent_capture_v1';
const MINING_HISTORY_LOCK_NAME = 'farmrpg-mining-depth-history-write-v1';
const MINING_HISTORY_DEDUPE_WINDOW_MS = 10_000;

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

function parseMiningLocationRows(root) {
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

function createEmptyMiningHistory() {
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

function normalizeMiningHistory(value) {
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

function createMiningSnapshot({ mines, observedAt = new Date(), snapshotId }) {
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

function getMiningSnapshotSignature(snapshot) {
  return snapshot.mines
    .map((mine) => `${mine.mineId}:${mine.name}:${mine.floor}`)
    .sort((left, right) => left.localeCompare(right, 'en-US'))
    .join('|');
}

function mergeMiningSnapshot(historyValue, snapshot) {
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

function isRecentCrossTabDuplicate(recentCapture, snapshot, instanceId, dedupeWindowMs = MINING_HISTORY_DEDUPE_WINDOW_MS) {
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

function formatObservedAtLocal(observedAt, offsetMinutes) {
  const adjusted = new Date(Date.parse(observedAt) + offsetMinutes * 60_000);
  return `${adjusted.toISOString().replace(/Z$/u, '')}${formatOffset(offsetMinutes)}`;
}

function miningHistoryToCsv(historyValue) {
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

async function appendMiningSnapshotSafely({
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

async function readMiningHistorySafely({ getValue, lockManager }) {
  const result = await runWithWebLock(lockManager, 'shared', () => loadHistory(getValue));
  return { history: result.value, usedWebLock: result.usedWebLock };
}

async function clearMiningHistorySafely({
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

  const PANEL_ID = 'farmrpg-mining-depth-history-panel';
  const STATUS_ID = 'farmrpg-mining-depth-history-status';
  const STYLE_ID = 'farmrpg-mining-depth-history-styles';
  const ROUTE_DEBOUNCE_MS = 80;
  const STABLE_ROW_INTERVAL_MS = 150;
  const STABLE_ROW_ATTEMPTS = 20;
  const INSTANCE_ID = getOrCreateInstanceId();

  let routeTimer = null;
  let visitActive = false;
  let captureFinishedForVisit = false;
  let captureInFlight = false;

  const getValue = (key, fallback) => Promise.resolve(GM_getValue(key, fallback));
  const setValue = (key, value) => Promise.resolve(GM_setValue(key, value));
  const lockManager = typeof navigator.locks?.request === 'function' ? navigator.locks : undefined;

  function createUniqueId() {
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  }

  function getOrCreateInstanceId() {
    const storageKey = 'farmrpg_mining_depth_history_tab_instance_v1';

    try {
      const navigationType = performance.getEntriesByType('navigation')[0]?.type;
      const storedId = sessionStorage.getItem(storageKey);
      if (navigationType === 'reload' && storedId) return storedId;

      const instanceId = createUniqueId();
      sessionStorage.setItem(storageKey, instanceId);
      return instanceId;
    } catch {
      return createUniqueId();
    }
  }

  function isMiningOverview() {
    return location.hash === '#!/mine.php' && document.querySelector('#fireworks[data-page="mine"]') !== null;
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID} {
        box-sizing: border-box;
        margin: 0 15px 12px;
        padding: 10px 12px;
        border: 1px solid rgba(128, 128, 128, 0.35);
        border-radius: 6px;
        background: rgba(128, 128, 128, 0.08);
        color: inherit;
        font-size: 13px;
        line-height: 1.4;
      }
      #${PANEL_ID} .mining-depth-history-title {
        display: block;
        margin-bottom: 3px;
        font-weight: 700;
      }
      #${STATUS_ID}[data-tone="error"] { color: #d32f2f; }
      #${STATUS_ID}[data-tone="warning"] { color: #b26a00; }
      #${STATUS_ID}[data-tone="success"] { color: #2e7d32; }
      #${PANEL_ID} .mining-depth-history-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 8px;
      }
      #${PANEL_ID} button {
        min-height: 32px;
        padding: 5px 10px;
        border: 1px solid rgba(128, 128, 128, 0.45);
        border-radius: 4px;
        background: rgba(128, 128, 128, 0.14);
        color: inherit;
        cursor: pointer;
        font: inherit;
      }
      #${PANEL_ID} button:hover { background: rgba(128, 128, 128, 0.24); }
      #${PANEL_ID} button:focus-visible { outline: 2px solid #ffcc00; outline-offset: 2px; }
    `;
    document.head.append(style);
  }

  function findPanelHost() {
    const firstRow = document.querySelector('a.item-link[href^="mining.php?id="]');
    return firstRow?.closest('.card-content') ?? null;
  }

  function ensurePanel() {
    const existing = document.getElementById(PANEL_ID);
    if (existing) return existing;

    const host = findPanelHost();
    if (!host) return null;

    installStyles();
    const panel = document.createElement('section');
    panel.id = PANEL_ID;
    panel.setAttribute('aria-label', 'Mining depth history');
    panel.innerHTML = `
      <span class="mining-depth-history-title">Mining Depth History</span>
      <div id="${STATUS_ID}" role="status" aria-live="polite">Reading Mining Locations…</div>
      <div class="mining-depth-history-actions">
        <button type="button" data-action="export-csv">Export CSV</button>
        <button type="button" data-action="export-json">Export JSON backup</button>
        <button type="button" data-action="clear-history">Clear history</button>
      </div>
    `;

    const list = host.querySelector('.list-block');
    host.insertBefore(panel, list ?? host.firstChild);
    panel.querySelector('[data-action="export-csv"]').addEventListener('click', () => exportHistory('csv'));
    panel.querySelector('[data-action="export-json"]').addEventListener('click', () => exportHistory('json'));
    panel.querySelector('[data-action="clear-history"]').addEventListener('click', clearHistory);
    return panel;
  }

  function setStatus(message, tone = 'neutral') {
    ensurePanel();
    const status = document.getElementById(STATUS_ID);
    if (!status) return;
    status.textContent = message;
    status.dataset.tone = tone;
  }

  function describeHistory(history, prefix = '') {
    const latest = history.snapshots.at(-1);
    if (!latest) return `${prefix}No saved visits yet.`.trim();

    const visitWord = history.snapshots.length === 1 ? 'visit' : 'visits';
    return `${prefix}${history.snapshots.length} saved ${visitWord}. Latest: ${new Date(latest.observedAt).toLocaleString()} (${latest.mines.length} mines).`.trim();
  }

  async function readStableRows() {
    let previousSignature = null;
    let latestErrors = ['Mining Locations did not finish loading.'];

    for (let attempt = 0; attempt < STABLE_ROW_ATTEMPTS; attempt += 1) {
      if (!isMiningOverview()) return null;

      const parsed = parseMiningLocationRows(document);
      latestErrors = parsed.errors;
      if (parsed.ok) {
        const signature = JSON.stringify(parsed.mines);
        if (signature === previousSignature) return parsed.mines;
        previousSignature = signature;
      } else {
        previousSignature = null;
      }

      await new Promise((resolve) => setTimeout(resolve, STABLE_ROW_INTERVAL_MS));
    }

    throw new Error(latestErrors.join(' ') || 'Mining location rows did not become stable.');
  }

  async function captureVisit() {
    if (captureInFlight || captureFinishedForVisit || !isMiningOverview()) return;
    captureInFlight = true;
    ensurePanel();
    setStatus('Reading Mining Locations…');

    try {
      const mines = await readStableRows();
      if (!mines || !isMiningOverview()) return;

      const snapshot = createMiningSnapshot({
        mines,
        observedAt: new Date(),
        snapshotId: createUniqueId(),
      });
      const result = await appendMiningSnapshotSafely({
        getValue,
        setValue,
        lockManager,
        snapshot,
        instanceId: INSTANCE_ID,
      });

      captureFinishedForVisit = true;
      if (result.status === 'deduplicated') {
        setStatus(describeHistory(result.history, 'Matched a capture from another tab. '), 'success');
      } else if (!result.usedWebLock) {
        setStatus(describeHistory(result.history, 'Saved with fallback verification; keep JSON backups current. '), 'warning');
      } else {
        setStatus(describeHistory(result.history, 'Saved. '), 'success');
      }
    } catch (error) {
      captureFinishedForVisit = true;
      setStatus(`Not saved: ${error instanceof Error ? error.message : String(error)}`, 'error');
      console.error('Mining Depth History:', error);
    } finally {
      captureInFlight = false;
    }
  }

  function localDateStamp(date = new Date()) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  }

  function downloadText(filename, text, mimeType) {
    const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function exportHistory(format) {
    try {
      const { history, usedWebLock } = await readMiningHistorySafely({ getValue, lockManager });
      const date = localDateStamp();
      if (format === 'csv') {
        downloadText(`farmrpg-mining-depth-history-${date}.csv`, miningHistoryToCsv(history), 'text/csv;charset=utf-8');
      } else {
        downloadText(
          `farmrpg-mining-depth-history-${date}.json`,
          `${JSON.stringify(history, null, 2)}\n`,
          'application/json;charset=utf-8',
        );
      }

      setStatus(describeHistory(history, `Exported ${format.toUpperCase()}. ${usedWebLock ? '' : 'Web Locks were unavailable. '}`), usedWebLock ? 'success' : 'warning');
    } catch (error) {
      setStatus(`Export failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  }

  async function clearHistory() {
    const confirmed = window.confirm('Delete all saved Mining Depth History? Export a JSON backup first if you may need it later.');
    if (!confirmed) return;

    try {
      const { history, usedWebLock } = await clearMiningHistorySafely({ getValue, setValue, lockManager });
      setStatus(describeHistory(history, 'History cleared. '), usedWebLock ? 'success' : 'warning');
    } catch (error) {
      setStatus(`Clear failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  }

  async function refreshStatusFromStorage() {
    if (!isMiningOverview()) return;

    try {
      const { history } = await readMiningHistorySafely({ getValue, lockManager });
      setStatus(describeHistory(history, 'Updated in another tab. '), 'success');
    } catch (error) {
      setStatus(`History update warning: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  }

  function checkRoute() {
    routeTimer = null;
    const onMiningOverview = isMiningOverview();

    if (!onMiningOverview) {
      visitActive = false;
      captureFinishedForVisit = false;
      document.getElementById(PANEL_ID)?.remove();
      return;
    }

    if (!visitActive) {
      visitActive = true;
      captureFinishedForVisit = false;
    }

    ensurePanel();
    void captureVisit();
  }

  function queueRouteCheck() {
    if (routeTimer !== null) clearTimeout(routeTimer);
    routeTimer = setTimeout(checkRoute, ROUTE_DEBOUNCE_MS);
  }

  const routeObserver = new MutationObserver(queueRouteCheck);
  routeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-page'],
    childList: true,
    subtree: true,
  });
  window.addEventListener('hashchange', queueRouteCheck);

  if (typeof GM_addValueChangeListener === 'function') {
    GM_addValueChangeListener(MINING_HISTORY_STORAGE_KEY, (_key, _oldValue, _newValue, remote) => {
      if (remote) void refreshStatusFromStorage();
    });
  }

  queueRouteCheck();
})();
