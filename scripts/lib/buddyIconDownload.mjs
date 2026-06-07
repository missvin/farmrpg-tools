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

const BUDDY_ICON_OBSERVATION_COLUMNS = [
  'item_name',
  'canonical_key',
  'generated_buddy_slug',
  'candidate_buddy_url',
  'page_title',
  'extraction_status',
  'observation_status',
  'icon_url',
  'icon_pathname',
  'icon_filename',
  'icon_asset_key',
  'farmrpg_item_id_candidate',
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

function validateHeaders(headers, expectedColumns, schemaLabel) {
  const missingColumns = expectedColumns.filter((column) => !headers.includes(column));
  const unexpectedColumns = headers.filter((header) => !expectedColumns.includes(header));

  if (missingColumns.length === 0 && unexpectedColumns.length === 0) {
    return true;
  }

  const details = [];

  if (missingColumns.length > 0) {
    details.push(`missing columns: ${missingColumns.join(', ')}`);
  }

  if (unexpectedColumns.length > 0) {
    details.push(`unexpected columns: ${unexpectedColumns.join(', ')}`);
  }

  throw new Error(`Invalid ${schemaLabel} CSV schema (${details.join('; ')}).`);
}

function detectSchema(headers) {
  try {
    validateHeaders(headers, BUDDY_ICON_OBSERVATION_COLUMNS, 'buddy icon observation');
    return 'observation';
  } catch {
    validateHeaders(headers, BUDDY_ICON_COLUMNS, 'buddy icon extraction');
    return 'extraction';
  }
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

export function parseBuddyIconSourceCsv(csvText) {
  const lines = csvText
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvRow(lines[0]).map(normalizeHeader);
  const schema = detectSchema(headers);

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
      iconAssetKey: schema === 'observation' ? readField(values, headerIndex, 'icon_asset_key').trim() || null : null,
      farmrpgItemIdCandidate:
        schema === 'observation' ? readField(values, headerIndex, 'farmrpg_item_id_candidate').trim() || null : null,
      observationStatus: schema === 'observation' ? readField(values, headerIndex, 'observation_status').trim() : '',
      imageUrlCount: Number(readField(values, headerIndex, 'image_url_count').trim() || '0'),
      flags: splitReviewField(readField(values, headerIndex, 'flags')),
      notes: splitReviewField(readField(values, headerIndex, 'notes')),
    };
  });
}

export function parseBuddyIconExtractionCsv(csvText) {
  return parseBuddyIconSourceCsv(csvText);
}

function evaluateStopCondition(metrics, options) {
  if (metrics.consecutiveFailures >= options.maxConsecutiveFailures) {
    return `Stopped after ${metrics.consecutiveFailures.toLocaleString()} consecutive failures.`;
  }

  if (metrics.totalFailures >= options.maxTotalFailures) {
    return `Stopped after ${metrics.totalFailures.toLocaleString()} total failures.`;
  }

  if (
    metrics.networkAttempts >= options.failureRateMinAttempts &&
    metrics.totalFailures / metrics.networkAttempts > options.maxFailureRate
  ) {
    return `Stopped because failure rate reached ${(metrics.totalFailures / metrics.networkAttempts * 100).toFixed(1)}% after ${metrics.networkAttempts.toLocaleString()} attempts.`;
  }

  return null;
}

