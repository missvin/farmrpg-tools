export type MuseumSeedCsvRow = {
  museumCategory: string;
  category: string;
  itemName: string;
  canonicalKey: string;
  obtainable: boolean;
};

export type BuddyFarmCandidate = {
  museumCategory: string;
  category: string;
  itemName: string;
  canonicalKey: string;
  obtainable: boolean;
  generatedBuddySlug: string;
  candidateBuddyUrl: string;
  alternateBuddySlug: string | null;
  confidence: 'high' | 'medium' | 'review';
  flags: string[];
  notes: string[];
};

export type BuddyFarmCandidateResult = {
  items: BuddyFarmCandidate[];
  reviewItems: BuddyFarmCandidate[];
  parseSummary: {
    itemsParsed: number;
    reviewItemsCount: number;
    collisionCount: number;
    warnings: string[];
  };
};

const MUSEUM_SEED_COLUMNS = ['museum_category', 'category', 'item_name', 'canonical_key', 'obtainable'] as const;

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

function validateHeaders(headers: string[]): void {
  const missingColumns = MUSEUM_SEED_COLUMNS.filter((column) => !headers.includes(column));
  const unexpectedColumns = headers.filter(
    (header) => !MUSEUM_SEED_COLUMNS.includes(header as (typeof MUSEUM_SEED_COLUMNS)[number]),
  );

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

  throw new Error(`Invalid museum seed CSV schema (${details.join('; ')}).`);
}

function readField(values: string[], headerIndex: Record<string, number>, fieldName: string): string {
  const index = headerIndex[fieldName];
  return index === undefined ? '' : values[index] ?? '';
}

function parseObtainable(value: string): boolean {
  const normalizedValue = value.trim().toUpperCase();

  if (normalizedValue === 'Y') {
    return true;
  }

  if (normalizedValue === 'N') {
    return false;
  }

  throw new Error(`Invalid obtainable value "${value}" in museum seed CSV.`);
}

function toBuddySlugBase(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+/gu, '')
    .replace(/-+/gu, '-');
}

function toSlugFromAsciiDrop(itemName: string): string {
  return toBuddySlugBase(itemName);
}

function toSlugFromDiacriticFold(itemName: string): string {
  return toBuddySlugBase(itemName.normalize('NFKD').replace(/\p{M}+/gu, ''));
}

function hasNonAsciiCharacters(value: string): boolean {
  return [...value].some((character) => character.codePointAt(0)! > 127);
}

function toOptionalNote(flags: string[]): string[] {
  const notes: string[] = [];

  if (flags.includes('non_ascii_or_diacritic')) {
    notes.push('Contains non-ASCII or diacritic characters; verify the generated slug manually.');
  }

  if (flags.includes('alternate_slug_variant')) {
    notes.push('Alternate slug variant differs from the primary generated slug.');
  }

  if (flags.includes('symbol_cleanup')) {
    notes.push('Punctuation or symbols were cleaned during slug generation.');
  }

  if (flags.includes('slug_collision')) {
    notes.push('Another museum item generated the same primary buddy slug.');
  }

  return notes;
}

