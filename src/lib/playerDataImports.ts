import {
  replaceCurrentInventoryEntries,
  saveAcquisitionPlannerInputState,
  type AcquisitionPlannerInputState,
} from './acquisitionPlannerState';
import { resolveLocalItemReference, type LocalItemReferenceLookup } from './localItemReferenceLookup';
import { parseCurrentInventoryPaste, type ParseCurrentInventoryPasteResult } from './parseCurrentInventoryPaste';
import type { ParseResult } from './parseMasteryPaste';
import { createSnapshotId, saveSnapshot, type MasterySnapshot } from './storage/masterySnapshots';

/** Shared resolution for pasted inventory and structured observations. */
export function inventoryImportResolver(lookup: LocalItemReferenceLookup | null) {
  return lookup
    ? (itemName: string) => {
        const result = resolveLocalItemReference(itemName, lookup);
        return {
          canonicalItemKey: result.canonicalKey,
          itemName: result.displayName,
          recognized: result.recognized,
          warnings: result.recognized ? [] : result.warnings,
        };
      }
    : undefined;
}

export function prepareInventoryPaste(rawText: string, lookup: LocalItemReferenceLookup | null) {
  return parseCurrentInventoryPaste(rawText, { resolveItem: inventoryImportResolver(lookup) });
}

/** Only inventory changes. Pet stock, owned supplies and planning assumptions survive. */
export function persistInventoryImport(
  state: AcquisitionPlannerInputState,
  parsed: ParseCurrentInventoryPasteResult,
  storage?: Storage,
): AcquisitionPlannerInputState {
  if (parsed.entries.length === 0) {
    throw new Error('No item quantities found. Previous inventory was retained.');
  }

  return saveAcquisitionPlannerInputState(replaceCurrentInventoryEntries(state, parsed.entries), storage);
}

export function createMasteryImportSnapshot(
  parsed: ParseResult,
  rawText: string,
  savedAt = new Date().toISOString(),
  snapshotId = createSnapshotId(),
): MasterySnapshot {
  if (parsed.parseSummary.itemsParsed === 0) {
    throw new Error('No mastery items found. Previous snapshots were retained.');
  }

  return {
    snapshotId,
    createdAt: savedAt,
    rawText,
    masteryByItem: parsed.masteryByItem,
    parseSummary: parsed.parseSummary,
    parsedRows: parsed.parsedRows,
  };
}

export async function persistMasteryImport(parsed: ParseResult, rawText: string): Promise<void> {
  await saveSnapshot(createMasteryImportSnapshot(parsed, rawText));
}
