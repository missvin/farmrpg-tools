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

  /*__MINING_DEPTH_HISTORY_CORE__*/

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
