import { afterEach, describe, expect, it } from 'vitest';
import { createManualObservation, getCaptureOrderingReceipt, isValidPlayerDataObservation, type PlayerDataObservation } from './playerDataObservation';
import { createDefaultAcquisitionPlannerInputState, loadAcquisitionPlannerInputState, normalizeAcquisitionPlannerInputState } from './acquisitionPlannerState';
import { persistInventoryImport, persistManualInventoryState, prepareInventoryPaste, createMasteryImportSnapshot } from './playerDataImports';
import { prepareCaptureImport } from './captureImportAdapter';
import { parseMasteryPaste } from './parseMasteryPaste';
import { createAppBackupPayload, validateAppBackupPayloadV1 } from './appBackupSchema';

const now = '2026-10-09T12:00:00.000Z';
const captureObservation: PlayerDataObservation = {
  source: 'capture', scope: 'full', captureId: 'capture-1',
  observedAt: '2026-10-09T11:00:00.000Z', appliedAt: now,
};

afterEach(() => localStorage.clear());

function backup() {
  const state = createDefaultAcquisitionPlannerInputState();
  state.inventory.observation = captureObservation;
  const snapshot = createMasteryImportSnapshot(parseMasteryPaste('Steel\n10 / 1,000 Progress'), '', now, 'snapshot-1');
  snapshot.observation = captureObservation;
  return createAppBackupPayload({
    appVersion: '1.1.0', exportedAt: now, snapshots: [snapshot],
    craftingModifierState: null, acquisitionPlannerState: state, themePreference: null,
  });
}

describe('durable player data observations', () => {
  it('stores manual provenance with inventory and does not invent freshness for legacy state', () => {
    const state = createDefaultAcquisitionPlannerInputState();
    expect(normalizeAcquisitionPlannerInputState(state).inventory.observation).toBeUndefined();
    const saved = persistInventoryImport(state, prepareInventoryPaste('Steel, 0', null), localStorage, now);
    expect(loadAcquisitionPlannerInputState().inventory).toEqual({
      entries: [{ canonicalItemKey: 'steel', itemName: 'Steel', inventoryCount: 0 }],
      observation: createManualObservation('full', now),
    });
    expect(saved.inventory.observation).toEqual(createManualObservation('full', now));
  });

  it('a manual correction protects against delayed captures observed before the correction', () => {
    const saved = persistManualInventoryState(createDefaultAcquisitionPlannerInputState(), 'item', localStorage, now);
    const result = prepareCaptureImport({
      schemaVersion: 1, captureId: 'delayed', section: 'inventory', scope: 'full',
      sourceUrl: 'https://farmrpg.com/inventory.php', observedAt: '2026-10-09T11:59:00.000Z',
    }, { now, requiredSections: ['Items'], lookup: null, previous: getCaptureOrderingReceipt(saved.inventory.observation, 'inventory') });
    expect(result).toMatchObject({ ok: false, reason: expect.stringContaining('Older') });
    expect(getCaptureOrderingReceipt(captureObservation, 'mastery')).toEqual({ captureId: 'capture-1', section: 'mastery', observedAt: captureObservation.observedAt });
  });

  it('new backups round-trip capture metadata alongside both datasets', () => {
    const result = validateAppBackupPayloadV1(JSON.parse(JSON.stringify(backup())));
    if (!result.ok) throw new Error(result.message);
    expect(result.payload.state.snapshots[0].observation).toEqual(captureObservation);
    const restored = normalizeAcquisitionPlannerInputState(result.payload.state.preferences.acquisitionPlannerState);
    expect(restored.inventory.observation).toEqual(captureObservation);
  });

  it('old backups remain valid and do not acquire a fabricated observation', () => {
    const payload = backup();
    delete payload.state.snapshots[0].observation;
    delete payload.state.preferences.acquisitionPlannerState!.inventory.observation;
    const result = validateAppBackupPayloadV1(payload);
    if (!result.ok) throw new Error(result.message);
    expect(result.payload.state.snapshots[0].observation).toBeUndefined();
    expect(result.payload.state.preferences.acquisitionPlannerState!.inventory.observation).toBeUndefined();
  });

  it.each([
    { ...captureObservation, captureId: undefined },
    { ...captureObservation, source: 'server' },
    { ...captureObservation, observedAt: 'yesterday' },
    { ...captureObservation, appliedAt: '2020-01-01T00:00:00.000Z' },
    { ...captureObservation, scope: 'account' },
    { ...captureObservation, source: 'manual' },
  ])('rejects malformed metadata in either backup section', (bad) => {
    expect(isValidPlayerDataObservation(bad)).toBe(false);
    const payload = backup();
    payload.state.snapshots[0].observation = bad as PlayerDataObservation;
    expect(validateAppBackupPayloadV1(payload)).toMatchObject({ ok: false, code: 'invalid_snapshot' });
    payload.state.snapshots[0].observation = captureObservation;
    payload.state.preferences.acquisitionPlannerState!.inventory.observation = bad as PlayerDataObservation;
    expect(validateAppBackupPayloadV1(payload)).toMatchObject({ ok: false, code: 'invalid_acquisition_planner_state' });
  });
});
