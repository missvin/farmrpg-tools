import { toCanonicalItemKey } from './normalizeItemKey';

export type BuildingProductionInput = {
  itemName: string;
  canonicalKey: string;
  quantity: number;
};

export type BuildingProductionProcess = {
  productionKey: string;
  buildingName: string;
  outputItemName: string;
  outputCanonicalKey: string;
  outputQuantity: number;
  processingMinutes: number;
  perkGroup: string;
  evidence: string;
  notes: string[];
  inputs: BuildingProductionInput[];
};

export type BuildingProductConversion = {
  conversionKey: string;
  buildingOutputItemName: string;
  buildingOutputCanonicalKey: string;
  finalItemName: string;
  finalCanonicalKey: string;
  buildingOutputQuantity: number;
  finalOutputQuantity: number;
  secondaryInputs: BuildingProductionInput[];
  evidence: string;
  notes: string[];
};

export type BuildingProductionReferenceData = {
  productions: BuildingProductionProcess[];
  conversions: BuildingProductConversion[];
  byOutputCanonicalKey: Record<string, BuildingProductionProcess[]>;
  conversionsByFinalCanonicalKey: Record<string, BuildingProductConversion[]>;
};

export const BUILDING_PRODUCTION_REFERENCE_COLUMNS = [
  'production_key',
  'building_name',
  'output_item_name',
  'output_canonical_key',
  'input_item_name',
  'input_canonical_key',
  'input_quantity',
  'output_quantity',
  'processing_minutes',
  'perk_group',
  'evidence',
  'notes',
] as const;

export const BUILDING_PRODUCT_CONVERSION_COLUMNS = [
  'conversion_key',
  'building_output_item_name',
  'building_output_canonical_key',
  'final_item_name',
  'final_canonical_key',
  'building_output_quantity',
  'final_output_quantity',
  'secondary_input_item_name',
  'secondary_input_canonical_key',
  'secondary_input_quantity',
  'evidence',
  'notes',
] as const;

function parseCsvRow(line: string): string[] {
  const values: string[] = [];
  let currentValue = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        currentValue += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }

      continue;
    }

    if (character === ',' && !inQuotes) {
      values.push(currentValue);
      currentValue = '';
      continue;
    }

    currentValue += character;
  }

  values.push(currentValue);
  return values;
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase();
}

function validateHeaders(headers: string[], expectedColumns: readonly string[], label: string): void {
  const missingColumns = expectedColumns.filter((column) => !headers.includes(column));
  const unexpectedColumns = headers.filter((header) => !expectedColumns.includes(header));

  if (missingColumns.length === 0 && unexpectedColumns.length === 0) {
    return;
  }

  const details: string[] = [];

  if (missingColumns.length > 0) {
    details.push(`missing columns: ${missingColumns.join(', ')}`);
  }

  if (unexpectedColumns.length > 0) {
    details.push(`unexpected columns: ${unexpectedColumns.join(', ')}`);
  }

  throw new Error(`Invalid ${label} schema (${details.join('; ')}).`);
}

function readField(values: string[], headerIndex: Record<string, number>, fieldName: string): string {
  const index = headerIndex[fieldName];
  return index === undefined ? '' : values[index] ?? '';
}

function parseRequiredText(value: string, fieldName: string, label: string): string {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    throw new Error(`Missing required ${fieldName} for ${label}.`);
  }

  return trimmedValue;
}

function parsePositiveNumber(value: string, fieldName: string, label: string): number {
  const parsedValue = Number(value.trim());

  if (Number.isFinite(parsedValue) && parsedValue > 0) {
    return parsedValue;
  }

  throw new Error(`Invalid ${fieldName} "${value}" for ${label}.`);
}

function parseList(value: string): string[] {
  return value
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function validateCanonicalNameMatch(itemName: string, canonicalKey: string, label: string): void {
  const expectedCanonicalKey = toCanonicalItemKey(itemName);

  if (expectedCanonicalKey !== canonicalKey) {
    throw new Error(
      `Canonical key mismatch for ${label}: expected "${expectedCanonicalKey}" from "${itemName}" but found "${canonicalKey}".`,
    );
  }
}

function parseCsvLines(csvText: string, expectedColumns: readonly string[], label: string): {
  lines: string[];
  headerIndex: Record<string, number>;
} {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { lines: [], headerIndex: {} };
  }

  const headers = parseCsvRow(lines[0]).map(normalizeHeader);
  validateHeaders(headers, expectedColumns, label);

  return {
    lines: lines.slice(1),
    headerIndex: headers.reduce<Record<string, number>>((indexByHeader, header, index) => {
      indexByHeader[header] = index;
      return indexByHeader;
    }, {}),
  };
}

