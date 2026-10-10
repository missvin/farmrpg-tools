import { toCanonicalItemKey } from './normalizeItemKey';
import type { LocalItemReferenceLookup } from './localItemReferenceLookup';
import type { ParseCurrentInventoryPasteResult } from './parseCurrentInventoryPaste';
import type { ParseResult, ParsedRow } from './parseMasteryPaste';
import { inventoryImportResolver } from './playerDataImports';

export type CaptureReceipt = {
  captureId: string;
  section: 'inventory' | 'mastery';
  observedAt: string;
};

export type CaptureImportContext = {
  now: string;
  /** Supplied by the reviewed page adapter, never taken from the incoming payload. */
  requiredSections: readonly string[];
  previous?: CaptureReceipt;
  lookup: LocalItemReferenceLookup | null;
};

export type PreparedCaptureImport =
  | { ok: false; reason: string }
  | { ok: true; receipt: CaptureReceipt; section: 'inventory'; parsed: ParseCurrentInventoryPasteResult }
  | { ok: true; receipt: CaptureReceipt; section: 'mastery'; parsed: ParseResult };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isIsoTime(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

/**
 * Pure validation/preparation only: no listener, writes, or success acknowledgment.
 * The future receiver must authenticate its sender before calling this adapter.
 * Complete-page evidence must originate in the reviewed active-page extractor.
 */
export function prepareCaptureImport(payload: unknown, context: CaptureImportContext): PreparedCaptureImport {
  const reject = (reason: string): PreparedCaptureImport => ({ ok: false, reason });
  try {
    const encoded = JSON.stringify(payload);
    if (!encoded || new TextEncoder().encode(encoded).length > 5_000_000) {
      return reject('Capture is empty or exceeds the size limit.');
    }
  } catch {
    return reject('Capture is not serializable.');
  }
  if (!isRecord(payload) || payload.schemaVersion !== 1) {
    return reject('Unsupported capture schema.');
  }
  if (payload.section !== 'inventory' && payload.section !== 'mastery') {
    return reject('Unsupported capture section.');
  }
  if (payload.scope !== 'full') {
    return reject('Partial observations cannot replace a full dataset.');
  }
  if (typeof payload.captureId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(payload.captureId)) {
    return reject('Invalid capture identity.');
  }
  if (!isIsoTime(payload.observedAt) || !isIsoTime(context.now) || payload.observedAt > context.now) {
    return reject('Invalid or future observation time.');
  }
  let source: URL;
  try {
    source = new URL(typeof payload.sourceUrl === 'string' ? payload.sourceUrl : '');
  } catch {
    return reject('Invalid game page URL.');
  }
  if (
    source.protocol !== 'https:' || !['farmrpg.com', 'www.farmrpg.com'].includes(source.hostname) ||
    source.port || source.username || source.password
  ) {
    return reject('Capture source must be a supported FarmRPG origin.');
  }
  if (context.previous?.section === payload.section) {
    if (context.previous.captureId === payload.captureId) {
      return reject('Duplicate capture; previous data retained.');
    }
    if (payload.observedAt <= context.previous.observedAt) {
      return reject('Older or simultaneous capture; previous data retained.');
    }
  }
  const coverage = payload.coverage;
  if (!isRecord(coverage) || coverage.activePage !== true || coverage.settled !== true || !Array.isArray(coverage.sections)) {
    return reject('Current settled-page coverage is required.');
  }
  const required = new Set(context.requiredSections);
  if (required.size === 0 || required.size !== context.requiredSections.length) {
    return reject('Reviewed required sections are unavailable.');
  }
  const sectionCounts = new Map<string, number>();
  for (const section of coverage.sections) {
    if (
      !isRecord(section) || typeof section.id !== 'string' || !required.has(section.id) ||
      section.loaded !== true || !isCount(section.expectedRows) || sectionCounts.has(section.id)
    ) {
      return reject('Invalid or duplicate section coverage.');
    }
    sectionCounts.set(section.id, section.expectedRows);
  }
  if (sectionCounts.size !== required.size || !Array.isArray(payload.rows) || payload.rows.length === 0) {
    return reject('Capture is empty or missing required sections.');
  }

  const inventory: ParseCurrentInventoryPasteResult = { entries: [], warnings: [] };
  const masteryRows: ParsedRow[] = [];
  const seen = new Set<string>();
  const observedCounts = new Map<string, number>();
  const resolve = inventoryImportResolver(context.lookup);
  let unknownItemsCount = 0;
  for (const [index, row] of payload.rows.entries()) {
    if (
      !isRecord(row) || typeof row.itemName !== 'string' || !row.itemName.trim() || row.itemName.length > 256 ||
      typeof row.sectionId !== 'string' || !required.has(row.sectionId) || !isCount(row.count)
    ) {
      return reject('Invalid item identity, section or quantity.');
    }
    const resolved = resolve?.(row.itemName);
    const key = resolved?.canonicalItemKey ?? toCanonicalItemKey(row.itemName);
    if (!key || ['__proto__', 'constructor', 'prototype'].includes(key) || seen.has(key)) {
      return reject('Invalid or duplicate canonical item identity.');
    }
    seen.add(key);
    observedCounts.set(row.sectionId, (observedCounts.get(row.sectionId) ?? 0) + 1);
    if (resolved && !resolved.recognized) {
      unknownItemsCount += 1;
      inventory.warnings.push(`Line ${index + 1} item "${row.itemName}" was not found in local reference data and was kept as entered.`);
      inventory.warnings.push(...resolved.warnings.map((warning) => `Line ${index + 1}: ${warning}`));
    }
    if (payload.section === 'inventory') {
      inventory.entries.push({
        canonicalItemKey: key,
        itemName: resolved?.itemName ?? row.itemName.trim(),
        inventoryCount: row.count,
      });
    } else {
      const tier = row.targetTier;
      if (
        !(tier === 'INF' || (typeof tier === 'number' && [10, 1000, 10000, 100000, 1000000].includes(tier))) ||
        String(tier) !== row.sectionId
      ) {
        return reject('Invalid mastery tier or tier-section relationship.');
      }
      masteryRows.push({ rawItemName: row.itemName.trim(), canonicalKey: key, count: row.count, targetTier: tier, sourceLineIndex: index });
    }
  }
  for (const [id, expected] of sectionCounts) {
    if ((observedCounts.get(id) ?? 0) !== expected) {
      return reject(`Incomplete row coverage for section ${id}.`);
    }
  }
  const receipt: CaptureReceipt = { captureId: payload.captureId, section: payload.section, observedAt: payload.observedAt };
  if (payload.section === 'inventory') {
    inventory.entries.sort((a, b) => a.itemName.localeCompare(b.itemName) || a.canonicalItemKey.localeCompare(b.canonicalItemKey));
    return { ok: true, section: 'inventory', receipt, parsed: inventory };
  }
  const tiers = [...new Set(masteryRows.map((row) => row.targetTier))]
    .sort((a, b) => a === 'INF' ? 1 : b === 'INF' ? -1 : a - b);
  return {
    ok: true,
    section: 'mastery',
    receipt,
    parsed: {
      masteryByItem: Object.fromEntries(masteryRows.map((row) => [row.canonicalKey, row.count])),
      parsedRows: masteryRows,
      parseSummary: {
        itemsParsed: masteryRows.length,
        parsedRowsCount: masteryRows.length,
        tiersDetected: tiers,
        duplicateRowsCount: 0,
        skippedNonItemLinesCount: 0,
        skippedNonItemLineSamples: [],
        unknownItemsCount,
        warnings: inventory.warnings,
      },
    },
  };
}
