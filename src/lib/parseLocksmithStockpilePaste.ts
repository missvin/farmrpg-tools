import {
  parseCurrentInventoryPaste,
  type CurrentInventoryResolvedItem,
} from './parseCurrentInventoryPaste';
import { toCanonicalItemKey } from './normalizeItemKey';

export type LocksmithStockpileEntry = {
  canonicalItemKey: string;
  itemName: string;
  ownedCount: number;
};

export type ParseLocksmithStockpilePasteOptions = {
  resolveItem?: (itemName: string) => CurrentInventoryResolvedItem;
};

export type ParseLocksmithStockpilePasteResult = {
  entries: LocksmithStockpileEntry[];
  warnings: string[];
};

const LOCKSMITH_SECTION_HEADINGS = new Set(['May Starter Pack Item', 'Favorite Items', 'Items you can open']);
const LOCKSMITH_SECTION_ENDINGS = new Set(['Consume a meal', 'Close Panel']);

function parseCount(value: string): number | null {
  const parsedValue = Number(value.trim().replace(/,/g, ''));
  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : null;
}

function parseLocksmithItemLine(line: string): { itemName: string; ownedCount: number } | null {
  const match = /^(?:heart_fill|star_fill)\s+(.+?)\s+\(([\d,]+)\)$/u.exec(line.trim());

  if (!match) {
    return null;
  }

  const ownedCount = parseCount(match[2]);

  if (ownedCount === null) {
    return null;
  }

  return {
    itemName: match[1].trim(),
    ownedCount,
  };
}

function resolveItemName(
  itemName: string,
  options: ParseLocksmithStockpilePasteOptions,
): CurrentInventoryResolvedItem {
  if (options.resolveItem) {
    return options.resolveItem(itemName);
  }

  return {
    canonicalItemKey: toCanonicalItemKey(itemName),
    itemName: itemName.trim(),
    recognized: true,
    warnings: [],
  };
}

function addLocksmithEntry(
  entriesByCanonicalKey: Map<string, LocksmithStockpileEntry>,
  warnings: string[],
  parsedEntry: { itemName: string; ownedCount: number },
  lineNumber: number,
  options: ParseLocksmithStockpilePasteOptions,
): void {
  const resolvedItem = resolveItemName(parsedEntry.itemName, options);
  const canonicalItemKey = toCanonicalItemKey(resolvedItem.canonicalItemKey || parsedEntry.itemName);

  if (canonicalItemKey.length === 0) {
    warnings.push(`Line ${lineNumber} is missing a usable openable item name.`);
    return;
  }

  if (!resolvedItem.recognized) {
    warnings.push(
      `Line ${lineNumber} item "${parsedEntry.itemName}" was not found in local reference data and was kept as entered.`,
    );
  }

  warnings.push(...resolvedItem.warnings.map((warning) => `Line ${lineNumber}: ${warning}`));

  const existingEntry = entriesByCanonicalKey.get(canonicalItemKey);

  if (existingEntry) {
    if (existingEntry.ownedCount !== parsedEntry.ownedCount) {
      existingEntry.ownedCount = Math.max(existingEntry.ownedCount, parsedEntry.ownedCount);
      warnings.push(`Line ${lineNumber} repeated "${parsedEntry.itemName}" with a different count. The larger count was kept.`);
    }

    return;
  }

  entriesByCanonicalKey.set(canonicalItemKey, {
    canonicalItemKey,
    itemName: resolvedItem.itemName.trim() || parsedEntry.itemName,
    ownedCount: parsedEntry.ownedCount,
  });
}

function parseLocksmithPageRows(
  rawText: string,
  options: ParseLocksmithStockpilePasteOptions,
): ParseLocksmithStockpilePasteResult {
  const lines = rawText.split(/\r?\n/u);
  const entriesByCanonicalKey = new Map<string, LocksmithStockpileEntry>();
  const warnings: string[] = [];
  let inLocksmithOpenableSection = false;

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();

    if (LOCKSMITH_SECTION_HEADINGS.has(trimmedLine)) {
      inLocksmithOpenableSection = true;
      return;
    }

    if (LOCKSMITH_SECTION_ENDINGS.has(trimmedLine)) {
      inLocksmithOpenableSection = false;
      return;
    }

    if (!inLocksmithOpenableSection) {
      return;
    }

    const parsedEntry = parseLocksmithItemLine(trimmedLine);

    if (!parsedEntry) {
      return;
    }

    addLocksmithEntry(entriesByCanonicalKey, warnings, parsedEntry, index + 1, options);
  });

  return {
    entries: Array.from(entriesByCanonicalKey.values()).sort((left, right) => {
      return left.itemName.localeCompare(right.itemName) || left.canonicalItemKey.localeCompare(right.canonicalItemKey);
    }),
    warnings,
  };
}

export function parseLocksmithStockpilePaste(
  rawText: string,
  options: ParseLocksmithStockpilePasteOptions = {},
): ParseLocksmithStockpilePasteResult {
  const locksmithPageRows = parseLocksmithPageRows(rawText, options);

  if (locksmithPageRows.entries.length > 0) {
    return locksmithPageRows;
  }

  const parsed = parseCurrentInventoryPaste(rawText, options);

  return {
    entries: parsed.entries.map((entry) => ({
      canonicalItemKey: entry.canonicalItemKey,
      itemName: entry.itemName,
      ownedCount: entry.inventoryCount,
    })),
    warnings: parsed.warnings,
  };
}
