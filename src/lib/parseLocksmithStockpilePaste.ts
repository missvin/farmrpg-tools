import {
  parseCurrentInventoryPaste,
  type CurrentInventoryResolvedItem,
} from './parseCurrentInventoryPaste';

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

export function parseLocksmithStockpilePaste(
  rawText: string,
  options: ParseLocksmithStockpilePasteOptions = {},
): ParseLocksmithStockpilePasteResult {
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
