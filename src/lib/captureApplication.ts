import {
  ACQUISITION_PLANNER_STATE_STORAGE_KEY, loadAcquisitionPlannerInputState,
  replaceCurrentInventoryEntries, saveAcquisitionPlannerInputState,
} from './acquisitionPlannerState';
import { prepareCaptureImport, type CaptureImportContext, type CaptureReceipt } from './captureImportAdapter';
import { getCaptureOrderingReceipt, isValidPlayerDataObservation, type PlayerDataObservation } from './playerDataObservation';
import { withPlayerDataLock } from './playerDataLock';
import { getLatestSnapshot, getSnapshot, listSnapshots, saveSnapshots, LIVE_CAPTURE_MASTERY_ID, type MasterySnapshot } from './storage/masterySnapshots';
import { createUnknownItemEvidenceFromWarnings, recordUnknownItemEvidence, UNKNOWN_ITEM_EVIDENCE_STORAGE_KEY, isValidUnknownItemEvidenceState } from './unknownItemEvidence';

export type CaptureApplicationResult =
  | { ok: true; receipt: CaptureReceipt; warnings: string[]; historySaved: boolean }
  | { ok: false; reason: string };
type ApplicationContext = Pick<CaptureImportContext, 'lookup' | 'requiredSections'> & { now?: () => string };

function ordering(observation: unknown, section: CaptureReceipt['section'], now: string): CaptureReceipt {
  if (!isValidPlayerDataObservation(observation) || observation.appliedAt > now) {
    throw new Error('Saved ordering is unknown or invalid. Review and manually import this dataset before capture.');
  }
  return getCaptureOrderingReceipt(observation, section)!;
}

function inventoryOrdering(now: string): CaptureReceipt | undefined {
  const raw = localStorage.getItem(ACQUISITION_PLANNER_STATE_STORAGE_KEY);
  if (raw === null) return undefined; // Truly new storage has no data to overwrite.
  const saved = JSON.parse(raw);
  if (saved?.schemaVersion !== 1 || !Array.isArray(saved?.inventory?.entries)) {
    throw new Error('Saved inventory state is invalid. Review and manually import before capture.');
  }
  return ordering(saved?.inventory?.observation, 'inventory', now);
}

function sameMastery(left: MasterySnapshot | null, right: MasterySnapshot): boolean {
  const sorted = (snapshot: MasterySnapshot) => JSON.stringify({
    counts: Object.entries(snapshot.masteryByItem).sort(([a], [b]) => a.localeCompare(b)),
    tiers: snapshot.parsedRows?.map((row) => [row.canonicalKey, row.targetTier]).sort(([a], [b]) => String(a).localeCompare(String(b))),
  });
  return left !== null && sorted(left) === sorted(right);
}

/** Trusted receiver service, not a message listener. Never acknowledge before durable commit. */
export async function applyCapture(payload: unknown, context: ApplicationContext): Promise<CaptureApplicationResult> {
  try {
    if (!context.lookup) {
      return { ok: false, reason: 'Local item references are not loaded. Capture was not applied; retry after loading them.' };
    }
    // Own the input while waiting for other tabs; callers cannot mutate queued captures.
    const ownedPayload: unknown = structuredClone(payload);
    return await withPlayerDataLock(async () => {
      const now = context.now?.() ?? new Date().toISOString();
      const checked = prepareCaptureImport(ownedPayload, { ...context, now });
      if (!checked.ok) return checked;
      const latest = checked.section === 'mastery' ? await getLatestSnapshot() : null;
      const previous = checked.section === 'inventory'
        ? inventoryOrdering(now)
        : latest ? ordering(latest.observation, 'mastery', now) : undefined;
      const prepared = prepareCaptureImport(ownedPayload, { ...context, now, previous });
      if (!prepared.ok) return prepared;
      const observation: PlayerDataObservation = {
        source: 'capture', scope: 'full', captureId: prepared.receipt.captureId,
        observedAt: prepared.receipt.observedAt, appliedAt: now,
      };
      const warnings = prepared.section === 'inventory' ? prepared.parsed.warnings : prepared.parsed.parseSummary.warnings;
      const evidence = localStorage.getItem(UNKNOWN_ITEM_EVIDENCE_STORAGE_KEY);
      if (evidence !== null && !isValidUnknownItemEvidenceState(JSON.parse(evidence))) {
        throw new Error('Saved unknown-item evidence is invalid. Capture was not applied.');
      }
      // Evidence is non-authoritative: it may survive a subsequent data-write
      // failure. Failure to save evidence prevents application, never silent loss.
      recordUnknownItemEvidence(createUnknownItemEvidenceFromWarnings(warnings, {
        sourceType: 'other', sourceLabel: `Captured ${prepared.section}`,
      }, observation.observedAt));
      let historySaved = false;
      if (prepared.section === 'inventory') {
        const current = loadAcquisitionPlannerInputState();
        const next = replaceCurrentInventoryEntries(current, prepared.parsed.entries);
        next.inventory.observation = observation;
        saveAcquisitionPlannerInputState(next, undefined, true);
      } else {
        const snapshot: MasterySnapshot = {
          snapshotId: LIVE_CAPTURE_MASTERY_ID, createdAt: now, rawText: '',
          masteryByItem: prepared.parsed.masteryByItem, parsedRows: prepared.parsed.parsedRows,
          parseSummary: prepared.parsed.parseSummary, observation,
        };
        const historyId = `capture-history-${observation.observedAt.slice(0, 10)}`;
        const history = await getSnapshot(historyId);
        // Compare with retained history, not the rapidly changing live value:
        // yesterday's later progress must still earn today's checkpoint.
        const previousHistory = (await listSnapshots())[0] ?? null;
        historySaved = !history && !sameMastery(previousHistory, snapshot);
        await saveSnapshots(historySaved ? [snapshot, {
          ...snapshot, snapshotId: historyId, createdAt: observation.observedAt, importedAt: now,
        }] : [snapshot]);
      }
      return { ok: true, receipt: prepared.receipt, warnings, historySaved };
    }, true);
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'Capture application failed. Previous data retained.' };
  }
}
