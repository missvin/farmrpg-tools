const DEFAULT_SOURCE_LABEL = '2026-06-04 museum Library Everything export';

export const REVIEWED_CURRENT_MUSEUM_ADDITIONS = [
  'Garden Claw',
  'Blue Diamond Fish',
  'Eggypalchi',
  'Planet Egg',
  'Alien Fuzzy Chick',
  'Crowbar',
  'Red Velvet Cake',
  '5th Birthday Card',
  'Farmiversary Trophy 02',
  'Farmiversary Trophy 05',
  'Lucky Potato',
  'Lucky Corn',
  'Comet Egg',
  'Harvest Bundle 01',
  'Egg Buddy Doll',
  'Asteroid Egg',
  'Nebula Egg',
  'Garden Crate 01',
  'Gloorp',
  'Farmiversary Trophy 03',
  'Lucky Eggs',
  'Black Hole Egg',
  'Lucky Bacon',
  'Fuzzy Trout',
  'Lucky Trout',
  'Astro Fuzzy Chick',
  'Cake',
  'Moon Egg',
  'Slimed Buddy Doll',
  'Valve',
  'Camping Buddy Doll',
  'Sun Egg',
  'Farmiversary Trophy 04',
  "Traveler's Bag 01",
  "Thomas's Red Velvet Cake",
  'Day Off Voucher',
  'Coconut Water',
  'Buddy Box',
  'Fuzzy Trophy',
  'Farmiversary Trophy 01',
  'Garden Trowel',
  'Farmiversary Trophy 06',
  'Birthday Surprise Box 05',
  'Galactic Egg Basket',
  'Fish Flakes',
];

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
  const text = String(value ?? '');

  if (/[",\n]/u.test(text)) {
    return `"${text.replace(/"/gu, '""')}"`;
  }

  return text;
}

function normalizeCanonicalKey(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim()
    .replace(/\s+/gu, ' ');
}

function compactName(value) {
  return value.replace(/\s+/gu, '');
}

function toBuddySlug(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+/gu, '')
    .replace(/-+/gu, '-');
}

export function parseMuseumCanonCsv(csvText) {
  const lines = csvText
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvRow(lines[0]).map((header) => header.trim());
  const headerIndex = headers.reduce((indexByHeader, header, index) => {
    indexByHeader[header] = index;
    return indexByHeader;
  }, {});

  for (const requiredColumn of ['museum_category', 'category_key', 'slot_index', 'item_name', 'canonical_key']) {
    if (headerIndex[requiredColumn] === undefined) {
      throw new Error(`museum_completion_canon.csv is missing required column "${requiredColumn}".`);
    }
  }

  return lines.slice(1).map((line) => {
    const values = parseCsvRow(line);

    return {
      museumCategory: values[headerIndex.museum_category] ?? '',
      categoryKey: values[headerIndex.category_key] ?? '',
      slotIndex: values[headerIndex.slot_index] ?? '',
      itemName: values[headerIndex.item_name] ?? '',
      canonicalKey: values[headerIndex.canonical_key] ?? '',
      obtainable: headerIndex.obtainable === undefined ? '' : values[headerIndex.obtainable] ?? '',
      reviewStatus: headerIndex.review_status === undefined ? '' : values[headerIndex.review_status] ?? '',
    };
  });
}

export function extractLibraryEverythingPayload(rawText) {
  const marker = rawText.match(/Every single item\s*\(([0-9,]+)\):/u);

  if (!marker || marker.index === undefined) {
    throw new Error('Could not find an "Every single item (...):" marker in the museum export.');
  }

  const declaredCount = Number(marker[1].replace(/,/gu, ''));
  const contentStart = marker.index + marker[0].length;
  const endCandidates = ['Consume a meal', 'Close Panel']
    .map((text) => rawText.indexOf(text, contentStart))
    .filter((index) => index >= 0);
  const contentEnd = endCandidates.length > 0 ? Math.min(...endCandidates) : rawText.length;
  const payload = rawText.slice(contentStart, contentEnd).replace(/\s+/gu, '').trim();

  if (!payload) {
    throw new Error('The museum export marker was found, but no item payload followed it.');
  }

  return {
    declaredCount,
    payload,
  };
}

function buildCandidateRows(canonRows, reviewedAdditions) {
  const oldRows = canonRows.map((row) => ({
    itemName: row.itemName,
    canonicalKey: row.canonicalKey || normalizeCanonicalKey(row.itemName),
    previousMuseumCategory: row.museumCategory,
    previousCategoryKey: row.categoryKey,
    previousSlotIndex: row.slotIndex,
    obtainable: row.obtainable,
    sourceStatus: 'existing_museum_completion_canon',
    reviewStatus: row.reviewStatus || 'source_parsed',
  }));

  const newRows = reviewedAdditions.map((itemName) => ({
    itemName,
    canonicalKey: normalizeCanonicalKey(itemName),
    previousMuseumCategory: '',
    previousCategoryKey: '',
    previousSlotIndex: '',
    obtainable: '',
    sourceStatus: 'new_in_current_museum_export',
    reviewStatus: 'reviewed_name_from_current_export',
  }));

  return [...oldRows, ...newRows];
}

function findDuplicateCompactNames(rows) {
  const compactCounts = new Map();

  for (const row of rows) {
    const compact = compactName(row.itemName);
    compactCounts.set(compact, (compactCounts.get(compact) ?? 0) + 1);
  }

  return [...compactCounts.entries()].filter(([, count]) => count > 1).map(([compact]) => compact);
}

