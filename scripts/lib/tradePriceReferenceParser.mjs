export const TRADE_PRICE_PARSER_VERSION = 'trade-price-reference-v1';

export const TRADE_PRICE_REFERENCE_COLUMNS = [
  'sort_order',
  'raw_item_label',
  'item_name',
  'canonical_key',
  'known_item_status',
  'gold_raw',
  'gold_status',
  'gold_min',
  'gold_max',
  'gold_currency',
  'gold_quantity_basis',
  'ap_raw',
  'ap_status',
  'ap_min',
  'ap_max',
  'ap_currency',
  'ap_quantity_basis',
  'oj_raw',
  'oj_status',
  'oj_min',
  'oj_max',
  'oj_currency',
  'oj_quantity_basis',
  'source_name',
  'source_url',
  'captured_date',
  'parser_version',
  'notes',
];

const BASIC_ENTITIES = new Map([
  ['amp', '&'],
  ['quot', '"'],
  ['apos', "'"],
  ['#39', "'"],
  ['lt', '<'],
  ['gt', '>'],
]);

function decodeBasicEntities(value) {
  return value.replace(/&([a-zA-Z0-9#]+);/gu, (match, entity) => BASIC_ENTITIES.get(entity) ?? match);
}

export function cleanCopiedText(value) {
  return decodeBasicEntities(String(value ?? ''))
    .replace(/Ã—/gu, '×')
    .replace(/Â»/gu, '»')
    .replace(/Â«/gu, '«')
    .replace(/Â/g, '')
    .replace(/<[^>]*>/gu, '')
    .replace(/[ \t\r\n]+/gu, ' ')
    .trim();
}

export function cleanTradeItemName(value) {
  return cleanCopiedText(value).replace(/\s*\((?:meal)\)\s*$/iu, '').trim();
}

export function toCanonicalItemKey(input) {
  return String(input ?? '')
    .replace(/[\u2018\u2019\u201a\u201b\u2032]/gu, "'")
    .replace(/[\u201c\u201d\u201e\u201f\u2033]/gu, '"')
    .toLowerCase()
    .trim()
    .replace(/\s+/gu, ' ');
}

function toLooseItemKey(input) {
  return toCanonicalItemKey(input)
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim()
    .replace(/\s+/gu, ' ');
}

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

export function parseCsv(csvText) {
  const lines = String(csvText ?? '')
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

  return lines.slice(1).map((line) => {
    const values = parseCsvRow(line);
    return {
      get(fieldName) {
        const index = headerIndex[fieldName];
        return index === undefined ? '' : values[index] ?? '';
      },
    };
  });
}

export function buildItemReferenceLookup({ itemCatalogCsvText, itemAliasesCsvText = '' }) {
  const lookup = new Map();

  function addLookupKey(key, reference) {
    const canonicalKey = toCanonicalItemKey(key);
    const looseKey = toLooseItemKey(key);

    if (canonicalKey) {
      lookup.set(canonicalKey, reference);
    }

    if (looseKey) {
      lookup.set(looseKey, reference);
    }
  }

  for (const row of parseCsv(itemCatalogCsvText)) {
    const itemName = row.get('item_name').trim();
    const canonicalKey = row.get('canonical_key').trim() || toCanonicalItemKey(itemName);

    if (!itemName || !canonicalKey) {
      continue;
    }

    const reference = { itemName, canonicalKey };
    addLookupKey(itemName, reference);
    addLookupKey(canonicalKey, reference);
  }

  for (const row of parseCsv(itemAliasesCsvText)) {
    const aliasName = row.get('alias_name').trim();
    const aliasKey = row.get('alias_key').trim();
    const canonicalItemName = row.get('canonical_item_name').trim();
    const canonicalKey = row.get('canonical_key').trim() || toCanonicalItemKey(canonicalItemName);

    if (!canonicalItemName || !canonicalKey) {
      continue;
    }

    const reference = { itemName: canonicalItemName, canonicalKey };
    addLookupKey(aliasName, reference);
    addLookupKey(aliasKey, reference);
  }

  return {
    resolve(itemName) {
      return lookup.get(toCanonicalItemKey(itemName)) ?? lookup.get(toLooseItemKey(itemName)) ?? null;
    },
  };
}

export function parsePriceCell(rawCell) {
  const raw = cleanCopiedText(rawCell);

  if (!raw || raw === '×' || raw.toLowerCase() === 'x') {
    return {
      raw,
      status: 'not_listed',
      min: '',
      max: '',
      currency: '',
      quantityBasis: '',
    };
  }

  if (/^pc$/iu.test(raw)) {
    return {
      raw,
      status: 'price_check',
      min: '',
      max: '',
      currency: '',
      quantityBasis: '',
    };
  }

  if (/^country store$/iu.test(raw)) {
    return {
      raw,
      status: 'country_store',
      min: '',
      max: '',
      currency: '',
      quantityBasis: '',
    };
  }

  const match = raw.match(/^(\d+(?:\.\d+)?|\.\d+)(?:\s*-\s*(\d+(?:\.\d+)?|\.\d+))?\s*(g|ap|oj)(?:\s*\/\s*(k|100))?$/iu);

  if (!match) {
    return {
      raw,
      status: 'unparsed',
      min: '',
      max: '',
      currency: '',
      quantityBasis: '',
    };
  }

  const min = String(Number(match[1]));
  const max = String(Number(match[2] ?? match[1]));
  const currency = match[3].toLowerCase() === 'g' ? 'gold' : match[3].toLowerCase();
  const quantityBasis = match[4]?.toLowerCase() === 'k' ? 'per_1000' : match[4] === '100' ? 'per_100' : 'each';

  return {
    raw,
    status: 'priced',
    min,
    max,
    currency,
    quantityBasis,
  };
}

function toOutputRow({
  sortOrder,
  rawItemLabel,
  itemName,
  reference,
  gold,
  ap,
  oj,
  sourceName,
  sourceUrl,
  capturedDate,
}) {
  return {
    sort_order: String(sortOrder),
    raw_item_label: rawItemLabel,
    item_name: reference?.itemName ?? itemName,
    canonical_key: reference?.canonicalKey ?? toCanonicalItemKey(itemName),
    known_item_status: reference ? 'known' : 'unknown',
    gold_raw: gold.raw,
    gold_status: gold.status,
    gold_min: gold.min,
    gold_max: gold.max,
    gold_currency: gold.currency,
    gold_quantity_basis: gold.quantityBasis,
    ap_raw: ap.raw,
    ap_status: ap.status,
    ap_min: ap.min,
    ap_max: ap.max,
    ap_currency: ap.currency,
    ap_quantity_basis: ap.quantityBasis,
    oj_raw: oj.raw,
    oj_status: oj.status,
    oj_min: oj.min,
    oj_max: oj.max,
    oj_currency: oj.currency,
    oj_quantity_basis: oj.quantityBasis,
    source_name: sourceName,
    source_url: sourceUrl,
    captured_date: capturedDate,
    parser_version: TRADE_PRICE_PARSER_VERSION,
    notes: '',
  };
}

export function parseTradePricePastedText(rawText, options = {}) {
  const {
    itemReferenceLookup = null,
    sourceName = 'Farm RPG Price Check',
    sourceUrl = 'https://farmrpg-pricecheck.free.nf/index.html?i=3',
    capturedDate = '',
    allowUnknown = false,
  } = options;
  const lines = String(rawText ?? '').split(/\r?\n/u);
  const headerIndex = lines.findIndex((line) => {
    const parts = line.split('\t').map(cleanCopiedText);
    return parts.length >= 5 && parts[1]?.includes('Name') && parts[2] === 'Gold' && parts[3] === 'AP' && parts[4] === 'OJ';
  });

  if (headerIndex === -1) {
    throw new Error('Could not find the Farm RPG Price Check table header.');
  }

  const rows = [];
  const unknownItems = [];
  let sortOrder = 1;

  for (const line of lines.slice(headerIndex + 1)) {
    const parts = line.split('\t');

    if (parts.length < 5) {
      continue;
    }

    const rawItemLabel = cleanCopiedText(parts[0]);
    const itemName = cleanTradeItemName(parts[1]);

    if (!itemName || ['Refresh Page:', 'Notice a change?'].some((prefix) => itemName.startsWith(prefix))) {
      continue;
    }

    const reference = itemReferenceLookup?.resolve(itemName) ?? null;

    if (!reference) {
      unknownItems.push(itemName);
    }

    rows.push(
      toOutputRow({
        sortOrder,
        rawItemLabel,
        itemName,
        reference,
        gold: parsePriceCell(parts[2]),
        ap: parsePriceCell(parts[3]),
        oj: parsePriceCell(parts[4]),
        sourceName,
        sourceUrl,
        capturedDate,
      }),
    );
    sortOrder += 1;
  }

  const uniqueUnknownItems = [...new Set(unknownItems)].sort((left, right) => left.localeCompare(right));

  if (uniqueUnknownItems.length > 0 && !allowUnknown) {
    throw new Error(
      [
        `Trade price export contains ${uniqueUnknownItems.length} item(s) not found in local item reference data.`,
        ...uniqueUnknownItems.map((itemName) => `- ${itemName}`),
      ].join('\n'),
    );
  }

  return {
    rows,
    unknownItems: uniqueUnknownItems,
  };
}

function quoteCsvValue(value) {
  const stringValue = String(value ?? '');

  if (!/[",\r\n]/u.test(stringValue)) {
    return stringValue;
  }

  return `"${stringValue.replace(/"/gu, '""')}"`;
}

export function toTradePriceReferenceCsv(rows) {
  const lines = [TRADE_PRICE_REFERENCE_COLUMNS.join(',')];

  for (const row of rows) {
    lines.push(TRADE_PRICE_REFERENCE_COLUMNS.map((column) => quoteCsvValue(row[column] ?? '')).join(','));
  }

  return `${lines.join('\n')}\n`;
}
