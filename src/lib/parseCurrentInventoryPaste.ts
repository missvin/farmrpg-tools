import { toCanonicalItemKey } from './normalizeItemKey';

export type CurrentInventoryEntry = {
  canonicalItemKey: string;
  itemName: string;
  inventoryCount: number;
};

export type CurrentInventoryResolvedItem = {
  canonicalItemKey: string;
  itemName: string;
  recognized: boolean;
  warnings: string[];
};

export type ParseCurrentInventoryPasteOptions = {
  resolveItem?: (itemName: string) => CurrentInventoryResolvedItem;
};

export type ParseCurrentInventoryPasteResult = {
  entries: CurrentInventoryEntry[];
  warnings: string[];
};

function parseCount(value: string): number | null {
  const trimmedValue = value.trim();

  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/u.test(trimmedValue)) {
    return null;
  }

  const parsedValue = Number(trimmedValue.replace(/,/g, ''));
  return Number.isInteger(parsedValue) && parsedValue >= 0 ? parsedValue : null;
}

function isCountLine(value: string): boolean {
  return parseCount(value) !== null;
}

function resolveItemName(itemName: string, options: ParseCurrentInventoryPasteOptions): CurrentInventoryResolvedItem {
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

function parseDelimitedLine(line: string): { itemName: string; inventoryCount: number } | null {
  const tabParts = line.split('\t').map((part) => part.trim()).filter(Boolean);
  const commaParts = line.split(',').map((part) => part.trim()).filter(Boolean);
  const parts = tabParts.length === 2 ? tabParts : commaParts.length === 2 ? commaParts : null;

  if (!parts) {
    return null;
  }

  const [left, right] = parts;
  const leftCount = parseCount(left);
  const rightCount = parseCount(right);

  if (leftCount !== null && rightCount === null) {
    return {
      itemName: right,
      inventoryCount: leftCount,
    };
  }

  if (rightCount !== null && leftCount === null) {
    return {
      itemName: left,
      inventoryCount: rightCount,
    };
  }

  return null;
}

function parseCompactLine(line: string): { itemName: string; inventoryCount: number } | null {
  const countFirstMatch = /^([\d,]+)\s+(.+)$/u.exec(line);

  if (countFirstMatch) {
    const inventoryCount = parseCount(countFirstMatch[1]);

    if (inventoryCount !== null) {
      return {
        itemName: countFirstMatch[2].trim(),
        inventoryCount,
      };
    }
  }

  const countLastMatch = /^(.+?)\s+(?:x)?([\d,]+)$/iu.exec(line);

  if (countLastMatch) {
    const inventoryCount = parseCount(countLastMatch[2]);

    if (inventoryCount !== null) {
      return {
        itemName: countLastMatch[1].trim(),
        inventoryCount,
      };
    }
  }

  return null;
}

function isInventoryCategoryLine(line: string): boolean {
  return /^(?:Meals|Items|Seeds|Loot & Treasure|Runestones|Books|Cards|Super Rares)\s+chevron_down$/iu.test(line);
}

function isInventoryStopLine(line: string): boolean {
  return /^(?:Inventory Stats|Consume a meal|Close Panel)$/iu.test(line);
}

function addEntry(
  entriesByCanonicalKey: Map<string, CurrentInventoryEntry>,
  warnings: string[],
  parsedEntry: { itemName: string; inventoryCount: number },
  lineNumber: number,
  options: ParseCurrentInventoryPasteOptions,
): void {
  const resolvedItem = resolveItemName(parsedEntry.itemName, options);
  const canonicalItemKey = toCanonicalItemKey(resolvedItem.canonicalItemKey || parsedEntry.itemName);

  if (canonicalItemKey.length === 0) {
    warnings.push(`Line ${lineNumber} is missing a usable item name.`);
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
    existingEntry.inventoryCount += parsedEntry.inventoryCount;
    warnings.push(`Line ${lineNumber} duplicated "${parsedEntry.itemName}". Counts were combined.`);
    return;
  }

  entriesByCanonicalKey.set(canonicalItemKey, {
    canonicalItemKey,
    itemName: resolvedItem.itemName.trim() || parsedEntry.itemName,
    inventoryCount: parsedEntry.inventoryCount,
  });
}

export function parseCurrentInventoryPaste(
  rawText: string,
  options: ParseCurrentInventoryPasteOptions = {},
): ParseCurrentInventoryPasteResult {
  const lines = rawText.split(/\r?\n/);
  const warnings: string[] = [];
  const entriesByCanonicalKey = new Map<string, CurrentInventoryEntry>();

  if (lines.some((line) => isInventoryCategoryLine(line.trim()))) {
    let insideInventory = false;
    let pendingItem: { itemName: string; lineNumber: number } | null = null;

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();

      if (!trimmedLine) {
        return;
      }

      if (isInventoryCategoryLine(trimmedLine)) {
        insideInventory = true;
        pendingItem = null;
        return;
      }

      if (!insideInventory) {
        return;
      }

      if (isInventoryStopLine(trimmedLine)) {
        insideInventory = false;
        pendingItem = null;
        return;
      }

      const inventoryCount = parseCount(trimmedLine);

      if (inventoryCount !== null) {
        if (pendingItem) {
          addEntry(
            entriesByCanonicalKey,
            warnings,
            { itemName: pendingItem.itemName, inventoryCount },
            pendingItem.lineNumber,
            options,
          );
          pendingItem = null;
        }

        return;
      }

      if (!pendingItem) {
        pendingItem = {
          itemName: trimmedLine,
          lineNumber: index + 1,
        };
      }
    });

    return {
      entries: Array.from(entriesByCanonicalKey.values()).sort((left, right) => {
        return left.itemName.localeCompare(right.itemName) || left.canonicalItemKey.localeCompare(right.canonicalItemKey);
      }),
      warnings,
    };
  }

  const consumedLineIndexes = new Set<number>();
  let alternatingPairCount = 0;

  for (let index = 0; index < lines.length - 1; index += 1) {
    const countLine = lines[index].trim();
    const itemLine = lines[index + 1].trim();
    const inventoryCount = parseCount(countLine);

    if (inventoryCount === null || itemLine.length === 0 || isCountLine(itemLine)) {
      continue;
    }

    addEntry(entriesByCanonicalKey, warnings, { itemName: itemLine, inventoryCount }, index + 1, options);
    consumedLineIndexes.add(index);
    consumedLineIndexes.add(index + 1);
    alternatingPairCount += 1;
    index += 1;
  }

  lines.forEach((line, index) => {
    if (consumedLineIndexes.has(index)) {
      return;
    }

    const trimmedLine = line.trim();

    if (!trimmedLine) {
      return;
    }

    const parsedLine = parseDelimitedLine(trimmedLine) ?? (alternatingPairCount === 0 ? parseCompactLine(trimmedLine) : null);

    if (!parsedLine) {
      if (alternatingPairCount === 0) {
        warnings.push(`Line ${index + 1} could not be parsed. Use "Item Name, Count" or paste alternating count/item lines.`);
      }

      return;
    }

    addEntry(entriesByCanonicalKey, warnings, parsedLine, index + 1, options);
  });

  return {
    entries: Array.from(entriesByCanonicalKey.values()).sort((left, right) => {
      return left.itemName.localeCompare(right.itemName) || left.canonicalItemKey.localeCompare(right.canonicalItemKey);
    }),
    warnings,
  };
}
