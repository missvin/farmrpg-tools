import { access } from 'node:fs/promises';
import path from 'node:path';

import { parseBuddyIconSourceCsv } from './buddyIconDownload.mjs';

const BUDDY_ICON_DOWNLOAD_COLUMNS = [
  'item_name',
  'canonical_key',
  'generated_buddy_slug',
  'candidate_buddy_url',
  'icon_url',
  'icon_pathname',
  'icon_filename',
  'icon_asset_key',
  'farmrpg_item_id_candidate',
  'cache_status',
  'http_status',
  'cache_filename',
  'local_relative_path',
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

function escapeCsvValue(value) {
  if (/[",\n]/u.test(value)) {
    return `"${value.replace(/"/gu, '""')}"`;
  }

  return value;
}

function uniqueList(values) {
  return [...new Set(values.filter(Boolean))];
}

function toCatalogCanonicalItemKey(value) {
  return String(value ?? '')
    .replace(/[\u2018\u2019\u201a\u201b\u2032]/gu, "'")
    .replace(/[\u201c\u201d\u201e\u201f\u2033]/gu, '"')
    .toLowerCase()
    .trim()
    .replace(/\s+/gu, ' ');
}

function summarizeBuddyIconManifestResults(results, itemRowsProcessed = results.length) {
  const reviewResults = results.filter((result) => result.manifestStatus !== 'ready');
  const cleanResults = results.filter((result) => result.manifestStatus === 'ready');

  return {
    itemRowsProcessed,
    cleanManifestRowCount: cleanResults.length,
    reviewCount: reviewResults.length,
    sharedAssetReuseRowCount: cleanResults.filter((result) => result.sharedAssetReuse).length,
    sharedAssetGroupCount: uniqueList(
      cleanResults.filter((result) => result.sharedAssetItemCount > 1).map((result) => result.localRelativePath),
    ).length,
    extraDownloadRowCount: results.filter((result) => (result.flags ?? []).includes('extra_download_row')).length,
    duplicateDownloadRowCount: results.filter((result) => (result.flags ?? []).includes('duplicate_download_row')).length,
  };
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function parseBuddyIconDownloadCsv(csvText) {
  const lines = csvText
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvRow(lines[0]).map(normalizeHeader);
  const missingColumns = BUDDY_ICON_DOWNLOAD_COLUMNS.filter((column) => !headers.includes(column));

  if (missingColumns.length > 0) {
    throw new Error(`Invalid buddy icon download CSV schema (missing columns: ${missingColumns.join(', ')}).`);
  }

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
      iconUrl: readField(values, headerIndex, 'icon_url').trim() || null,
      iconPathname: readField(values, headerIndex, 'icon_pathname').trim() || null,
      iconFilename: readField(values, headerIndex, 'icon_filename').trim() || null,
      iconAssetKey: readField(values, headerIndex, 'icon_asset_key').trim() || null,
      farmrpgItemIdCandidate: readField(values, headerIndex, 'farmrpg_item_id_candidate').trim() || null,
      cacheStatus: readField(values, headerIndex, 'cache_status').trim(),
      httpStatus: readField(values, headerIndex, 'http_status').trim() || null,
      cacheFilename: readField(values, headerIndex, 'cache_filename').trim() || null,
      localRelativePath: readField(values, headerIndex, 'local_relative_path').trim() || null,
      flags: splitReviewField(readField(values, headerIndex, 'flags')),
      notes: splitReviewField(readField(values, headerIndex, 'notes')),
    };
  });
}

