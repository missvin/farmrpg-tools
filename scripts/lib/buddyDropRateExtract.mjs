export const DROP_RATE_EXTRACTION_STATUSES = ['extracted', 'no_drop_rates', 'uncertain'];

const TARGET_COLUMNS = ['target_type', 'target_name', 'buddy_url', 'notes'];

function parseCsvRow(line) {
  const values = [];
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

function escapeCsvValue(value) {
  const stringValue = value === null || value === undefined ? '' : String(value);

  if (/[",\n]/u.test(stringValue)) {
    return `"${stringValue.replace(/"/gu, '""')}"`;
  }

  return stringValue;
}

function normalizeHeader(header) {
  return header.trim().toLowerCase();
}

function readField(values, headerIndex, fieldName) {
  const index = headerIndex[fieldName];
  return index === undefined ? '' : values[index] ?? '';
}

function splitReviewField(value) {
  return value
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function validateHeaders(headers, expectedColumns, label) {
  const missingColumns = expectedColumns.filter((column) => !headers.includes(column));
  const unexpectedColumns = headers.filter((header) => !expectedColumns.includes(header));

  if (missingColumns.length === 0 && unexpectedColumns.length === 0) {
    return;
  }

  const details = [];

  if (missingColumns.length > 0) {
    details.push(`missing columns: ${missingColumns.join(', ')}`);
  }

  if (unexpectedColumns.length > 0) {
    details.push(`unexpected columns: ${unexpectedColumns.join(', ')}`);
  }

  throw new Error(`Invalid ${label} schema (${details.join('; ')}).`);
}

function normalizeBoolean(value) {
  if (value === true) {
    return true;
  }

  if (value === false) {
    return false;
  }

  return null;
}

function asNullableString(value) {
  return value === null || value === undefined ? null : String(value);
}

function asNullableNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeBuddyUrl(value) {
  try {
    return new URL(value, 'https://buddy.farm').href;
  } catch {
    return value;
  }
}

function inferTargetType(buddyUrl) {
  try {
    const pathname = new URL(buddyUrl).pathname;

    if (pathname.startsWith('/i/')) {
      return 'item';
    }

    if (pathname.startsWith('/l/')) {
      return 'location';
    }
  } catch {
    return 'unknown';
  }

  return 'unknown';
}

export function getBuddyPageDataUrl(buddyUrl) {
  const parsedUrl = new URL(buddyUrl);

  if (parsedUrl.hostname !== 'buddy.farm') {
    throw new Error(`Expected a buddy.farm URL but received ${buddyUrl}.`);
  }

  const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
  const [pageType, slug] = pathParts;

  if (!['i', 'l'].includes(pageType) || !slug || pathParts.length !== 2) {
    throw new Error(`Expected a buddy item or location URL shaped like /i/<slug>/ or /l/<slug>/ but received ${buddyUrl}.`);
  }

  return `https://buddy.farm/page-data/${pageType}/${slug}/page-data.json`;
}

export function parseBuddyDropRateTargetCsv(csvText) {
  const lines = csvText
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvRow(lines[0]).map(normalizeHeader);
  validateHeaders(headers, TARGET_COLUMNS, 'buddy drop-rate target CSV');

  const headerIndex = headers.reduce((indexByHeader, header, index) => {
    indexByHeader[header] = index;
    return indexByHeader;
  }, {});

  return lines.slice(1).map((line) => {
    const values = parseCsvRow(line);
    const buddyUrl = normalizeBuddyUrl(readField(values, headerIndex, 'buddy_url').trim());
    const targetType = readField(values, headerIndex, 'target_type').trim() || inferTargetType(buddyUrl);

    return {
      targetType,
      targetName: readField(values, headerIndex, 'target_name').trim(),
      buddyUrl,
      notes: splitReviewField(readField(values, headerIndex, 'notes')),
    };
  });
}

function createDropRateRow(target, pageDataUrl, pageName, row) {
  return {
    sourcePageType: target.targetType,
    sourcePageName: pageName,
    sourcePageUrl: target.buddyUrl,
    pageDataUrl,
    rowKind: row.rowKind,
    targetItemName: row.targetItemName,
    targetItemId: asNullableString(row.targetItemId),
    targetItemImage: asNullableString(row.targetItemImage),
    sourceName: row.sourceName,
    sourceType: row.sourceType,
    sourceKind: row.sourceKind,
    sourceImage: asNullableString(row.sourceImage),
    rawRate: asNullableNumber(row.rawRate),
    baseDropRate: asNullableNumber(row.baseDropRate),
    ironDepot: normalizeBoolean(row.ironDepot),
    manualFishing: normalizeBoolean(row.manualFishing),
    runecube: normalizeBoolean(row.runecube),
    flags: [...(row.flags ?? [])],
    notes: [...target.notes, ...(row.notes ?? [])],
  };
}

function extractItemRows(target, pageDataUrl, item) {
  const rows = [];

  for (const rateRow of item.dropRatesItems ?? []) {
    const sourceLocation = rateRow.dropRates?.location ?? null;
    const sourceSeed = rateRow.dropRates?.seed ?? null;
    const flags = [];
    const notes = [];

    if (!sourceLocation && !sourceSeed) {
      rows.push(
        createDropRateRow(target, pageDataUrl, item.name, {
          rowKind: 'item_source',
          targetItemName: item.name,
          targetItemId: item.id,
          targetItemImage: item.image,
          sourceName: '',
          sourceType: '',
          sourceKind: '',
          sourceImage: null,
          rawRate: rateRow.rate,
          baseDropRate: null,
          ironDepot: rateRow.dropRates?.ironDepot,
          manualFishing: rateRow.dropRates?.manualFishing,
          runecube: rateRow.dropRates?.runecube,
          flags: ['missing_source'],
          notes: ['Drop-rate item row did not include a location or seed source.'],
        }),
      );
      continue;
    }

    if (sourceLocation && sourceSeed) {
      flags.push('multiple_source_shapes');
      notes.push('Drop-rate item row included both location and seed source data.');
    }

    const source = sourceLocation ?? sourceSeed;

    rows.push(
      createDropRateRow(target, pageDataUrl, item.name, {
        rowKind: 'item_source',
        targetItemName: item.name,
        targetItemId: item.id,
        targetItemImage: item.image,
        sourceName: source.name,
        sourceType: sourceLocation?.type ?? 'farming',
        sourceKind: sourceLocation ? 'location' : 'seed',
        sourceImage: source.image,
        rawRate: rateRow.rate,
        baseDropRate: sourceLocation?.baseDropRate ?? null,
        ironDepot: rateRow.dropRates?.ironDepot,
        manualFishing: rateRow.dropRates?.manualFishing,
        runecube: rateRow.dropRates?.runecube,
        flags,
        notes,
      }),
    );
  }

  for (const seedDropGroup of item.dropRates ?? []) {
    for (const itemRate of seedDropGroup.items ?? []) {
      rows.push(
        createDropRateRow(target, pageDataUrl, item.name, {
          rowKind: 'seed_output',
          targetItemName: itemRate.item?.name ?? '',
          targetItemId: itemRate.item?.id,
          targetItemImage: itemRate.item?.image,
          sourceName: item.name,
          sourceType: 'farming',
          sourceKind: 'seed',
          sourceImage: item.image,
          rawRate: itemRate.rate,
          baseDropRate: 1,
          ironDepot: null,
          manualFishing: null,
          runecube: seedDropGroup.runecube,
          flags: [],
          notes: [],
        }),
      );
    }
  }

  return rows;
}

function extractLocationRows(target, pageDataUrl, location) {
  const rows = [];

  for (const dropRateGroup of location.dropRates ?? []) {
    for (const itemRate of dropRateGroup.items ?? []) {
      rows.push(
        createDropRateRow(target, pageDataUrl, location.name, {
          rowKind: 'location_item',
          targetItemName: itemRate.item?.name ?? '',
          targetItemId: itemRate.item?.id,
          targetItemImage: itemRate.item?.image,
          sourceName: location.name,
          sourceType: location.type,
          sourceKind: 'location',
          sourceImage: location.image,
          rawRate: itemRate.rate,
          baseDropRate: location.baseDropRate,
          ironDepot: dropRateGroup.ironDepot,
          manualFishing: dropRateGroup.manualFishing,
          runecube: dropRateGroup.runecube,
          flags: [],
          notes: [],
        }),
      );
    }
  }

  return rows;
}

export function extractBuddyDropRatePage(target, pageData, pageDataUrl = getBuddyPageDataUrl(target.buddyUrl)) {
  const farmrpgData = pageData?.result?.data?.farmrpg;
  const item = farmrpgData?.items?.[0] ?? null;
  const location = farmrpgData?.locations?.[0] ?? null;
  const flags = [];
  const notes = [];

  if (item && location) {
    return {
      target,
      pageDataUrl,
      pageName: target.targetName,
      extractionStatus: 'uncertain',
      rows: [],
      flags: ['multiple_page_shapes'],
      notes: ['Page data contained both item and location data.'],
    };
  }

  if (!item && !location) {
    return {
      target,
      pageDataUrl,
      pageName: target.targetName,
      extractionStatus: 'uncertain',
      rows: [],
      flags: ['missing_farmrpg_page_data'],
      notes: ['Page data did not contain a FarmRPG item or location payload.'],
    };
  }

  if (target.targetType === 'item' && !item) {
    flags.push('target_type_mismatch');
    notes.push('Target was marked as an item, but page data contained location data.');
  }

  if (target.targetType === 'location' && !location) {
    flags.push('target_type_mismatch');
    notes.push('Target was marked as a location, but page data contained item data.');
  }

  const pageName = item?.name ?? location?.name ?? target.targetName;
  const rows = item ? extractItemRows(target, pageDataUrl, item) : extractLocationRows(target, pageDataUrl, location);
  const rowsWithWarnings = rows.filter((row) => row.flags.length > 0).length;

  if (rows.length === 0) {
    return {
      target,
      pageDataUrl,
      pageName,
      extractionStatus: flags.length > 0 ? 'uncertain' : 'no_drop_rates',
      rows,
      flags,
      notes,
    };
  }

  if (rowsWithWarnings > 0) {
    flags.push('row_warnings');
    notes.push(`${rowsWithWarnings.toLocaleString()} extracted drop-rate rows include warnings.`);
  }

  return {
    target,
    pageDataUrl,
    pageName,
    extractionStatus: flags.length > 0 ? 'uncertain' : 'extracted',
    rows,
    flags,
    notes,
  };
}

export async function extractBuddyDropRateTargets(targets, options = {}) {
  const fetchFn = options.fetchFn ?? fetch;
  const sleepFn = options.sleepFn ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const interRequestDelayMs = options.interRequestDelayMs ?? 3000;
  const results = [];

  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index];
    let pageDataUrl = null;

    try {
      pageDataUrl = getBuddyPageDataUrl(target.buddyUrl);
      const response = await fetchFn(pageDataUrl, {
        method: 'GET',
        headers: {
          accept: 'application/json',
        },
      });

      if (!response.ok) {
        results.push({
          target,
          pageDataUrl,
          pageName: target.targetName,
          extractionStatus: 'uncertain',
          rows: [],
          httpStatus: response.status,
          flags: [`http_${response.status}`],
          notes: [`Expected a successful buddy page-data fetch but received HTTP ${response.status}.`],
        });
      } else {
        const pageData = await response.json();
        results.push({
          ...extractBuddyDropRatePage(target, pageData, pageDataUrl),
          httpStatus: response.status,
        });
      }
    } catch (error) {
      results.push({
        target,
        pageDataUrl,
        pageName: target.targetName,
        extractionStatus: 'uncertain',
        rows: [],
        httpStatus: null,
        flags: ['fetch_error'],
        notes: [error instanceof Error ? error.message : 'Unknown fetch failure.'],
      });
    }

    if (index < targets.length - 1) {
      await sleepFn(interRequestDelayMs);
    }
  }

  const rows = results.flatMap((result) => result.rows);
  const reviewResults = results.filter((result) => result.extractionStatus !== 'extracted');
  const reviewRows = rows.filter((row) => row.flags.length > 0);
  const countsByStatus = results.reduce((counts, result) => {
    counts[result.extractionStatus] = (counts[result.extractionStatus] ?? 0) + 1;
    return counts;
  }, {});

  return {
    results,
    rows,
    reviewResults,
    reviewRows,
    summary: {
      targetsProcessed: results.length,
      dropRateRows: rows.length,
      countsByStatus,
      reviewPageCount: reviewResults.length,
      reviewRowCount: reviewRows.length,
      warnings: [
        ...(reviewResults.length > 0
          ? [`${reviewResults.length.toLocaleString()} target pages need review because extraction was not clean.`]
          : []),
        ...(reviewRows.length > 0
          ? [`${reviewRows.length.toLocaleString()} extracted rows include row-level warnings.`]
          : []),
      ],
    },
  };
}

export function toBuddyDropRateExtractionJson(extractionResult) {
  return JSON.stringify(extractionResult, null, 2);
}

export function toBuddyDropRatePagesCsv(extractionResult) {
  const rows = [
    'target_type,target_name,buddy_url,page_data_url,extraction_status,http_status,drop_rate_row_count,flags,notes',
  ];

  for (const result of extractionResult.results) {
    rows.push(
      [
        result.target.targetType,
        result.pageName || result.target.targetName,
        result.target.buddyUrl,
        result.pageDataUrl ?? '',
        result.extractionStatus,
        result.httpStatus === null ? '' : String(result.httpStatus),
        String(result.rows.length),
        result.flags.join('; '),
        result.notes.join('; '),
      ]
        .map(escapeCsvValue)
        .join(','),
    );
  }

  return rows.join('\n');
}

export function toBuddyDropRateRowsCsv(extractionResult) {
  const rows = [
    'source_page_type,source_page_name,source_page_url,page_data_url,row_kind,target_item_name,target_item_id,target_item_image,source_name,source_type,source_kind,source_image,raw_rate,base_drop_rate,iron_depot,manual_fishing,runecube,flags,notes',
  ];

  for (const row of extractionResult.rows) {
    rows.push(
      [
        row.sourcePageType,
        row.sourcePageName,
        row.sourcePageUrl,
        row.pageDataUrl,
        row.rowKind,
        row.targetItemName,
        row.targetItemId ?? '',
        row.targetItemImage ?? '',
        row.sourceName,
        row.sourceType,
        row.sourceKind,
        row.sourceImage ?? '',
        row.rawRate === null ? '' : String(row.rawRate),
        row.baseDropRate === null ? '' : String(row.baseDropRate),
        row.ironDepot === null ? '' : String(row.ironDepot),
        row.manualFishing === null ? '' : String(row.manualFishing),
        row.runecube === null ? '' : String(row.runecube),
        row.flags.join('; '),
        row.notes.join('; '),
      ]
        .map(escapeCsvValue)
        .join(','),
    );
  }

  return rows.join('\n');
}

export function toBuddyDropRateReviewCsv(extractionResult) {
  const reviewPageRows = extractionResult.reviewResults.map((result) => ({
    kind: 'page',
    targetType: result.target.targetType,
    targetName: result.pageName || result.target.targetName,
    buddyUrl: result.target.buddyUrl,
    pageDataUrl: result.pageDataUrl ?? '',
    status: result.extractionStatus,
    flags: result.flags,
    notes: result.notes,
  }));
  const reviewDropRows = extractionResult.reviewRows.map((row) => ({
    kind: 'row',
    targetType: row.sourcePageType,
    targetName: row.sourcePageName,
    buddyUrl: row.sourcePageUrl,
    pageDataUrl: row.pageDataUrl,
    status: row.rowKind,
    flags: row.flags,
    notes: row.notes,
  }));
  const rows = ['review_kind,target_type,target_name,buddy_url,page_data_url,status,flags,notes'];

  for (const row of [...reviewPageRows, ...reviewDropRows]) {
    rows.push(
      [
        row.kind,
        row.targetType,
        row.targetName,
        row.buddyUrl,
        row.pageDataUrl,
        row.status,
        row.flags.join('; '),
        row.notes.join('; '),
      ]
        .map(escapeCsvValue)
        .join(','),
    );
  }

  return rows.join('\n');
}
