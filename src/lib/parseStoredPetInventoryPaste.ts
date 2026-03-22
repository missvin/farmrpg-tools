import { toCanonicalItemKey } from './normalizeItemKey';

export type StoredPetInventoryEntry = {
  canonicalItemKey: string;
  itemName: string;
  storedCount: number;
};

export type ParseStoredPetInventoryPasteOptions = {
  knownCanonicalKeys?: Set<string>;
};

export type ParseStoredPetInventoryPasteResult = {
  entries: StoredPetInventoryEntry[];
  warnings: string[];
};

function parseCount(value: string): number | null {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const parsedValue = Number(trimmedValue.replace(/,/g, ''));
  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : null;
}

function parseLine(line: string): { itemName: string; storedCount: number } | null {
  const trimmedLine = line.trim();

  if (!trimmedLine) {
    return null;
  }

  const tabParts = trimmedLine.split('\t').map((part) => part.trim()).filter(Boolean);
  const commaParts = trimmedLine.split(',').map((part) => part.trim()).filter(Boolean);
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
      storedCount: leftCount,
    };
  }

  if (rightCount !== null && leftCount === null) {
    return {
      itemName: left,
      storedCount: rightCount,
    };
  }

  return null;
}

export function parseStoredPetInventoryPaste(
  rawText: string,
  options: ParseStoredPetInventoryPasteOptions = {},
): ParseStoredPetInventoryPasteResult {
  const warnings: string[] = [];
  const entriesByCanonicalKey = new Map<string, StoredPetInventoryEntry>();
  const lines = rawText.split(/\r?\n/);

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      return;
    }

    const parsedLine = parseLine(trimmedLine);

    if (!parsedLine) {
      warnings.push(`Line ${lineNumber} could not be parsed. Use "Item Name, Count" or "Count, Item Name".`);
      return;
    }

    const canonicalItemKey = toCanonicalItemKey(parsedLine.itemName);

    if (canonicalItemKey.length === 0) {
      warnings.push(`Line ${lineNumber} is missing a usable item name.`);
      return;
    }

    if (options.knownCanonicalKeys && !options.knownCanonicalKeys.has(canonicalItemKey)) {
      warnings.push(`Line ${lineNumber} item "${parsedLine.itemName}" was not found in local reference data and was kept as entered.`);
    }

    const existingEntry = entriesByCanonicalKey.get(canonicalItemKey);

    if (existingEntry) {
      existingEntry.storedCount += parsedLine.storedCount;
      warnings.push(`Line ${lineNumber} duplicated "${parsedLine.itemName}". Counts were combined.`);
      return;
    }

    entriesByCanonicalKey.set(canonicalItemKey, {
      canonicalItemKey,
      itemName: parsedLine.itemName,
      storedCount: parsedLine.storedCount,
    });
  });

  return {
    entries: Array.from(entriesByCanonicalKey.values()).sort((left, right) => {
      return left.itemName.localeCompare(right.itemName) || left.canonicalItemKey.localeCompare(right.canonicalItemKey);
    }),
    warnings,
  };
}