export async function deriveBuddyIconManifest(observationCsvText, downloadCsvText, options = {}) {
  const repoRoot = options.repoRoot ?? process.cwd();
  const observationRows = parseBuddyIconSourceCsv(observationCsvText);
  const downloadRows = parseBuddyIconDownloadCsv(downloadCsvText);
  const downloadRowByCanonicalKey = new Map();
  const duplicateDownloadRows = [];

  for (const row of downloadRows) {
    if (!row.canonicalKey) {
      duplicateDownloadRows.push(row);
      continue;
    }

    if (downloadRowByCanonicalKey.has(row.canonicalKey)) {
      duplicateDownloadRows.push(row);
      continue;
    }

    downloadRowByCanonicalKey.set(row.canonicalKey, row);
  }

  const sharedAssetCounts = downloadRows.reduce((counts, row) => {
    if (!row.localRelativePath) {
      return counts;
    }

    counts[row.localRelativePath] = (counts[row.localRelativePath] ?? 0) + 1;
    return counts;
  }, {});

  const matchedCanonicalKeys = new Set();
  const results = [];

  for (const observationRow of observationRows) {
    const downloadRow = downloadRowByCanonicalKey.get(observationRow.canonicalKey);
    const flags = uniqueList([...(observationRow.flags ?? []), ...(downloadRow?.flags ?? [])]);
    const notes = [...(observationRow.notes ?? []), ...(downloadRow?.notes ?? [])];
    const reviewNotes = [];

    if (observationRow.observationStatus !== 'observed') {
      reviewNotes.push('The icon observation row is not marked observed.');
    }

    if (!downloadRow) {
      reviewNotes.push('No download/cache row was found for this canonical item.');
    } else {
      matchedCanonicalKeys.add(observationRow.canonicalKey);

      if (!downloadRow.localRelativePath) {
        reviewNotes.push('The download/cache row did not provide a local cache path.');
      } else if (!(await fileExists(path.resolve(repoRoot, downloadRow.localRelativePath)))) {
        reviewNotes.push('The manifest expected a cached local icon file, but it was not present on disk.');
      }

      if (downloadRow.cacheStatus === 'failed' || downloadRow.cacheStatus === 'skipped_guard') {
        reviewNotes.push(`The download/cache row remained in ${downloadRow.cacheStatus} state.`);
      }
    }

    const manifestStatus = reviewNotes.length === 0 ? 'ready' : 'review_needed';
    results.push({
      itemName: observationRow.itemName,
      canonicalKey: observationRow.canonicalKey,
      generatedBuddySlug: observationRow.generatedBuddySlug,
      candidateBuddyUrl: observationRow.candidateBuddyUrl,
      pageTitle: observationRow.pageTitle ?? null,
      manifestStatus,
      cacheStatus: downloadRow?.cacheStatus ?? null,
      iconUrl: observationRow.iconUrl ?? downloadRow?.iconUrl ?? null,
      iconPathname: observationRow.iconPathname ?? downloadRow?.iconPathname ?? null,
      iconFilename: observationRow.iconFilename ?? downloadRow?.iconFilename ?? null,
      iconAssetKey: observationRow.iconAssetKey ?? downloadRow?.iconAssetKey ?? null,
      farmrpgItemIdCandidate: observationRow.farmrpgItemIdCandidate ?? downloadRow?.farmrpgItemIdCandidate ?? null,
      cacheFilename: downloadRow?.cacheFilename ?? null,
      localRelativePath: downloadRow?.localRelativePath ?? null,
      sharedAssetItemCount: downloadRow?.localRelativePath ? sharedAssetCounts[downloadRow.localRelativePath] ?? 1 : 0,
      sharedAssetReuse: downloadRow?.cacheStatus === 'reused',
      flags,
      notes: uniqueList([...notes, ...reviewNotes]),
    });
  }

  for (const downloadRow of downloadRows) {
    if (matchedCanonicalKeys.has(downloadRow.canonicalKey)) {
      continue;
    }

    results.push({
      itemName: downloadRow.itemName,
      canonicalKey: downloadRow.canonicalKey,
      generatedBuddySlug: downloadRow.generatedBuddySlug,
      candidateBuddyUrl: downloadRow.candidateBuddyUrl,
      pageTitle: null,
      manifestStatus: 'review_needed',
      cacheStatus: downloadRow.cacheStatus,
      iconUrl: downloadRow.iconUrl,
      iconPathname: downloadRow.iconPathname,
      iconFilename: downloadRow.iconFilename,
      iconAssetKey: downloadRow.iconAssetKey,
      farmrpgItemIdCandidate: downloadRow.farmrpgItemIdCandidate,
      cacheFilename: downloadRow.cacheFilename,
      localRelativePath: downloadRow.localRelativePath,
      sharedAssetItemCount: downloadRow.localRelativePath ? sharedAssetCounts[downloadRow.localRelativePath] ?? 1 : 0,
      sharedAssetReuse: downloadRow.cacheStatus === 'reused',
      flags: uniqueList([...(downloadRow.flags ?? []), 'extra_download_row']),
      notes: uniqueList([...(downloadRow.notes ?? []), 'A download/cache row existed without a matching observed icon row.']),
    });
  }

  for (const duplicateDownloadRow of duplicateDownloadRows) {
    results.push({
      itemName: duplicateDownloadRow.itemName,
      canonicalKey: duplicateDownloadRow.canonicalKey,
      generatedBuddySlug: duplicateDownloadRow.generatedBuddySlug,
      candidateBuddyUrl: duplicateDownloadRow.candidateBuddyUrl,
      pageTitle: null,
      manifestStatus: 'review_needed',
      cacheStatus: duplicateDownloadRow.cacheStatus,
      iconUrl: duplicateDownloadRow.iconUrl,
      iconPathname: duplicateDownloadRow.iconPathname,
      iconFilename: duplicateDownloadRow.iconFilename,
      iconAssetKey: duplicateDownloadRow.iconAssetKey,
      farmrpgItemIdCandidate: duplicateDownloadRow.farmrpgItemIdCandidate,
      cacheFilename: duplicateDownloadRow.cacheFilename,
      localRelativePath: duplicateDownloadRow.localRelativePath,
      sharedAssetItemCount: duplicateDownloadRow.localRelativePath ? sharedAssetCounts[duplicateDownloadRow.localRelativePath] ?? 1 : 0,
      sharedAssetReuse: duplicateDownloadRow.cacheStatus === 'reused',
      flags: uniqueList([...(duplicateDownloadRow.flags ?? []), 'duplicate_download_row']),
      notes: uniqueList([...(duplicateDownloadRow.notes ?? []), 'Multiple download/cache rows mapped to the same canonical item.']),
    });
  }

  const reviewResults = results.filter((result) => result.manifestStatus !== 'ready');
  const cleanResults = results.filter((result) => result.manifestStatus === 'ready');

  return {
    results,
    reviewResults,
    summary: summarizeBuddyIconManifestResults(results, observationRows.length),
  };
}

