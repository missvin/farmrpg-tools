import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { applyCapture } from './captureApplication';
import { PLAYER_DATA_LOCK, withPlayerDataLock } from './playerDataLock';
import { ACQUISITION_PLANNER_STATE_STORAGE_KEY, createDefaultAcquisitionPlannerInputState, loadAcquisitionPlannerInputState, saveAcquisitionPlannerInputState, upsertCurrentInventoryItemInput } from './acquisitionPlannerState';
import { createMasteryImportSnapshot, persistInventoryImport, persistManualInventoryState, persistMasteryImport, prepareInventoryPaste } from './playerDataImports';
import { parseMasteryPaste } from './parseMasteryPaste';
import { createManualObservation } from './playerDataObservation';
import { LIVE_CAPTURE_MASTERY_ID, type MasterySnapshot } from './storage/masterySnapshots';
import { loadUnknownItemEvidenceState, UNKNOWN_ITEM_EVIDENCE_STORAGE_KEY } from './unknownItemEvidence';
import { parseItemAliasesCsv } from './itemAliases';
import { ITEM_CATALOG_COLUMNS, parseItemCatalogCsv } from './loadItemCatalog';
import { MUSEUM_LOOKUP_COVERAGE_COLUMNS, parseMuseumLookupCoverageCsv } from './loadMuseumLookupCoverage';

const db = vi.hoisted(() => ({ values: new Map<string, MasterySnapshot>(), save: vi.fn(), latest: vi.fn() }));
vi.mock('./storage/masterySnapshots', () => ({
  LIVE_CAPTURE_MASTERY_ID: 'capture-live-mastery', createSnapshotId: () => 'manual-snapshot',
  getLatestSnapshot: () => db.latest(),
  getSnapshot: async (id: string) => db.values.get(id) ?? null,
  listSnapshots: async () => [...db.values.values()].filter((row) => row.snapshotId !== 'capture-live-mastery').sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  saveSnapshot: async (snapshot: MasterySnapshot) => { await db.save([snapshot]); },
  saveSnapshots: async (snapshots: MasterySnapshot[]) => { await db.save(snapshots); },
}));

const baseline = '2026-10-09T10:00:00.000Z';
const observed = '2026-10-09T11:00:00.000Z';
let now = '2026-10-09T12:00:00.000Z';
const context = { lookup: emptyLookup(), requiredSections: ['Items'], now: () => now };
function inventory(captureId = 'first', observedAt = observed, count = 10) {
  return {
    schemaVersion: 1, captureId, section: 'inventory', scope: 'full', observedAt,
    sourceUrl: 'https://farmrpg.com/inventory.php',
    coverage: { activePage: true, settled: true, sections: [{ id: 'Items', loaded: true, expectedRows: 2 }] },
    rows: [{ itemName: 'Steel', count, sectionId: 'Items' }, { itemName: 'Corn', count: 0, sectionId: 'Items' }],
  };
}
function mastery(captureId = 'first', observedAt = observed, count = 100) {
  return { ...inventory(captureId, observedAt), section: 'mastery',
    coverage: { activePage: true, settled: true, sections: [{ id: '1000', loaded: true, expectedRows: 1 }] },
    rows: [{ itemName: 'Steel', count, sectionId: '1000', targetTier: 1000 }],
  };
}
const masteryContext = { ...context, requiredSections: ['1000'] };
function emptyLookup() {
  return {
    itemCatalog: parseItemCatalogCsv(ITEM_CATALOG_COLUMNS.join(',')),
    aliases: parseItemAliasesCsv('alias_name,alias_key,canonical_item_name,canonical_key,review_status,source,notes'),
    museumCoverage: parseMuseumLookupCoverageCsv(MUSEUM_LOOKUP_COVERAGE_COLUMNS.join(',')),
  };
}

