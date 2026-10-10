import { describe, expect, it } from 'vitest';
import { prepareCaptureImport, type CaptureImportContext } from './captureImportAdapter';
import { createDefaultAcquisitionPlannerInputState, loadAcquisitionPlannerInputState, saveAcquisitionPlannerInputState } from './acquisitionPlannerState';
import { createMasteryImportSnapshot, persistInventoryImport, prepareInventoryPaste } from './playerDataImports';
import { parseMasteryPaste } from './parseMasteryPaste';
import { parseItemAliasesCsv } from './itemAliases';
import { ITEM_CATALOG_COLUMNS, parseItemCatalogCsv } from './loadItemCatalog';
import { MUSEUM_LOOKUP_COVERAGE_COLUMNS, parseMuseumLookupCoverageCsv } from './loadMuseumLookupCoverage';

const now = '2026-10-09T12:00:00.000Z';
const context: CaptureImportContext = { now, requiredSections: ['Items', 'Seeds'], lookup: null };

function capture() {
  return {
    schemaVersion: 1,
    captureId: 'capture-1',
    section: 'inventory',
    scope: 'full',
    sourceUrl: 'https://farmrpg.com/inventory.php',
    observedAt: now,
    coverage: {
      activePage: true,
      settled: true,
      sections: [
        { id: 'Items', loaded: true, expectedRows: 2 },
        { id: 'Seeds', loaded: true, expectedRows: 0 },
      ],
    },
    rows: [
      { itemName: 'Steel', count: 10, sectionId: 'Items' },
      { itemName: 'Corn', count: 0, sectionId: 'Items' },
    ],
  };
}