export function mergeBuddyIconManifestResults(existingManifest, manifestResult) {
  const resultsByCanonicalKey = new Map(
    (existingManifest.results ?? []).map((entry) => [entry.canonicalKey, entry]),
  );

  for (const result of manifestResult.results) {
    const canonicalKey = toCatalogCanonicalItemKey(result.itemName);

    for (const [existingKey, existingResult] of resultsByCanonicalKey) {
      if (existingKey !== canonicalKey && toCatalogCanonicalItemKey(existingResult.itemName) === canonicalKey) {
        resultsByCanonicalKey.delete(existingKey);
      }
    }

    resultsByCanonicalKey.set(canonicalKey, {
      ...result,
      canonicalKey,
    });
  }

  const results = [...resultsByCanonicalKey.values()].sort((left, right) =>
    left.itemName.localeCompare(right.itemName),
  );

  return {
    results,
    reviewResults: results.filter((result) => result.manifestStatus !== 'ready'),
    summary: summarizeBuddyIconManifestResults(results),
  };
}

export function toBuddyIconManifestJson(manifestResult) {
  return JSON.stringify(manifestResult, null, 2);
}

export function toBuddyIconManifestCsv(manifestResult) {
  const rows = [
    'item_name,canonical_key,generated_buddy_slug,candidate_buddy_url,page_title,manifest_status,cache_status,icon_url,icon_pathname,icon_filename,icon_asset_key,farmrpg_item_id_candidate,cache_filename,local_relative_path,shared_asset_item_count,shared_asset_reuse,flags,notes',
  ];

  for (const result of manifestResult.results) {
    rows.push(
      [
        result.itemName,
        result.canonicalKey,
        result.generatedBuddySlug,
        result.candidateBuddyUrl,
        result.pageTitle ?? '',
        result.manifestStatus,
        result.cacheStatus ?? '',
        result.iconUrl ?? '',
        result.iconPathname ?? '',
        result.iconFilename ?? '',
        result.iconAssetKey ?? '',
        result.farmrpgItemIdCandidate ?? '',
        result.cacheFilename ?? '',
        result.localRelativePath ?? '',
        String(result.sharedAssetItemCount ?? 0),
        result.sharedAssetReuse ? 'true' : 'false',
        result.flags.join('; '),
        result.notes.join('; '),
      ]
        .map(escapeCsvValue)
        .join(','),
    );
  }

  return rows.join('\n');
}

export function toBuddyIconManifestReviewCsv(manifestResult) {
  return toBuddyIconManifestCsv({
    ...manifestResult,
    results: manifestResult.reviewResults,
  });
}