beforeEach(() => {
  localStorage.clear(); db.values.clear(); db.save.mockReset(); db.latest.mockReset();
  now = '2026-10-09T12:00:00.000Z';
  db.save.mockImplementation(async (snapshots: MasterySnapshot[]) => {
    snapshots.forEach((snapshot) => db.values.set(snapshot.snapshotId, structuredClone(snapshot)));
  });
  db.latest.mockImplementation(async () => [...db.values.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.snapshotId.localeCompare(a.snapshotId))[0] ?? null);
  // A shared origin lock manager stands in for two independent tab callers.
  let tail: Promise<unknown> = Promise.resolve();
  Object.defineProperty(navigator, 'locks', { configurable: true, value: {
    request: vi.fn((name: string, options: LockOptions, work: () => Promise<unknown>) => {
      expect(name).toBe(PLAYER_DATA_LOCK); expect(options.mode).toBe('exclusive');
      const next = tail.then(work); tail = next.catch(() => undefined); return next;
    }),
  } });
});
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined }); });

describe('serialized capture application', () => {
  it('requires loaded references so unknown items cannot bypass evidence review', async () => {
    expect(await applyCapture(inventory(), { ...context, lookup: null })).toMatchObject({ ok: false, reason: expect.stringContaining('references') });
    expect(localStorage.getItem(ACQUISITION_PLANNER_STATE_STORAGE_KEY)).toBeNull();
  });
  it('replaces full inventory including explicit zero, preserving unrelated current supply/settings', async () => {
    const state = createDefaultAcquisitionPlannerInputState();
    state.explore.availableStamina = 123;
    state.pets.storedInventoryEntries = [{ canonicalItemKey: 'pine', itemName: 'Pine', storedCount: 80 }];
    state.ownedNow.entries = [{ canonicalItemKey: 'steel', itemName: 'Steel', ownedCount: 40, sourceCategory: 'stockpile' }];
    state.inventory.entries = [{ canonicalItemKey: 'pine', itemName: 'Pine', inventoryCount: 999 }];
    state.inventory.observation = createManualObservation('full', baseline);
    saveAcquisitionPlannerInputState(state);
    expect(await applyCapture(inventory(), context)).toMatchObject({ ok: true });
    expect(loadAcquisitionPlannerInputState()).toEqual({ ...state, inventory: {
      entries: [{ canonicalItemKey: 'corn', itemName: 'Corn', inventoryCount: 0 }, { canonicalItemKey: 'steel', itemName: 'Steel', inventoryCount: 10 }],
      observation: { source: 'capture', scope: 'full', captureId: 'first', observedAt: observed, appliedAt: now },
    } });
    // An old settings/pet view cannot roll inventory back.
    state.explore.availableStamina = 456;
    expect(saveAcquisitionPlannerInputState(state).inventory.entries[1].inventoryCount).toBe(10);
  });

  it('rechecks ordering inside the shared lock for reversed/concurrent delivery and duplicates', async () => {
    const newer = inventory('newer', '2026-10-09T11:30:00.000Z', 20);
    const results = await Promise.all([applyCapture(newer, context), applyCapture(inventory(), context), applyCapture(newer, context)]);
    expect(results).toMatchObject([{ ok: true }, { ok: false, reason: expect.stringContaining('Older') }, { ok: false, reason: expect.stringContaining('Duplicate') }]);
    expect(loadAcquisitionPlannerInputState().inventory.entries[1].inventoryCount).toBe(20);
  });

  it('applies manual item edits to fresh inventory and blocks delayed captures', async () => {
    const first = applyCapture(inventory(), context);
    const manual = persistManualInventoryState((current) => upsertCurrentInventoryItemInput(current, { itemName: 'Pine', inventoryCount: 7 }), 'item', undefined, now);
    const delayed = applyCapture(inventory('delayed', '2026-10-09T11:30:00.000Z'), context);
    await first; await manual;
    expect(await delayed).toMatchObject({ ok: false, reason: expect.stringContaining('Older') });
    expect(loadAcquisitionPlannerInputState().inventory.entries.map((row) => row.itemName)).toEqual(['Corn', 'Pine', 'Steel']);
  });

  it('owns queued payloads and releases the lock after a failure', async () => {
    let release!: () => void;
    const held = withPlayerDataLock(() => new Promise<void>((resolve) => { release = resolve; }));
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    const payload = inventory(); const waiting = applyCapture(payload, context);
    payload.rows[0].count = 999;
    release(); await held;
    expect(await waiting).toMatchObject({ ok: true });
    expect(loadAcquisitionPlannerInputState().inventory.entries[1].inventoryCount).toBe(10);
    expect(await applyCapture({}, context)).toMatchObject({ ok: false });
    expect(await applyCapture(inventory('next', now, 11), context)).toMatchObject({ ok: true });
  });

  it.each([undefined, { source: 'capture' }, { ...createManualObservation('full', baseline), appliedAt: '2030-01-01T00:00:00.000Z' }])('fails closed on legacy, malformed or future ordering: %j', async (observation) => {
    const state = createDefaultAcquisitionPlannerInputState();
    const raw = JSON.stringify({ ...state, inventory: { entries: [], observation } });
    localStorage.setItem(ACQUISITION_PLANNER_STATE_STORAGE_KEY, raw);
    expect(await applyCapture(inventory(), context)).toMatchObject({ ok: false, reason: expect.stringContaining('ordering') });
    expect(localStorage.getItem(ACQUISITION_PLANNER_STATE_STORAGE_KEY)).toBe(raw);
    await persistInventoryImport(state, prepareInventoryPaste('Pine, 2', null), undefined, baseline);
    expect(await applyCapture(inventory(), context)).toMatchObject({ ok: true });
  });

  it('rejects corrupt state and missing cross-tab locks without changing data; manual import still works', async () => {
    localStorage.setItem(ACQUISITION_PLANNER_STATE_STORAGE_KEY, '{broken');
    expect(await applyCapture(inventory(), context)).toMatchObject({ ok: false });
    expect(localStorage.getItem(ACQUISITION_PLANNER_STATE_STORAGE_KEY)).toBe('{broken');
    Object.defineProperty(navigator, 'locks', { value: undefined });
    expect(await applyCapture(inventory(), context)).toMatchObject({ ok: false, reason: expect.stringContaining('cross-tab') });
    await persistInventoryImport(createDefaultAcquisitionPlannerInputState(), prepareInventoryPaste('Steel, 1', null));
    expect(loadAcquisitionPlannerInputState().inventory.observation?.source).toBe('manual');
  });

  it('persists unknown-item evidence using normalized identity without a fatal reference miss', async () => {
    const lookup = emptyLookup();
    const result = await applyCapture(inventory(), { ...context, lookup });
    expect(result).toMatchObject({ ok: true, warnings: expect.arrayContaining([expect.stringContaining('Steel')]) });
    expect(loadUnknownItemEvidenceState().evidenceRecords.map((record) => record.normalizedKey).sort()).toEqual(['corn', 'steel']);
    const before = localStorage.getItem(UNKNOWN_ITEM_EVIDENCE_STORAGE_KEY);
    await applyCapture(inventory(), { ...context, lookup });
    expect(localStorage.getItem(UNKNOWN_ITEM_EVIDENCE_STORAGE_KEY)).toBe(before);
  });

  it.each([UNKNOWN_ITEM_EVIDENCE_STORAGE_KEY, ACQUISITION_PLANNER_STATE_STORAGE_KEY])('does not claim application when %s fails', async (key) => {
    const write = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, name, value) {
      if (name === key) throw new Error('Quota exceeded');
      write.call(this, name, value);
    });
    expect(await applyCapture(inventory(), { ...context, lookup: emptyLookup() })).toMatchObject({ ok: false, reason: 'Quota exceeded' });
    expect(localStorage.getItem(ACQUISITION_PLANNER_STATE_STORAGE_KEY)).toBeNull();
  });
});