export function parseBuildingProductionReferenceCsv(csvText: string): BuildingProductionProcess[] {
  const { lines, headerIndex } = parseCsvLines(
    csvText,
    BUILDING_PRODUCTION_REFERENCE_COLUMNS,
    'building_production_reference.csv',
  );
  const grouped = new Map<string, BuildingProductionProcess>();

  for (const line of lines) {
    const values = parseCsvRow(line);
    const productionKey = parseRequiredText(readField(values, headerIndex, 'production_key'), 'production_key', 'building production row');
    const buildingName = parseRequiredText(
      readField(values, headerIndex, 'building_name'),
      'building_name',
      `building production "${productionKey}"`,
    );
    const outputItemName = parseRequiredText(
      readField(values, headerIndex, 'output_item_name'),
      'output_item_name',
      `building production "${productionKey}"`,
    );
    const outputCanonicalKey = parseRequiredText(
      readField(values, headerIndex, 'output_canonical_key'),
      'output_canonical_key',
      `building production "${productionKey}"`,
    );
    const inputItemName = parseRequiredText(
      readField(values, headerIndex, 'input_item_name'),
      'input_item_name',
      `building production "${productionKey}"`,
    );
    const inputCanonicalKey = parseRequiredText(
      readField(values, headerIndex, 'input_canonical_key'),
      'input_canonical_key',
      `building production "${productionKey}"`,
    );
    const rowLabel = `building production "${productionKey}"`;

    validateCanonicalNameMatch(outputItemName, outputCanonicalKey, `building output "${outputItemName}"`);
    validateCanonicalNameMatch(inputItemName, inputCanonicalKey, `building input "${inputItemName}"`);

    const outputQuantity = parsePositiveNumber(readField(values, headerIndex, 'output_quantity'), 'output_quantity', rowLabel);
    const processingMinutes = parsePositiveNumber(
      readField(values, headerIndex, 'processing_minutes'),
      'processing_minutes',
      rowLabel,
    );
    const perkGroup = parseRequiredText(readField(values, headerIndex, 'perk_group'), 'perk_group', rowLabel);
    const evidence = parseRequiredText(readField(values, headerIndex, 'evidence'), 'evidence', rowLabel);
    const notes = parseList(readField(values, headerIndex, 'notes'));
    const existingProcess = grouped.get(productionKey);

    if (existingProcess) {
      if (
        existingProcess.buildingName !== buildingName ||
        existingProcess.outputCanonicalKey !== outputCanonicalKey ||
        existingProcess.outputQuantity !== outputQuantity ||
        existingProcess.processingMinutes !== processingMinutes ||
        existingProcess.perkGroup !== perkGroup
      ) {
        throw new Error(`Inconsistent duplicate production metadata for "${productionKey}".`);
      }

      existingProcess.inputs.push({
        itemName: inputItemName,
        canonicalKey: inputCanonicalKey,
        quantity: parsePositiveNumber(readField(values, headerIndex, 'input_quantity'), 'input_quantity', rowLabel),
      });
      continue;
    }

    grouped.set(productionKey, {
      productionKey,
      buildingName,
      outputItemName,
      outputCanonicalKey,
      outputQuantity,
      processingMinutes,
      perkGroup,
      evidence,
      notes,
      inputs: [
        {
          itemName: inputItemName,
          canonicalKey: inputCanonicalKey,
          quantity: parsePositiveNumber(readField(values, headerIndex, 'input_quantity'), 'input_quantity', rowLabel),
        },
      ],
    });
  }

  return Array.from(grouped.values()).sort((left, right) => {
    return left.buildingName.localeCompare(right.buildingName) || left.outputItemName.localeCompare(right.outputItemName);
  });
}