function escapeCsvValue(value: string): string {
  if (/[",\n]/u.test(value)) {
    return `"${value.replace(/"/gu, '""')}"`;
  }

  return value;
}

export function parseMuseumSeedCsv(csvText: string): MuseumSeedCsvRow[] {
  const lines = csvText
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvRow(lines[0]).map(normalizeHeader);
  validateHeaders(headers);

  const headerIndex = headers.reduce<Record<string, number>>((indexByHeader, header, index) => {
    indexByHeader[header] = index;
    return indexByHeader;
  }, {});

  return lines.slice(1).map((line) => {
    const values = parseCsvRow(line);
    const itemName = readField(values, headerIndex, 'item_name').trim();
    const canonicalKey = readField(values, headerIndex, 'canonical_key').trim();

    if (!itemName || !canonicalKey) {
      throw new Error('Museum seed CSV rows must include item_name and canonical_key.');
    }

    return {
      museumCategory: readField(values, headerIndex, 'museum_category').trim(),
      category: readField(values, headerIndex, 'category').trim(),
      itemName,
      canonicalKey,
      obtainable: parseObtainable(readField(values, headerIndex, 'obtainable')),
    };
  });
}

export function generateBuddyFarmCandidates(seedRows: MuseumSeedCsvRow[]): BuddyFarmCandidateResult {
  const items = seedRows.map<BuddyFarmCandidate>((row) => {
    const primarySlug = toSlugFromAsciiDrop(row.itemName);
    const alternateSlug = toSlugFromDiacriticFold(row.itemName);
    const flags: string[] = [];

    if (hasNonAsciiCharacters(row.itemName)) {
      flags.push('non_ascii_or_diacritic');
    }

    if (/[^A-Za-z0-9\s]/u.test(row.itemName)) {
      flags.push('symbol_cleanup');
    }

    if (alternateSlug && alternateSlug !== primarySlug) {
      flags.push('alternate_slug_variant');
    }

    const confidence: BuddyFarmCandidate['confidence'] = flags.includes('non_ascii_or_diacritic')
      ? 'review'
      : flags.length > 0
        ? 'medium'
        : 'high';

    return {
      museumCategory: row.museumCategory,
      category: row.category,
      itemName: row.itemName,
      canonicalKey: row.canonicalKey,
      obtainable: row.obtainable,
      generatedBuddySlug: primarySlug,
      candidateBuddyUrl: `https://buddy.farm/i/${primarySlug}/`,
      alternateBuddySlug: alternateSlug !== primarySlug ? alternateSlug : null,
      confidence,
      flags,
      notes: toOptionalNote(flags),
    };
  });

  const slugCounts = items.reduce<Record<string, number>>((counts, item) => {
    counts[item.generatedBuddySlug] = (counts[item.generatedBuddySlug] ?? 0) + 1;
    return counts;
  }, {});

  let collisionCount = 0;

  for (const item of items) {
    if (slugCounts[item.generatedBuddySlug] <= 1) {
      continue;
    }

    if (!item.flags.includes('slug_collision')) {
      item.flags.push('slug_collision');
      item.notes.push('Another museum item generated the same primary buddy slug.');
      item.confidence = 'review';
    }

    collisionCount += 1;
  }

  const reviewItems = items.filter((item) => item.confidence === 'review' || item.flags.length > 0);
  const warnings: string[] = [];

  if (reviewItems.length > 0) {
    warnings.push(
      `${reviewItems.length.toLocaleString()} candidate mappings need review because they include slug edge cases, cleanup assumptions, or collisions.`,
    );
  }

  if (collisionCount > 0) {
    warnings.push(
      `${collisionCount.toLocaleString()} candidate rows generated buddy slug collisions and should be reviewed before probing.`,
    );
  }

  return {
    items,
    reviewItems,
    parseSummary: {
      itemsParsed: items.length,
      reviewItemsCount: reviewItems.length,
      collisionCount,
      warnings,
    },
  };
}

export function toBuddyFarmCandidatesJson(result: BuddyFarmCandidateResult): string {
  return JSON.stringify(result, null, 2);
}

export function toBuddyFarmCandidatesCsv(result: BuddyFarmCandidateResult): string {
  const rows = [
    'museum_category,category,item_name,canonical_key,obtainable,generated_buddy_slug,candidate_buddy_url,alternate_buddy_slug,confidence,flags,notes',
  ];

  for (const item of result.items) {
    rows.push(
      [
        item.museumCategory,
        item.category,
        item.itemName,
        item.canonicalKey,
        item.obtainable ? 'Y' : 'N',
        item.generatedBuddySlug,
        item.candidateBuddyUrl,
        item.alternateBuddySlug ?? '',
        item.confidence,
        item.flags.join('; '),
        item.notes.join('; '),
      ]
        .map(escapeCsvValue)
        .join(','),
    );
  }

  return rows.join('\n');
}

export function toBuddyFarmCandidateReviewCsv(result: BuddyFarmCandidateResult): string {
  const reviewResult: BuddyFarmCandidateResult = {
    ...result,
    items: result.reviewItems,
  };

  return toBuddyFarmCandidatesCsv(reviewResult);
}