export function buildCurrentMuseumUniverse({ rawText, canonCsvText, reviewedAdditions = REVIEWED_CURRENT_MUSEUM_ADDITIONS }) {
  const canonRows = parseMuseumCanonCsv(canonCsvText);
  const { declaredCount, payload } = extractLibraryEverythingPayload(rawText);
  const candidateRows = buildCandidateRows(canonRows, reviewedAdditions);
  const duplicateCompactNames = findDuplicateCompactNames(candidateRows);

  if (duplicateCompactNames.length > 0) {
    throw new Error(`Duplicate compact item names would make parsing ambiguous: ${duplicateCompactNames.join(', ')}.`);
  }

  const rowsByCompactName = new Map(candidateRows.map((row) => [compactName(row.itemName), row]));
  const matchKeys = [...rowsByCompactName.keys()].sort((left, right) => right.length - left.length);
  const orderedRows = [];
  let offset = 0;

  while (offset < payload.length) {
    const matchKey = matchKeys.find((key) => payload.startsWith(key, offset));

    if (!matchKey) {
      const contextStart = Math.max(0, offset - 40);
      const contextEnd = Math.min(payload.length, offset + 80);
      throw new Error(
        `Could not match museum export text at offset ${offset}: ${payload.slice(contextStart, contextEnd)}`,
      );
    }

    orderedRows.push(rowsByCompactName.get(matchKey));
    offset += matchKey.length;
  }

  const warnings = [];

  if (orderedRows.length !== declaredCount) {
    warnings.push(`Parsed ${orderedRows.length} items but the export declared ${declaredCount}.`);
  }

  return {
    declaredCount,
    parsedCount: orderedRows.length,
    oldCanonCount: canonRows.length,
    reviewedAdditionCount: reviewedAdditions.length,
    newItemNames: reviewedAdditions,
    items: orderedRows.map((row, index) => {
      const generatedBuddySlug = toBuddySlug(row.itemName);

      return {
        itemIndex: index + 1,
        itemName: row.itemName,
        canonicalKey: row.canonicalKey,
        sourceStatus: row.sourceStatus,
        previousMuseumCategory: row.previousMuseumCategory,
        previousCategoryKey: row.previousCategoryKey,
        previousSlotIndex: row.previousSlotIndex,
        obtainable: row.obtainable,
        reviewStatus: row.reviewStatus,
        generatedBuddySlug,
        buddyUrl: `https://buddy.farm/i/${generatedBuddySlug}/`,
      };
    }),
    warnings,
  };
}

export function toCurrentMuseumUniverseCsv(result, { sourceLabel = DEFAULT_SOURCE_LABEL } = {}) {
  const rows = [
    [
      'item_index',
      'item_name',
      'canonical_key',
      'source_status',
      'previous_museum_category',
      'previous_category_key',
      'previous_slot_index',
      'obtainable',
      'review_status',
      'generated_buddy_slug',
      'buddy_url',
      'source_label',
      'notes',
    ],
  ];

  for (const item of result.items) {
    const notes =
      item.sourceStatus === 'new_in_current_museum_export'
        ? 'New in current museum export; review sources, icons, recipes, and aliases before canonical promotion.'
        : 'Previously present in museum_completion_canon.csv; included for full current-universe Buddy evidence refresh.';

    rows.push([
      item.itemIndex,
      item.itemName,
      item.canonicalKey,
      item.sourceStatus,
      item.previousMuseumCategory,
      item.previousCategoryKey,
      item.previousSlotIndex,
      item.obtainable,
      item.reviewStatus,
      item.generatedBuddySlug,
      item.buddyUrl,
      sourceLabel,
      notes,
    ]);
  }

  return rows.map((row) => row.map(escapeCsvValue).join(',')).join('\n');
}

export function toBuddyEvidenceTargetsCsv(result) {
  const rows = [['item_name', 'canonical_key', 'buddy_url', 'notes']];

  for (const item of result.items) {
    const notes =
      item.sourceStatus === 'new_in_current_museum_export'
        ? 'BL-248 current museum universe new item; cache Buddy page evidence when available.'
        : 'BL-248 current museum universe item; refresh Buddy page evidence for parsing work.';
    rows.push([item.itemName, item.canonicalKey, item.buddyUrl, notes]);
  }

  return rows.map((row) => row.map(escapeCsvValue).join(',')).join('\n');
}

export function toNewItemReviewCsv(result) {
  const rows = [['item_name', 'canonical_key', 'buddy_url', 'review_status', 'notes']];

  for (const item of result.items.filter((entry) => entry.sourceStatus === 'new_in_current_museum_export')) {
    rows.push([
      item.itemName,
      item.canonicalKey,
      item.buddyUrl,
      'review_needed',
      'Confirm Buddy page, icon availability, source rows, recipe rows, and whether this belongs in any canonical data table.',
    ]);
  }

  return rows.map((row) => row.map(escapeCsvValue).join(',')).join('\n');
}

export function toCurrentMuseumUniverseSummaryJson(result, { sourceLabel = DEFAULT_SOURCE_LABEL } = {}) {
  return `${JSON.stringify(
    {
      sourceLabel,
      declaredCount: result.declaredCount,
      parsedCount: result.parsedCount,
      oldCanonCount: result.oldCanonCount,
      reviewedAdditionCount: result.reviewedAdditionCount,
      warnings: result.warnings,
      newItemNames: result.newItemNames,
    },
    null,
    2,
  )}\n`;
}
