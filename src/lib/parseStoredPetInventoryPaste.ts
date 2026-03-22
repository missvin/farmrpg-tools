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

function trimToPetInventorySection(rawText: string): string {
  const mealMarkerMatch = rawText.match(/^\s*Consume a meal\s*$/im);

  if (!mealMarkerMatch || mealMarkerMatch.index === undefined) {
    return rawText;
  }

  return rawText.slice(0, mealMarkerMatch.index);
}

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

function parseSummaryBlock(
  lines: string[],
  startIndex: number,
): { entry: { itemName: string; storedCount: number }; nextIndex: number } | null {
  const itemName = lines[startIndex]?.trim() ?? '';
  const fromLine = lines[startIndex + 1]?.trim() ?? '';
  const inventoryLine = lines[startIndex + 2]?.trim() ?? '';
  const foundLine = lines[startIndex + 3]?.trim() ?? '';

  if (!itemName || !fromLine.startsWith('From ')) {
    return null;
  }

  if (!/^[\d,]+\s+currently in Inventory$/i.test(inventoryLine)) {
    return null;
  }

  const foundMatch = /^Found\s+([\d,]+)$/i.exec(foundLine);
  if (!foundMatch) {
    return null;
  }

  const storedCount = parseCount(foundMatch[1]);
  if (storedCount === null) {
    return null;
  }

  return {
    entry: {
      itemName,
      storedCount,
    },
    nextIndex: startIndex + 4,
  };
}

function parsePetSummaryExport(
  lines: string[],
  options: ParseStoredPetInventoryPasteOptions,
): ParseStoredPetInventoryPasteResult {
  const warnings: string[] = [];
  const entriesByCanonicalKey = new Map<string, StoredPetInventoryEntry>();

  for (let index = 0; index < lines.length; index += 1) {
    const parsedBlock = parseSummaryBlock(lines, index);

    if (!parsedBlock) {
      continue;
    }

    const canonicalItemKey = toCanonicalItemKey(parsedBlock.entry.itemName);

    if (canonicalItemKey.length === 0) {
      warnings.push(`Line ${index + 1} is missing a usable item name.`);
      index = parsedBlock.nextIndex - 1;
      continue;
    }

    if (options.knownCanonicalKeys && !options.knownCanonicalKeys.has(canonicalItemKey)) {
      warnings.push(`Line ${index + 1} item "${parsedBlock.entry.itemName}" was not found in local reference data and was kept as entered.`);
    }

    const existingEntry = entriesByCanonicalKey.get(canonicalItemKey);

    if (existingEntry) {
      existingEntry.storedCount += parsedBlock.entry.storedCount;
    } else {
      entriesByCanonicalKey.set(canonicalItemKey, {
        canonicalItemKey,
        itemName: parsedBlock.entry.itemName,
        storedCount: parsedBlock.entry.storedCount,
      });
    }

    index = parsedBlock.nextIndex - 1;
  }

  return {
    entries: Array.from(entriesByCanonicalKey.values()).sort((left, right) => {
      return left.itemName.localeCompare(right.itemName) || left.canonicalItemKey.localeCompare(right.canonicalItemKey);
    }),
    warnings,
  };
}

export function parseStoredPetInventoryPaste(
  rawText: string,
  options: ParseStoredPetInventoryPasteOptions = {},
): ParseStoredPetInventoryPasteResult {
  const lines = trimToPetInventorySection(rawText).split(/\r?\n/);

  const hasPetSummaryBlocks = lines.some((_, index) => {
    return parseSummaryBlock(lines, index) !== null;
  });

  if (hasPetSummaryBlocks) {
    return parsePetSummaryExport(lines, options);
  }

  const warnings: string[] = [];
  const entriesByCanonicalKey = new Map<string, StoredPetInventoryEntry>();

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      return;
    }

    const parsedLine = parseLine(trimmedLine);

    if (!parsedLine) {
      warnings.push(
        `Line ${lineNumber} could not be parsed. Use the Pets collected-items export format or "Item Name, Count".`,
      );
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
