import { describe, expect, it, vi } from 'vitest';

import {
  MINING_HISTORY_STORAGE_KEY,
  appendMiningSnapshotSafely,
  clearMiningHistorySafely,
  createEmptyMiningHistory,
  createMiningSnapshot,
  formatObservedAtLocal,
  getMiningSnapshotSignature,
  miningHistoryToCsv,
  parseMiningLocationRows,
  readMiningHistorySafely,
} from './miningDepthHistory.mjs';

const miningRows = [
  [1, 'Spring Cave', 'Found near the Small Spring', '1,622'],
  [2, 'Highland Hollow', 'Cave system along Highland Hills', '3,148'],
  [3, 'Sol Grotto', 'Surrounded by a strange light', '2,707'],
  [4, 'Ember Caverns', 'Is it hot in here?', '2,011'],
  [5, "Fenrir's Den", 'All eyes on you', '1,722'],
  [6, 'Mossrock Mine', 'A quiet mine where moss thrives', '703'],
];

function renderMiningRows(rows = miningRows, surroundingMarkup = '') {
  document.body.innerHTML = `
    ${surroundingMarkup}
    <div id="fireworks" data-page="mine">
      <div class="page page-on-center" data-page="mine">
        <div class="card">
          <div class="card-header">MINING LOCATIONS</div>
          <div class="card-content">
            <div class="list-block"><ul>
              ${rows
                .map(
                  ([id, name, description, floor]) => `
                    <li>
                      <a href="mining.php?id=${id}" data-view=".view-main" class="item-link close-panel">
                        <div class="item-content">
                          <div class="item-inner">
                            <div class="item-title">${name}<br><span>${description}</span></div>
                            <div class="item-after">Floor ${floor}</div>
                          </div>
                        </div>
                      </a>
                    </li>`,
                )
                .join('')}
            </ul></div>
          </div>
        </div>
      </div>
    </div>`;
}

function makeSnapshot({
  id = 'snapshot-a',
  observedAt = '2026-09-03T20:28:00.000Z',
  floors = [1622, 3148, 2707, 2011, 1722, 703],
} = {}) {
  return createMiningSnapshot({
    snapshotId: id,
    observedAt: new Date(observedAt),
    mines: miningRows.map(([mineId, name], index) => ({ mineId, name, floor: floors[index] })),
  });
}

function createMemoryStorage(initial = new Map()) {
  const values = initial;
  return {
    values,
    getValue: vi.fn(async (key, fallback) => (values.has(key) ? structuredClone(values.get(key)) : fallback)),
    setValue: vi.fn(async (key, value) => values.set(key, structuredClone(value))),
  };
}

function createQueuedLockManager() {
  let tail = Promise.resolve();
  const requests = [];

  return {
    requests,
    request(name, options, operation) {
      requests.push({ name, mode: options.mode });
      const result = tail.then(() => operation({ name, mode: options.mode }));
      tail = result.catch(() => undefined);
      return result;
    },
  };
}

