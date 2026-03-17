const SMART_PUNCTUATION_REPLACEMENTS = {
  '\u2018': "'",
  '\u2019': "'",
  '\u201a': "'",
  '\u201b': "'",
  '\u2032': "'",
  '\u201c': '"',
  '\u201d': '"',
  '\u201e': '"',
  '\u201f': '"',
  '\u2033': '"',
};

const MUSEUM_SEED_COLUMNS = ['museum_category', 'category', 'item_name', 'canonical_key', 'obtainable'];

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

function normalizeHeader(header) {
  return header.trim().toLowerCase();
}

function readField(values, headerIndex, fieldName) {
  const index = headerIndex[fieldName];
  return index === undefined ? '' : values[index] ?? '';
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

export function normalizeItemKey(input) {
  return input
    .replace(/[\u2018\u2019\u201a\u201b\u2032\u201c\u201d\u201e\u201f\u2033]/gu, (character) => {
      return SMART_PUNCTUATION_REPLACEMENTS[character] ?? character;
    })
    .toLowerCase()
    .trim()
    .replace(/\s+/gu, ' ');
}

export function parseMuseumSeedCsv(csvText) {
  const lines = csvText
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvRow(lines[0]).map(normalizeHeader);
  validateHeaders(headers, MUSEUM_SEED_COLUMNS, 'museum seed CSV');

  const headerIndex = headers.reduce((indexByHeader, header, index) => {
    indexByHeader[header] = index;
    return indexByHeader;
  }, {});

  return lines.slice(1).map((line) => {
    const values = parseCsvRow(line);

    return {
      museumCategory: readField(values, headerIndex, 'museum_category').trim(),
      category: readField(values, headerIndex, 'category').trim(),
      itemName: readField(values, headerIndex, 'item_name').trim(),
      canonicalKey: readField(values, headerIndex, 'canonical_key').trim(),
      obtainable: readField(values, headerIndex, 'obtainable').trim().toUpperCase() === 'Y',
    };
  });
}

export function parseBuddyRecipeResultsJson(jsonText) {
  const parsed = JSON.parse(jsonText);

  if (!Array.isArray(parsed.results)) {
    throw new Error('Invalid buddy recipe results JSON: missing results array.');
  }

  return parsed;
}

function addEntityOccurrence(entitiesByKey, entityName, role, context) {
  const normalizedKey = normalizeItemKey(entityName);

  if (!normalizedKey) {
    return;
  }

  const existing = entitiesByKey.get(normalizedKey);

  if (existing) {
    existing.observedNames.add(entityName);
    existing.roles.add(role);
    existing.occurrenceCount += 1;
    existing.contexts.push(context);
    return;
  }

  entitiesByKey.set(normalizedKey, {
    normalizedKey,
    observedNames: new Set([entityName]),
    roles: new Set([role]),
    occurrenceCount: 1,
    contexts: [context],
  });
}

export function extractRecipeEntities(extractionResult) {
  const entitiesByKey = new Map();

  for (const result of extractionResult.results) {
    addEntityOccurrence(entitiesByKey, result.itemName, 'page_item', {
      sourceItemName: result.itemName,
      sourceBuddyUrl: result.candidateBuddyUrl,
    });

    if (result.recipe?.recipeBookItem?.itemName) {
      addEntityOccurrence(entitiesByKey, result.recipe.recipeBookItem.itemName, 'recipe_book', {
        sourceItemName: result.itemName,
        sourceBuddyUrl: result.candidateBuddyUrl,
      });
    }

    for (const ingredient of result.recipe?.ingredients ?? []) {
      addEntityOccurrence(entitiesByKey, ingredient.itemName, 'ingredient', {
        sourceItemName: result.itemName,
        sourceBuddyUrl: result.candidateBuddyUrl,
      });
    }

    for (const usedIn of result.usedIn ?? []) {
      addEntityOccurrence(entitiesByKey, usedIn.itemName, 'used_in_target', {
        sourceItemName: result.itemName,
        sourceBuddyUrl: result.candidateBuddyUrl,
      });
    }
  }

  return Array.from(entitiesByKey.values()).map((entity) => ({
    normalizedKey: entity.normalizedKey,
    observedNames: Array.from(entity.observedNames).sort(),
    roles: Array.from(entity.roles).sort(),
    occurrenceCount: entity.occurrenceCount,
    contexts: entity.contexts,
  }));
}

function buildUniverseLookup(universeRows) {
  return universeRows.reduce((lookup, row) => {
    const existing = lookup.get(row.canonicalKey) ?? [];
    existing.push(row);
    lookup.set(row.canonicalKey, existing);
    return lookup;
  }, new Map());
}

function reconcileEntity(entity, universeLookup) {
  const matches = universeLookup.get(entity.normalizedKey) ?? [];

  if (matches.length === 0) {
    return {
      ...entity,
      matchStatus: 'unmatched',
      matchedUniverseRow: null,
      matchCandidates: [],
      notes: ['No local item-universe row matched this normalized key.'],
    };
  }

  if (matches.length === 1) {
    return {
      ...entity,
      matchStatus: 'matched',
      matchedUniverseRow: matches[0],
      matchCandidates: matches,
      notes: [],
    };
  }

  return {
    ...entity,
    matchStatus: 'ambiguous',
    matchedUniverseRow: null,
    matchCandidates: matches,
    notes: ['Multiple local item-universe rows share this normalized key.'],
  };
}

export function reconcileRecipeEntities(extractionResult, universeRows) {
  const entities = extractRecipeEntities(extractionResult);
  const universeLookup = buildUniverseLookup(universeRows);
  const reconciledEntities = entities.map((entity) => reconcileEntity(entity, universeLookup));
  const matched = reconciledEntities.filter((entity) => entity.matchStatus === 'matched');
  const unmatched = reconciledEntities.filter((entity) => entity.matchStatus === 'unmatched');
  const ambiguous = reconciledEntities.filter((entity) => entity.matchStatus === 'ambiguous');

  return {
    summary: {
      extractedEntityCount: reconciledEntities.length,
      matchedCount: matched.length,
      unmatchedCount: unmatched.length,
      ambiguousCount: ambiguous.length,
    },
    entities: reconciledEntities,
    matched,
    unmatched,
    ambiguous,
  };
}

function escapeCsvValue(value) {
  if (/[",\n]/u.test(value)) {
    return `"${value.replace(/"/gu, '""')}"`;
  }

  return value;
}

function buildSummaryRow(entity) {
  const matchedRow = entity.matchedUniverseRow;

  return [
    entity.normalizedKey,
    entity.observedNames[0] ?? '',
    entity.observedNames.join(' | '),
    entity.matchStatus,
    String(entity.occurrenceCount),
    entity.roles.join('; '),
    String(entity.matchCandidates.length),
    matchedRow?.itemName ?? '',
    matchedRow?.category ?? '',
    matchedRow?.museumCategory ?? '',
    matchedRow ? (matchedRow.obtainable ? 'Y' : 'N') : '',
    entity.notes.join('; '),
  ]
    .map(escapeCsvValue)
    .join(',');
}

export function toRecipeReconciliationJson(reconciliationResult) {
  return JSON.stringify(reconciliationResult, null, 2);
}

export function toRecipeReconciliationSummaryCsv(reconciliationResult) {
  const rows = [
    'normalized_key,primary_name,observed_names,match_status,occurrence_count,roles,match_candidate_count,matched_item_name,matched_category,matched_museum_category,matched_obtainable,notes',
  ];

  for (const entity of reconciliationResult.entities) {
    rows.push(buildSummaryRow(entity));
  }

  return rows.join('\n');
}

export function toRecipeReconciliationSubsetCsv(entities) {
  const rows = [
    'normalized_key,primary_name,observed_names,match_status,occurrence_count,roles,match_candidate_count,matched_item_name,matched_category,matched_museum_category,matched_obtainable,notes',
  ];

  for (const entity of entities) {
    rows.push(buildSummaryRow(entity));
  }

  return rows.join('\n');
}
