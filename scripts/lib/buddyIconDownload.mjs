import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const BUDDY_ICON_COLUMNS = [
  'item_name',
  'canonical_key',
  'generated_buddy_slug',
  'candidate_buddy_url',
  'extraction_status',
  'http_status',
  'page_title',
  'icon_url',
  'icon_pathname',
  'icon_filename',
  'image_url_count',
  'flags',
  'notes',
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

function validateHeaders(headers) {
  const missingColumns = BUDDY_ICON_COLUMNS.filter((column) => !headers.includes(column));
  const unexpectedColumns = headers.filter((header) => !BUDDY_ICON_COLUMNS.includes(header));

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

  throw new Error(`Invalid buddy icon extraction CSV schema (${details.join('; ')}).`);
}

function escapeCsvValue(value) {
  if (/[",\n]/u.test(value)) {
    return `"${value.replace(/"/gu, '""')}"`;
  }

  return value;
}

function normalizeExtension(filename) {
  const extension = path.extname(filename).toLowerCase();

  if (extension === '.jpeg') {
    return '.jpg';
  }

  return extension || '.png';
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function parseBuddyIconExtractionCsv(csvText) {
  const lines = csvText
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvRow(lines[0]).map(normalizeHeader);
  validateHeaders(headers);

  const headerIndex = headers.reduce((indexByHeader, header, index) => {
    indexByHeader[header] = index;
    return indexByHeader;
  }, {});

  return lines.slice(1).map((line) => {
    const values = parseCsvRow(line);

    return {
      itemName: readField(values, headerIndex, 'item_name').trim(),
      canonicalKey: readField(values, headerIndex, 'canonical_key').trim(),
      generatedBuddySlug: readField(values, headerIndex, 'generated_buddy_slug').trim(),
      candidateBuddyUrl: readField(values, headerIndex, 'candidate_buddy_url').trim(),
      extractionStatus: readField(values, headerIndex, 'extraction_status').trim(),
      httpStatus: readField(values, headerIndex, 'http_status').trim(),
      pageTitle: readField(values, headerIndex, 'page_title').trim() || null,
      iconUrl: readField(values, headerIndex, 'icon_url').trim() || null,
      iconPathname: readField(values, headerIndex, 'icon_pathname').trim() || null,
      iconFilename: readField(values, headerIndex, 'icon_filename').trim() || null,
      imageUrlCount: Number(readField(values, headerIndex, 'image_url_count').trim() || '0'),
      flags: splitReviewField(readField(values, headerIndex, 'flags')),
      notes: splitReviewField(readField(values, headerIndex, 'notes')),
    };
  });
}

export function buildBuddyIconCacheFilename(iconRow) {
  const extension = normalizeExtension(iconRow.iconFilename ?? '');
  const hash = createHash('sha1').update(iconRow.iconUrl ?? '').digest('hex').slice(0, 12);
  const baseName = iconRow.iconFilename ? path.basename(iconRow.iconFilename, path.extname(iconRow.iconFilename)) : 'icon';
  const safeBaseName = baseName.replace(/[^a-z0-9._-]+/giu, '-').replace(/-+/gu, '-').replace(/^-|-$/gu, '') || 'icon';

  return `${safeBaseName}-${hash}${extension}`;
}

export async function downloadBuddyItemIcons(iconRows, options = {}) {
  const fetchFn = options.fetchFn ?? fetch;
  const sleepFn = options.sleepFn ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const cacheDir = options.cacheDir;
  const refresh = options.refresh ?? false;
  const interRequestDelayMs = options.interRequestDelayMs ?? 500;

  if (!cacheDir) {
    throw new Error('A cacheDir option is required for icon downloads.');
  }

  await mkdir(cacheDir, { recursive: true });

  const downloadableRows = iconRows.filter((row) => row.extractionStatus === 'icon_found' && row.iconUrl);
  const cacheByIconUrl = new Map();
  const results = [];

  for (let index = 0; index < downloadableRows.length; index += 1) {
    const row = downloadableRows[index];

    if (cacheByIconUrl.has(row.iconUrl)) {
      const cachedResult = cacheByIconUrl.get(row.iconUrl);

      results.push({
        ...cachedResult,
        itemName: row.itemName,
        canonicalKey: row.canonicalKey,
        generatedBuddySlug: row.generatedBuddySlug,
        candidateBuddyUrl: row.candidateBuddyUrl,
        cacheStatus: 'reused',
      });
      continue;
    }

    const filename = buildBuddyIconCacheFilename(row);
    const localFilePath = path.join(cacheDir, filename);
    const localRelativePath = path.relative(process.cwd(), localFilePath).replace(/\\/gu, '/');
    const baseResult = {
      itemName: row.itemName,
      canonicalKey: row.canonicalKey,
      generatedBuddySlug: row.generatedBuddySlug,
      candidateBuddyUrl: row.candidateBuddyUrl,
      iconUrl: row.iconUrl,
      iconFilename: row.iconFilename,
      localFilePath,
      localRelativePath,
      cacheFilename: filename,
      httpStatus: null,
      flags: [...row.flags],
      notes: [...row.notes],
    };

    if (!refresh && (await fileExists(localFilePath))) {
      const result = {
        ...baseResult,
        cacheStatus: 'existing',
      };

      cacheByIconUrl.set(row.iconUrl, result);
      results.push(result);
      continue;
    }

    try {
      const response = await fetchFn(row.iconUrl);

      if (!response.ok) {
        const result = {
          ...baseResult,
          cacheStatus: 'failed',
          httpStatus: response.status,
          flags: [...baseResult.flags, `http_${response.status}`],
          notes: [...baseResult.notes, `Expected a successful icon download but received HTTP ${response.status}.`],
        };

        cacheByIconUrl.set(row.iconUrl, result);
        results.push(result);
      } else {
        const arrayBuffer = await response.arrayBuffer();
        await writeFile(localFilePath, Buffer.from(arrayBuffer));

        const result = {
          ...baseResult,
          cacheStatus: 'downloaded',
          httpStatus: response.status,
        };

        cacheByIconUrl.set(row.iconUrl, result);
        results.push(result);
      }
    } catch (error) {
      const result = {
        ...baseResult,
        cacheStatus: 'failed',
        httpStatus: null,
        flags: [...baseResult.flags, 'fetch_error'],
        notes: [...baseResult.notes, error instanceof Error ? error.message : 'Unknown icon download failure.'],
      };

      cacheByIconUrl.set(row.iconUrl, result);
      results.push(result);
    }

    if (index < downloadableRows.length - 1) {
      await sleepFn(interRequestDelayMs);
    }
  }

  const countsByStatus = results.reduce((counts, result) => {
    counts[result.cacheStatus] = (counts[result.cacheStatus] ?? 0) + 1;
    return counts;
  }, {});

  const reviewResults = results.filter((result) => result.cacheStatus === 'failed');

  return {
    results,
    reviewResults,
    summary: {
      iconRowsProcessed: downloadableRows.length,
      uniqueIconUrls: cacheByIconUrl.size,
      countsByStatus,
      reviewCount: reviewResults.length,
    },
  };
}

export function toBuddyIconDownloadJson(downloadResult) {
  return JSON.stringify(downloadResult, null, 2);
}

export function toBuddyIconDownloadCsv(downloadResult) {
  const rows = [
    'item_name,canonical_key,generated_buddy_slug,candidate_buddy_url,icon_url,cache_status,http_status,cache_filename,local_relative_path,flags,notes',
  ];

  for (const result of downloadResult.results) {
    rows.push(
      [
        result.itemName,
        result.canonicalKey,
        result.generatedBuddySlug,
        result.candidateBuddyUrl,
        result.iconUrl ?? '',
        result.cacheStatus,
        result.httpStatus === null ? '' : String(result.httpStatus),
        result.cacheFilename ?? '',
        result.localRelativePath ?? '',
        result.flags.join('; '),
        result.notes.join('; '),
      ]
        .map(escapeCsvValue)
        .join(','),
    );
  }

  return rows.join('\n');
}

export function toBuddyIconDownloadReviewCsv(downloadResult) {
  return toBuddyIconDownloadCsv({
    ...downloadResult,
    results: downloadResult.reviewResults,
  });
}