describe('mining location parsing', () => {
  it('parses the verified six-row layout including comma floors and apostrophes', () => {
    renderMiningRows();

    expect(parseMiningLocationRows(document)).toEqual({
      ok: true,
      errors: [],
      mines: [
        { mineId: 1, name: 'Spring Cave', floor: 1622 },
        { mineId: 2, name: 'Highland Hollow', floor: 3148 },
        { mineId: 3, name: 'Sol Grotto', floor: 2707 },
        { mineId: 4, name: 'Ember Caverns', floor: 2011 },
        { mineId: 5, name: "Fenrir's Den", floor: 1722 },
        { mineId: 6, name: 'Mossrock Mine', floor: 703 },
      ],
    });
  });

  it('ignores responsive navigation and chat markup outside mining rows', () => {
    renderMiningRows(miningRows, `
      <aside class="desktop-sidebar"><a href="mine.php">Go Mining</a></aside>
      <section class="mobile-nav"><a href="mining.php">Not a location row</a></section>
      <section class="chat">Floor 999</section>
    `);

    const result = parseMiningLocationRows(document);
    expect(result.ok).toBe(true);
    expect(result.mines).toHaveLength(6);
  });

  it('rejects incomplete, invalid, and duplicate rows instead of saving partial data', () => {
    renderMiningRows([
      [1, 'Spring Cave', 'Valid', '1,622'],
      [1, '', 'Missing title', 'not-a-number'],
    ]);

    const result = parseMiningLocationRows(document);
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'Mining row 2 has no readable mine name.',
        'Mining row 2 has no valid floor.',
        'Mining row 2 repeats mine ID 1.',
      ]),
    );
  });

  it('rejects partially numeric IDs and malformed comma grouping', () => {
    renderMiningRows([
      ['1x', 'Spring Cave', 'Invalid ID', '1,622'],
      [2, 'Highland Hollow', 'Invalid floor', '31,48'],
    ]);

    expect(parseMiningLocationRows(document)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        'Mining row 1 has an invalid mine ID.',
        'Mining row 2 has no valid floor.',
      ]),
    });
  });
});

describe('mining history serialization', () => {
  it('creates one timestamped snapshot and stable mine signature', () => {
    const snapshot = makeSnapshot();

    expect(snapshot).toMatchObject({
      snapshotId: 'snapshot-a',
      observedAt: '2026-09-03T20:28:00.000Z',
    });
    expect(snapshot.mines).toHaveLength(6);
    expect(getMiningSnapshotSignature(snapshot)).toContain("5:Fenrir's Den:1722");
  });

  it('exports long-form CSV with escaped names and the captured UTC offset', () => {
    const snapshot = makeSnapshot();
    snapshot.timezoneOffsetMinutes = -420;
    snapshot.mines[0].name = 'Spring Cave, Lower "Shelf"';

    const csv = miningHistoryToCsv({
      ...createEmptyMiningHistory(),
      snapshots: [snapshot],
    });

    expect(csv.split('\n')[0]).toBe(
      'snapshot_id,observed_at_utc,observed_at_local,timezone_offset_minutes,mine_id,mine_name,floor',
    );
    expect(csv).toContain('2026-09-03T13:28:00.000-07:00,-420,1,"Spring Cave, Lower ""Shelf""",1622');
    expect(formatObservedAtLocal(snapshot.observedAt, -420)).toBe('2026-09-03T13:28:00.000-07:00');
  });

  it('refuses to normalize corrupted storage', () => {
    expect(() => miningHistoryToCsv({ kind: 'wrong', schemaVersion: 1, snapshots: [] })).toThrow(/corrupted format/u);
  });
});