export function parseBuildingProductConversionsCsv(csvText: string): BuildingProductConversion[] {
  const { lines, headerIndex } = parseCsvLines(
    csvText,
    BUILDING_PRODUCT_CONVERSION_COLUMNS,
    'building_product_conversions.csv',
  );
  const grouped = new Map<string, BuildingProductConversion>();

  for (const line of lines) {
    const values = parseCsvRow(line);
    const conversionKey = parseRequiredText(readField(values, headerIndex, 'conversion_key'), 'conversion_key', 'building conversion row');
    const buildingOutputItemName = parseRequiredText(
      readField(values, headerIndex, 'building_output_item_name'),
      'building_output_item_name',
      `building conversion "${conversionKey}"`,
    );
    const buildingOutputCanonicalKey = parseRequiredText(
      readField(values, headerIndex, 'building_output_canonical_key'),
      'building_output_canonical_key',
      `building conversion "${conversionKey}"`,
    );
    const finalItemName = parseRequiredText(readField(values, headerIndex, 'final_item_name'), 'final_item_name', `building conversion "${conversionKey}"`);
    const finalCanonicalKey = parseRequiredText(
      readField(values, headerIndex, 'final_canonical_key'),
      'final_canonical_key',
      `building conversion "${conversionKey}"`,
    );
    const secondaryInputItemName = parseRequiredText(
      readField(values, headerIndex, 'secondary_input_item_name'),
      'secondary_input_item_name',
      `building conversion "${conversionKey}"`,
    );
    const secondaryInputCanonicalKey = parseRequiredText(
      readField(values, headerIndex, 'secondary_input_canonical_key'),
      'secondary_input_canonical_key',
      `building conversion "${conversionKey}"`,
    );
    const rowLabel = `building conversion "${conversionKey}"`;

    validateCanonicalNameMatch(
      buildingOutputItemName,
      buildingOutputCanonicalKey,
      `building conversion output "${buildingOutputItemName}"`,
    );
    validateCanonicalNameMatch(finalItemName, finalCanonicalKey, `building conversion final item "${finalItemName}"`);
    validateCanonicalNameMatch(
      secondaryInputItemName,
      secondaryInputCanonicalKey,
      `building conversion secondary input "${secondaryInputItemName}"`,
    );

    const buildingOutputQuantity = parsePositiveNumber(
      readField(values, headerIndex, 'building_output_quantity'),
      'building_output_quantity',
      rowLabel,
    );
    const finalOutputQuantity = parsePositiveNumber(
      readField(values, headerIndex, 'final_output_quantity'),
      'final_output_quantity',
      rowLabel,
    );
    const evidence = parseRequiredText(readField(values, headerIndex, 'evidence'), 'evidence', rowLabel);
    const notes = parseList(readField(values, headerIndex, 'notes'));
    const existingConversion = grouped.get(conversionKey);

    if (existingConversion) {
      if (
        existingConversion.buildingOutputCanonicalKey !== buildingOutputCanonicalKey ||
        existingConversion.finalCanonicalKey !== finalCanonicalKey ||
        existingConversion.buildingOutputQuantity !== buildingOutputQuantity ||
        existingConversion.finalOutputQuantity !== finalOutputQuantity
      ) {
        throw new Error(`Inconsistent duplicate conversion metadata for "${conversionKey}".`);
      }

      existingConversion.secondaryInputs.push({
        itemName: secondaryInputItemName,
        canonicalKey: secondaryInputCanonicalKey,
        quantity: parsePositiveNumber(
          readField(values, headerIndex, 'secondary_input_quantity'),
          'secondary_input_quantity',
          rowLabel,
        ),
      });
      continue;
    }

    grouped.set(conversionKey, {
      conversionKey,
      buildingOutputItemName,
      buildingOutputCanonicalKey,
      finalItemName,
      finalCanonicalKey,
      buildingOutputQuantity,
      finalOutputQuantity,
      secondaryInputs: [
        {
          itemName: secondaryInputItemName,
          canonicalKey: secondaryInputCanonicalKey,
          quantity: parsePositiveNumber(
            readField(values, headerIndex, 'secondary_input_quantity'),
            'secondary_input_quantity',
            rowLabel,
          ),
        },
      ],
      evidence,
      notes,
    });
  }

  return Array.from(grouped.values()).sort((left, right) => {
    return left.finalItemName.localeCompare(right.finalItemName);
  });
}

export function buildBuildingProductionReferenceData(input: {
  productions: BuildingProductionProcess[];
  conversions: BuildingProductConversion[];
}): BuildingProductionReferenceData {
  const byOutputCanonicalKey: Record<string, BuildingProductionProcess[]> = {};
  const conversionsByFinalCanonicalKey: Record<string, BuildingProductConversion[]> = {};

  for (const production of input.productions) {
    byOutputCanonicalKey[production.outputCanonicalKey] = [
      ...(byOutputCanonicalKey[production.outputCanonicalKey] ?? []),
      production,
    ];
  }

  for (const conversion of input.conversions) {
    conversionsByFinalCanonicalKey[conversion.finalCanonicalKey] = [
      ...(conversionsByFinalCanonicalKey[conversion.finalCanonicalKey] ?? []),
      conversion,
    ];
  }

  return {
    productions: input.productions,
    conversions: input.conversions,
    byOutputCanonicalKey,
    conversionsByFinalCanonicalKey,
  };
}

export async function loadBuildingProductionReference(): Promise<BuildingProductionReferenceData> {
  const [productionResponse, conversionResponse] = await Promise.all([
    fetch('/data/building_production_reference.csv'),
    fetch('/data/building_product_conversions.csv'),
  ]);

  if (!productionResponse.ok) {
    throw new Error('Unable to load local building production reference data.');
  }

  if (!conversionResponse.ok) {
    throw new Error('Unable to load local building product conversion data.');
  }

  const [productionCsvText, conversionCsvText] = await Promise.all([
    productionResponse.text(),
    conversionResponse.text(),
  ]);

  return buildBuildingProductionReferenceData({
    productions: parseBuildingProductionReferenceCsv(productionCsvText),
    conversions: parseBuildingProductConversionsCsv(conversionCsvText),
  });
}