describe('live mastery and bounded history', () => {
  it('updates live values on every newer capture but creates only one checkpoint per changed UTC day', async () => {
    expect(await applyCapture(mastery(), masteryContext)).toMatchObject({ ok: true, historySaved: true });
    expect(await applyCapture(mastery('second', now, 200), masteryContext)).toMatchObject({ ok: true, historySaved: false });
    expect(db.values.get(LIVE_CAPTURE_MASTERY_ID)?.masteryByItem).toEqual({ steel: 200 });
    expect(db.values.get('capture-history-2026-10-09')?.masteryByItem).toEqual({ steel: 100 });
    now = '2026-10-10T12:00:00.000Z';
    expect(await applyCapture(mastery('unchanged-live', now, 200), masteryContext)).toMatchObject({ ok: true, historySaved: true });
    now = '2026-10-10T13:00:00.000Z';
    expect(await applyCapture(mastery('changed', now, 0), masteryContext)).toMatchObject({ ok: true, historySaved: false });
    expect(db.values.size).toBe(3);
    expect(db.values.get(LIVE_CAPTURE_MASTERY_ID)?.masteryByItem).toEqual({ steel: 0 });
    expect(await applyCapture(mastery('changed', now, 0), masteryContext)).toMatchObject({ ok: false });
  });

  it('does not duplicate unchanged historical content on a new day', async () => {
    await applyCapture(mastery(), masteryContext);
    now = '2026-10-10T12:00:00.000Z';
    expect(await applyCapture(mastery('unchanged', now), masteryContext)).toMatchObject({ ok: true, historySaved: false });
    expect(db.values.size).toBe(2);
    expect(db.values.get(LIVE_CAPTURE_MASTERY_ID)?.observation?.observedAt).toBe(now);
  });

  it('manual mastery imports share serialization and protect against delayed captures', async () => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    try {
      const results = await Promise.all([
        applyCapture(mastery(), masteryContext),
        persistMasteryImport(parseMasteryPaste('Corn\n55 / 1,000 Progress'), 'manual'),
        applyCapture(mastery('delayed', '2026-10-09T11:30:00.000Z'), masteryContext),
      ]);
      expect(results[2]).toMatchObject({ ok: false });
      expect(db.values.get('manual-snapshot')?.masteryByItem).toEqual({ corn: 55 });
    } finally { vi.useRealTimers(); }
  });

  it('retains legacy mastery and fails visibly on read/transaction failure', async () => {
    const legacy = createMasteryImportSnapshot(parseMasteryPaste('Corn\n55 / 1,000 Progress'), '', baseline, 'legacy');
    delete legacy.observation; db.values.set(legacy.snapshotId, legacy);
    expect(await applyCapture(mastery(), masteryContext)).toMatchObject({ ok: false, reason: expect.stringContaining('ordering') });
    db.latest.mockRejectedValueOnce(new Error('Read failed'));
    expect(await applyCapture(mastery(), masteryContext)).toMatchObject({ ok: false, reason: 'Read failed' });
    db.values.clear(); db.save.mockRejectedValueOnce(new Error('Transaction aborted'));
    expect(await applyCapture(mastery(), masteryContext)).toMatchObject({ ok: false, reason: 'Transaction aborted' });
    expect(db.values.size).toBe(0);
  });

  it('waits for committed mastery before returning its receipt', async () => {
    let complete!: () => void;
    db.save.mockImplementationOnce(() => new Promise<void>((resolve) => { complete = resolve; }));
    let acknowledged = false;
    const applying = applyCapture(mastery(), masteryContext).then((result) => { acknowledged = true; return result; });
    await vi.waitFor(() => expect(complete).toBeTypeOf('function'));
    expect(acknowledged).toBe(false); complete();
    expect(await applying).toMatchObject({ ok: true });
  });
});