describe('multi-tab mining history coordination', () => {
  it('serializes concurrent distinct writes without losing either snapshot', async () => {
    const storage = createMemoryStorage();
    const lockManager = createQueuedLockManager();
    const first = makeSnapshot({ id: 'first' });
    const second = makeSnapshot({ id: 'second', observedAt: '2026-09-03T20:28:05.000Z', floors: [1623, 3148, 2707, 2011, 1722, 703] });

    const [firstResult, secondResult] = await Promise.all([
      appendMiningSnapshotSafely({ ...storage, lockManager, snapshot: first, instanceId: 'tab-a' }),
      appendMiningSnapshotSafely({ ...storage, lockManager, snapshot: second, instanceId: 'tab-b' }),
    ]);

    expect(firstResult.status).toBe('saved');
    expect(secondResult.status).toBe('saved');
    expect((await readMiningHistorySafely({ getValue: storage.getValue, lockManager })).history.snapshots).toHaveLength(2);
    expect(lockManager.requests.map((request) => request.mode)).toEqual(['exclusive', 'exclusive', 'shared']);
  });

  it('deduplicates matching captures from different tabs within ten seconds', async () => {
    const storage = createMemoryStorage();
    const lockManager = createQueuedLockManager();
    const first = makeSnapshot({ id: 'first' });
    const second = makeSnapshot({ id: 'second', observedAt: '2026-09-03T20:28:09.999Z' });

    await appendMiningSnapshotSafely({ ...storage, lockManager, snapshot: first, instanceId: 'tab-a' });
    const result = await appendMiningSnapshotSafely({ ...storage, lockManager, snapshot: second, instanceId: 'tab-b' });

    expect(result.status).toBe('deduplicated');
    expect(result.history.snapshots).toHaveLength(1);
  });

  it('keeps rapid repeat visits from the same tab and later unchanged cross-tab visits', async () => {
    const storage = createMemoryStorage();
    const lockManager = createQueuedLockManager();

    await appendMiningSnapshotSafely({ ...storage, lockManager, snapshot: makeSnapshot({ id: 'first' }), instanceId: 'tab-a' });
    await appendMiningSnapshotSafely({
      ...storage,
      lockManager,
      snapshot: makeSnapshot({ id: 'same-tab', observedAt: '2026-09-03T20:28:05.000Z' }),
      instanceId: 'tab-a',
    });
    await appendMiningSnapshotSafely({
      ...storage,
      lockManager,
      snapshot: makeSnapshot({ id: 'later-tab', observedAt: '2026-09-03T20:28:16.000Z' }),
      instanceId: 'tab-b',
    });

    expect((await readMiningHistorySafely({ getValue: storage.getValue, lockManager })).history.snapshots).toHaveLength(3);
  });

  it('recovers through fallback verification when the first unlocked write is replaced', async () => {
    const storage = createMemoryStorage();
    let replaceFirstHistoryWrite = true;
    const setValue = vi.fn(async (key, value) => {
      storage.values.set(key, structuredClone(value));
      if (key === MINING_HISTORY_STORAGE_KEY && replaceFirstHistoryWrite) {
        replaceFirstHistoryWrite = false;
        storage.values.set(key, createEmptyMiningHistory());
      }
    });

    const result = await appendMiningSnapshotSafely({
      getValue: storage.getValue,
      setValue,
      lockManager: undefined,
      snapshot: makeSnapshot(),
      instanceId: 'tab-a',
      sleep: async () => undefined,
      random: () => 0,
    });

    expect(result).toMatchObject({ status: 'saved', usedWebLock: false, attempts: 2 });
  });

  it('orders clear and append operations through the same exclusive lock', async () => {
    const storage = createMemoryStorage();
    const lockManager = createQueuedLockManager();
    const snapshot = makeSnapshot();

    const appendPromise = appendMiningSnapshotSafely({ ...storage, lockManager, snapshot, instanceId: 'tab-a' });
    const clearPromise = clearMiningHistorySafely({ ...storage, lockManager });
    await Promise.all([appendPromise, clearPromise]);

    const result = await readMiningHistorySafely({ getValue: storage.getValue, lockManager });
    expect(result.history.snapshots).toEqual([]);
    expect(lockManager.requests.map((request) => request.mode)).toEqual(['exclusive', 'exclusive', 'shared']);
  });

  it('retries and verifies clear operations when Web Locks are unavailable', async () => {
    const initial = new Map([[MINING_HISTORY_STORAGE_KEY, { ...createEmptyMiningHistory(), snapshots: [makeSnapshot()] }]]);
    const storage = createMemoryStorage(initial);
    let replaceFirstClear = true;
    const setValue = vi.fn(async (key, value) => {
      storage.values.set(key, structuredClone(value));
      if (key === MINING_HISTORY_STORAGE_KEY && replaceFirstClear) {
        replaceFirstClear = false;
        storage.values.set(key, { ...createEmptyMiningHistory(), snapshots: [makeSnapshot()] });
      }
    });

    const result = await clearMiningHistorySafely({
      getValue: storage.getValue,
      setValue,
      lockManager: undefined,
      sleep: async () => undefined,
      random: () => 0,
    });

    expect(result).toMatchObject({ usedWebLock: false, attempts: 2 });
    expect(result.history.snapshots).toEqual([]);
  });
});