describe('capture import preparation', () => {
  it('matches manual inventory resolution and keeps observed zero through persistence', async () => {
    const prepared = prepareCaptureImport(capture(), context);
    const paste = prepareInventoryPaste('Steel, 10\nCorn, 0', null);
    expect(prepared.ok && prepared.section === 'inventory' && prepared.parsed).toEqual(paste);
    if (!prepared.ok || prepared.section !== 'inventory') throw new Error('Expected inventory');
    const state = createDefaultAcquisitionPlannerInputState();
    state.inventory.entries = [{ canonicalItemKey: 'pine', itemName: 'Pine', inventoryCount: 999 }];
    state.explore.availableStamina = 1234;
    state.pets.storedInventoryEntries = [{ canonicalItemKey: 'steel', itemName: 'Steel', storedCount: 90 }];
    state.ownedNow.entries = [{ canonicalItemKey: 'steel', itemName: 'Steel', ownedCount: 80, sourceCategory: 'stockpile' }];
    saveAcquisitionPlannerInputState(state, localStorage, true);
    const saved = await persistInventoryImport(state, prepared.parsed, localStorage);
    expect(saved).toEqual({ ...state, inventory: { entries: paste.entries, observation: expect.objectContaining({ source: 'manual', scope: 'full' }) } });
    expect(loadAcquisitionPlannerInputState(localStorage)).toEqual(saved);
    expect(state.inventory.entries[0].inventoryCount).toBe(999);
  });

  it('accepts genuine inventory shrinkage without a previous-row-count heuristic', () => {
    const payload = capture();
    payload.rows = [payload.rows[0]];
    payload.coverage.sections[0].expectedRows = 1;
    expect(prepareCaptureImport(payload, context).ok).toBe(true);
  });

  it.each([
    ['schema', { schemaVersion: 2 }],
    ['section', { section: 'pets' }],
    ['partial scope', { scope: 'item' }],
    ['empty ID', { captureId: '' }],
    ['bad time', { observedAt: 'yesterday' }],
    ['future time', { observedAt: '2027-01-01T00:00:00.000Z' }],
    ['wrong origin', { sourceUrl: 'https://farmrpg.com.evil.example/inventory.php' }],
    ['credentials in URL', { sourceUrl: 'https://user:secret@farmrpg.com/inventory.php' }],
    ['wrong port', { sourceUrl: 'https://farmrpg.com:8443/inventory.php' }],
    ['empty capture', { rows: [] }],
    ['initialized fields only', { rows: undefined, fields: { inventory: {} } }],
  ])('rejects %s without mutating caller state', (_label, patch) => {
    const payload = { ...capture(), ...patch };
    const before = JSON.stringify(payload);
    expect(prepareCaptureImport(payload, context).ok).toBe(false);
    expect(JSON.stringify(payload)).toBe(before);
  });

  it.each([NaN, Infinity, -1, 1.2, Number.MAX_SAFE_INTEGER + 1, '10', null])('rejects invalid quantity %s', (count) => {
    const payload = { ...capture(), rows: [{ itemName: 'Steel', count, sectionId: 'Items' }] };
    expect(prepareCaptureImport(payload, context).ok).toBe(false);
  });

  it('rejects unloaded, stale, missing and incorrectly counted section evidence', () => {
    for (const coverage of [
      { ...capture().coverage, activePage: false },
      { ...capture().coverage, settled: false },
      { ...capture().coverage, sections: capture().coverage.sections.slice(0, 1) },
      { ...capture().coverage, sections: [{ id: 'Items', loaded: false, expectedRows: 2 }, capture().coverage.sections[1]] },
      { ...capture().coverage, sections: [{ id: 'Items', loaded: true, expectedRows: 3 }, capture().coverage.sections[1]] },
    ]) {
      expect(prepareCaptureImport({ ...capture(), coverage }, context).ok).toBe(false);
    }
    expect(prepareCaptureImport(capture(), { ...context, requiredSections: [] }).ok).toBe(false);
  });

  it('rejects duplicates and old/simultaneous delivery per section, not across unrelated sections', () => {
    const previous = { captureId: 'capture-1', section: 'inventory' as const, observedAt: now };
    expect(prepareCaptureImport(capture(), { ...context, previous })).toMatchObject({ ok: false, reason: expect.stringContaining('Duplicate') });
    expect(prepareCaptureImport({ ...capture(), captureId: 'capture-2' }, { ...context, previous }).ok).toBe(false);
    expect(prepareCaptureImport({ ...capture(), observedAt: '2026-10-08T12:00:00.000Z' }, { ...context, previous, now }).ok).toBe(false);
    expect(prepareCaptureImport(capture(), { ...context, previous: { ...previous, section: 'mastery' } }).ok).toBe(true);
  });

  it('uses reviewed aliases, warns about unknowns, and rejects canonical collisions', () => {
    const lookup = {
      itemCatalog: parseItemCatalogCsv(`${ITEM_CATALOG_COLUMNS.join(',')}\nSteel,steel,yes,,,test,`),
      aliases: parseItemAliasesCsv('alias_name,alias_key,canonical_item_name,canonical_key,review_status,source,notes\nSteel Alias,steel alias,Steel,steel,approved,test,'),
      museumCoverage: parseMuseumLookupCoverageCsv(MUSEUM_LOOKUP_COVERAGE_COLUMNS.join(',')),
    };
    const payload = capture();
    payload.rows[0].itemName = 'Steel Alias';
    const prepared = prepareCaptureImport(payload, { ...context, lookup });
    const paste = prepareInventoryPaste('Steel Alias, 10\nCorn, 0', lookup);
    expect(prepared.ok && prepared.section === 'inventory' && prepared.parsed.entries).toEqual(paste.entries);
    expect(prepared.ok && prepared.section === 'inventory' && prepared.parsed.warnings.join(' ')).toContain('Corn');
    payload.rows[1].itemName = 'Steel';
    expect(prepareCaptureImport(payload, { ...context, lookup }).ok).toBe(false);
  });

  it('rejects prototype keys, cyclic payloads and oversized captures', () => {
    for (const itemName of ['__proto__', 'constructor', 'prototype']) {
      const payload = capture();
      payload.rows[0].itemName = itemName;
      expect(prepareCaptureImport(payload, context).ok).toBe(false);
    }
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(prepareCaptureImport(cyclic, context).ok).toBe(false);
    expect(prepareCaptureImport({ ...capture(), padding: 'x'.repeat(5_000_001) }, context).ok).toBe(false);
  });

  it('builds equivalent mastery values/tiers without manufacturing paste text', () => {
    const payload = {
      ...capture(), section: 'mastery',
      coverage: { activePage: true, settled: true, sections: [
        { id: '100000', loaded: true, expectedRows: 1 },
        { id: 'INF', loaded: true, expectedRows: 1 },
      ] },
      rows: [
        { itemName: 'Steel', count: 50000, targetTier: 100000, sectionId: '100000' },
        { itemName: 'Corn', count: 1000001, targetTier: 'INF', sectionId: 'INF' },
      ],
    };
    const prepared = prepareCaptureImport(payload, { ...context, requiredSections: ['100000', 'INF'] });
    if (!prepared.ok || prepared.section !== 'mastery') throw new Error('Expected mastery');
    const manual = parseMasteryPaste('Steel\n50,000 / 100,000 Progress\nCorn\n1,000,001 / infinity Progress');
    expect(prepared.parsed.masteryByItem).toEqual(manual.masteryByItem);
    expect(prepared.parsed.parseSummary).toEqual(manual.parseSummary);
    const snapshot = createMasteryImportSnapshot(prepared.parsed, '', now, 'snapshot-1');
    expect(snapshot).toMatchObject({ snapshotId: 'snapshot-1', createdAt: now, rawText: '', masteryByItem: manual.masteryByItem });
    expect(prepareCaptureImport({ ...payload, rows: [{ ...payload.rows[0], targetTier: 123 }] }, { ...context, requiredSections: ['100000', 'INF'] }).ok).toBe(false);
  });

  it('retains storage on empty imports and exposes write failure instead of claiming success', async () => {
    localStorage.clear();
    localStorage.setItem('sentinel', 'retained');
    const state = createDefaultAcquisitionPlannerInputState();
    await expect(persistInventoryImport(state, { entries: [], warnings: [] }, localStorage)).rejects.toThrow('retained');
    expect(localStorage.getItem('sentinel')).toBe('retained');
    expect(() => createMasteryImportSnapshot(parseMasteryPaste(''), '')).toThrow('retained');
    const storage = { getItem: () => null, setItem: () => { throw new Error('Storage full'); } } as unknown as Storage;
    await expect(persistInventoryImport(state, prepareInventoryPaste('Steel, 10', null), storage)).rejects.toThrow('Storage full');
  });
});