function getInterRequestDelayMs(baseDelayMs, jitterMs, randomFn) {
  if (baseDelayMs <= 0) {
    return 0;
  }

  if (jitterMs <= 0) {
    return baseDelayMs;
  }

  return baseDelayMs + Math.floor(randomFn() * (jitterMs + 1));
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
  const randomFn = options.randomFn ?? Math.random;
  const cacheDir = options.cacheDir;
  const refresh = options.refresh ?? false;
  const interRequestDelayMs = options.interRequestDelayMs ?? 3000;
  const interRequestJitterMs = options.interRequestJitterMs ?? 500;
  const stopOptions = {
    maxConsecutiveFailures: options.maxConsecutiveFailures ?? 3,
    maxTotalFailures: options.maxTotalFailures ?? 5,
    maxFailureRate: options.maxFailureRate ?? 0.2,
    failureRateMinAttempts: options.failureRateMinAttempts ?? 10,
  };

  if (!cacheDir) {
    throw new Error('A cacheDir option is required for icon downloads.');
  }

  await mkdir(cacheDir, { recursive: true });

  const downloadableRows = iconRows.filter(
    (row) => row.iconUrl && (!row.observationStatus || row.observationStatus === 'observed'),
  );
  const cacheByIconUrl = new Map();
  const results = [];
  const metrics = {
    networkAttempts: 0,
    totalFailures: 0,
    consecutiveFailures: 0,
  };
  let guardStopReason = null;

  for (let index = 0; index < downloadableRows.length; index += 1) {
    const row = downloadableRows[index];

    if (guardStopReason) {
      results.push({
        itemName: row.itemName,
        canonicalKey: row.canonicalKey,
        generatedBuddySlug: row.generatedBuddySlug,
        candidateBuddyUrl: row.candidateBuddyUrl,
        iconUrl: row.iconUrl,
        iconPathname: row.iconPathname ?? null,
        iconFilename: row.iconFilename,
        iconAssetKey: row.iconAssetKey ?? null,
        farmrpgItemIdCandidate: row.farmrpgItemIdCandidate ?? null,
        localFilePath: null,
        localRelativePath: null,
        cacheFilename: null,
        httpStatus: null,
        cacheStatus: 'skipped_guard',
        flags: [...row.flags, 'stopped_by_guard'],
        notes: [...row.notes, guardStopReason],
      });
      continue;
    }

    if (cacheByIconUrl.has(row.iconUrl)) {
      const cachedResult = cacheByIconUrl.get(row.iconUrl);

      results.push({
        ...cachedResult,
        itemName: row.itemName,
        canonicalKey: row.canonicalKey,
        generatedBuddySlug: row.generatedBuddySlug,
        candidateBuddyUrl: row.candidateBuddyUrl,
        cacheStatus: 'reused',
        iconPathname: row.iconPathname ?? cachedResult.iconPathname ?? null,
        iconAssetKey: row.iconAssetKey ?? cachedResult.iconAssetKey ?? null,
        farmrpgItemIdCandidate: row.farmrpgItemIdCandidate ?? cachedResult.farmrpgItemIdCandidate ?? null,
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
      iconPathname: row.iconPathname ?? null,
      iconFilename: row.iconFilename,
      iconAssetKey: row.iconAssetKey ?? null,
      farmrpgItemIdCandidate: row.farmrpgItemIdCandidate ?? null,
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

    if (metrics.networkAttempts > 0) {
      await sleepFn(getInterRequestDelayMs(interRequestDelayMs, interRequestJitterMs, randomFn));
    }

    try {
      metrics.networkAttempts += 1;
      const response = await fetchFn(row.iconUrl);

      if (!response.ok) {
        metrics.totalFailures += 1;
        metrics.consecutiveFailures += 1;
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
        metrics.consecutiveFailures = 0;
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
      metrics.totalFailures += 1;
      metrics.consecutiveFailures += 1;
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

    guardStopReason = evaluateStopCondition(metrics, stopOptions);
  }

  const countsByStatus = results.reduce((counts, result) => {
    counts[result.cacheStatus] = (counts[result.cacheStatus] ?? 0) + 1;
    return counts;
  }, {});

  const reviewResults = results.filter((result) => result.cacheStatus === 'failed' || result.cacheStatus === 'skipped_guard');

  return {
    results,
    reviewResults,
    summary: {
      iconRowsProcessed: downloadableRows.length,
      uniqueIconUrls: cacheByIconUrl.size,
      countsByStatus,
      reviewCount: reviewResults.length,
      stoppedByGuard: guardStopReason !== null,
      guardStopReason,
      networkAttempts: metrics.networkAttempts,
      totalFailures: metrics.totalFailures,
      interRequestDelayMs,
      interRequestJitterMs,
    },
  };
}

export function toBuddyIconDownloadJson(downloadResult) {
  return JSON.stringify(downloadResult, null, 2);
}

export function toBuddyIconDownloadCsv(downloadResult) {
  const rows = [
    'item_name,canonical_key,generated_buddy_slug,candidate_buddy_url,icon_url,icon_pathname,icon_filename,icon_asset_key,farmrpg_item_id_candidate,cache_status,http_status,cache_filename,local_relative_path,flags,notes',
  ];

  for (const result of downloadResult.results) {
    rows.push(
      [
        result.itemName,
        result.canonicalKey,
        result.generatedBuddySlug,
        result.candidateBuddyUrl,
        result.iconUrl ?? '',
        result.iconPathname ?? '',
        result.iconFilename ?? '',
        result.iconAssetKey ?? '',
        result.farmrpgItemIdCandidate ?? '',
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
