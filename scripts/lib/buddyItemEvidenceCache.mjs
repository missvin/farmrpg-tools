export const BUDDY_ITEM_EVIDENCE_CACHE_SCHEMA_VERSION = 1;
export const BUDDY_ITEM_EVIDENCE_EXTRACTION_VERSION = 'buddy-item-evidence-cache-v1';
export const DEFAULT_BUDDY_ITEM_EVIDENCE_DELAY_MS = 5000;
export const MIN_BUDDY_ITEM_EVIDENCE_DELAY_MS = 3000;
export const DEFAULT_BUDDY_ITEM_EVIDENCE_LIMIT = 10;
export const MAX_BUDDY_ITEM_EVIDENCE_LIMIT = 25;

const TARGET_COLUMNS = ['item_name', 'canonical_key', 'buddy_url', 'notes'];
const PROBE_RESULT_COLUMNS = [
  'item_name',
  'canonical_key',
  'generated_buddy_slug',
  'candidate_buddy_url',
  'probe_status',
  'http_status',
  'final_url',
  'page_title',
  'attempts',
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

function validateKnownHeaders(headers, expectedColumns, label) {
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

function inferCsvSchema(headers) {
  const hasTargetColumns = TARGET_COLUMNS.every((column) => headers.includes(column));
  const hasProbeColumns = PROBE_RESULT_COLUMNS.every((column) => headers.includes(column));

  if (hasTargetColumns) {
    validateKnownHeaders(headers, TARGET_COLUMNS, 'buddy item evidence target CSV');
    return 'target';
  }

  if (hasProbeColumns) {
    validateKnownHeaders(headers, PROBE_RESULT_COLUMNS, 'buddy probe results CSV');
    return 'probe_result';
  }

  throw new Error(
    'Invalid buddy item evidence target CSV schema (expected item_name,canonical_key,buddy_url,notes or a buddy probe results CSV).',
  );
}

export function toCanonicalItemKey(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[’`]/gu, "'")
    .replace(/&/gu, 'and')
    .replace(/[^a-z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '');
}

function normalizeBuddyUrl(value) {
  try {
    return new URL(value, 'https://buddy.farm').href;
  } catch {
    return value;
  }
}

function normalizeTargetUrl(values, headerIndex) {
  return normalizeBuddyUrl(
    readField(values, headerIndex, 'buddy_url').trim() ||
      readField(values, headerIndex, 'final_url').trim() ||
      readField(values, headerIndex, 'candidate_buddy_url').trim(),
  );
}

export function parseBuddyItemEvidenceTargetCsv(csvText) {
  const lines = csvText
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvRow(lines[0]).map(normalizeHeader);
  const schema = inferCsvSchema(headers);
  const headerIndex = headers.reduce((indexByHeader, header, index) => {
    indexByHeader[header] = index;
    return indexByHeader;
  }, {});

  return lines
    .slice(1)
    .map((line) => {
      const values = parseCsvRow(line);
      const itemName = readField(values, headerIndex, 'item_name').trim();
      const canonicalKey = readField(values, headerIndex, 'canonical_key').trim() || toCanonicalItemKey(itemName);
      const buddyUrl = normalizeTargetUrl(values, headerIndex);
      const probeStatus = readField(values, headerIndex, 'probe_status').trim();

      return {
        itemName,
        canonicalKey,
        buddyUrl,
        sourceSchema: schema,
        sourceProbeStatus: probeStatus || null,
        notes: splitReviewField(readField(values, headerIndex, 'notes')),
      };
    })
    .filter(
      (target) =>
        target.itemName &&
        target.buddyUrl &&
        (target.sourceSchema !== 'probe_result' || target.sourceProbeStatus === 'found'),
    );
}

export function getBuddyItemPageDataUrl(buddyUrl) {
  const parsedUrl = new URL(buddyUrl);

  if (parsedUrl.hostname !== 'buddy.farm') {
    throw new Error(`Expected a buddy.farm URL but received ${buddyUrl}.`);
  }

  const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
  const [pageType, slug] = pathParts;

  if (pageType !== 'i' || !slug || pathParts.length !== 2) {
    throw new Error(`Expected a buddy item URL shaped like /i/<slug>/ but received ${buddyUrl}.`);
  }

  return `https://buddy.farm/page-data/i/${slug}/page-data.json`;
}

export function getBuddyItemSlug(buddyUrl) {
  try {
    const pathParts = new URL(buddyUrl).pathname.split('/').filter(Boolean);
    return pathParts[0] === 'i' ? pathParts[1] ?? '' : '';
  } catch {
    return '';
  }
}

function toSafeFilePart(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 80);
}

export function getBuddyItemEvidenceCacheKey(target) {
  const canonicalKey = target.canonicalKey || toCanonicalItemKey(target.itemName);
  const slug = getBuddyItemSlug(target.buddyUrl);
  const canonicalPart = toSafeFilePart(canonicalKey) || 'unknown-item';
  const slugPart = toSafeFilePart(slug) || 'unknown-slug';
  return `${canonicalPart}__${slugPart}`;
}

export function getBuddyItemEvidenceFileName(target) {
  return `${getBuddyItemEvidenceCacheKey(target)}.json`;
}

function hasNonEmptyValue(value) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return Boolean(value && typeof value === 'object' && Object.keys(value).length > 0);
}

function summarizeItemPayload(item) {
  if (!item) {
    return {
      detectedSections: [],
      sourceStatus: 'uncertain',
      blankSourceIndicators: ['missing_farmrpg_item_payload'],
    };
  }

  const detectedSections = Object.entries(item)
    .filter(([, value]) => hasNonEmptyValue(value))
    .map(([key]) => key)
    .sort();

  const sourceLikeSections = detectedSections.filter((key) =>
    /drop|rate|recipe|used|pet|well|source|open|box|chest|crate|content|location|quest/iu.test(key),
  );

  if (sourceLikeSections.length === 0) {
    return {
      detectedSections,
      sourceStatus: 'sources_blank',
      blankSourceIndicators: ['no_nonempty_known_source_sections'],
    };
  }

  return {
    detectedSections,
    sourceStatus: 'sources_present',
    blankSourceIndicators: [],
  };
}

export function summarizeBuddyItemPageData(pageData) {
  const farmrpgData = pageData?.result?.data?.farmrpg ?? null;
  const item = farmrpgData?.items?.[0] ?? null;
  const pageTitle =
    pageData?.result?.pageContext?.title ??
    pageData?.result?.data?.site?.siteMetadata?.title ??
    item?.name ??
    null;
  const itemSummary = summarizeItemPayload(item);

  return {
    pageTitle,
    buddyItemName: item?.name ?? null,
    buddyItemId: item?.id === undefined || item?.id === null ? null : String(item.id),
    buddyItemImage: item?.image ?? null,
    detectedSections: itemSummary.detectedSections,
    sourceStatus: itemSummary.sourceStatus,
    blankSourceIndicators: itemSummary.blankSourceIndicators,
  };
}

export function createBuddyItemEvidenceRecord(target, details) {
  const pageData = details.pageData ?? null;
  const pageSummary = pageData ? summarizeBuddyItemPageData(pageData) : null;
  const fetchError = details.fetchError ?? null;

  return {
    schemaVersion: BUDDY_ITEM_EVIDENCE_CACHE_SCHEMA_VERSION,
    evidenceType: 'buddy_item_page_data',
    extractionVersion: BUDDY_ITEM_EVIDENCE_EXTRACTION_VERSION,
    fetchedAt: details.fetchedAt,
    httpStatus: details.httpStatus,
    itemName: target.itemName,
    canonicalKey: target.canonicalKey || toCanonicalItemKey(target.itemName),
    buddyUrl: target.buddyUrl,
    pageDataUrl: details.pageDataUrl ?? getBuddyItemPageDataUrl(target.buddyUrl),
    pageTitle: pageSummary?.pageTitle ?? null,
    buddyItemName: pageSummary?.buddyItemName ?? null,
    buddyItemId: pageSummary?.buddyItemId ?? null,
    buddyItemImage: pageSummary?.buddyItemImage ?? null,
    sourceStatus: pageSummary?.sourceStatus ?? 'uncertain',
    blankSourceIndicators: pageSummary?.blankSourceIndicators ?? (fetchError ? ['fetch_error'] : []),
    detectedSections: pageSummary?.detectedSections ?? [],
    reviewNotes: [...(target.notes ?? []), ...(details.notes ?? [])],
    fetchError,
    pageData,
  };
}

function parseTimestamp(value) {
  const timestamp = Date.parse(value ?? '');
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function isFreshBuddyItemEvidence(evidence, options = {}) {
  const nowMs = options.nowMs ?? Date.now();
  const maxAgeDays = options.maxAgeDays ?? 30;
  const fetchedAtMs = parseTimestamp(evidence?.fetchedAt);

  if (!fetchedAtMs || evidence?.httpStatus !== 200) {
    return false;
  }

  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  return nowMs - fetchedAtMs <= maxAgeMs;
}

export function normalizeBuddyItemEvidenceOptions(options = {}) {
  const delayMs = options.delayMs ?? DEFAULT_BUDDY_ITEM_EVIDENCE_DELAY_MS;
  const limit = options.limit ?? DEFAULT_BUDDY_ITEM_EVIDENCE_LIMIT;
  const maxAgeDays = options.maxAgeDays ?? 30;

  if (!Number.isFinite(delayMs) || delayMs < MIN_BUDDY_ITEM_EVIDENCE_DELAY_MS) {
    throw new Error(
      `Use --delay-ms ${MIN_BUDDY_ITEM_EVIDENCE_DELAY_MS.toLocaleString()} or greater so buddy.farm is refreshed respectfully.`,
    );
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_BUDDY_ITEM_EVIDENCE_LIMIT) {
    throw new Error(
      `Use --limit between 1 and ${MAX_BUDDY_ITEM_EVIDENCE_LIMIT.toLocaleString()} for bounded Buddy evidence cache runs.`,
    );
  }

  if (!Number.isFinite(maxAgeDays) || maxAgeDays < 1) {
    throw new Error('Use --max-age-days 1 or greater so fresh cache entries are not rechecked unnecessarily.');
  }

  return {
    delayMs,
    limit,
    maxAgeDays,
    dryRun: options.dryRun === true,
    force: options.force === true,
    nowMs: options.nowMs ?? Date.now(),
  };
}

export function buildBuddyItemEvidenceCachePlan(targets, existingEvidenceByCacheKey = {}, options = {}) {
  const normalizedOptions = normalizeBuddyItemEvidenceOptions(options);
  let plannedFetchCount = 0;
  let fetchCandidateCount = 0;
  const entries = targets.map((target, index) => {
    const cacheKey = getBuddyItemEvidenceCacheKey(target);
    const cacheFileName = getBuddyItemEvidenceFileName(target);
    const existingEvidence = existingEvidenceByCacheKey[cacheKey] ?? null;

    try {
      const pageDataUrl = getBuddyItemPageDataUrl(target.buddyUrl);

      if (!normalizedOptions.force && isFreshBuddyItemEvidence(existingEvidence, normalizedOptions)) {
        return {
          index,
          target,
          cacheKey,
          cacheFileName,
          pageDataUrl,
          action: 'skip_fresh',
          reason: `Cached evidence is newer than ${normalizedOptions.maxAgeDays.toLocaleString()} days.`,
          existingFetchedAt: existingEvidence.fetchedAt,
        };
      }

      fetchCandidateCount += 1;
      if (plannedFetchCount >= normalizedOptions.limit) {
        return {
          index,
          target,
          cacheKey,
          cacheFileName,
          pageDataUrl,
          action: 'deferred_limit',
          reason: `Deferred because this run is limited to ${normalizedOptions.limit.toLocaleString()} fetches.`,
          existingFetchedAt: existingEvidence?.fetchedAt ?? '',
        };
      }

      plannedFetchCount += 1;
      return {
        index,
        target,
        cacheKey,
        cacheFileName,
        pageDataUrl,
        action: normalizedOptions.dryRun ? 'would_fetch' : 'fetch',
        reason: existingEvidence ? (normalizedOptions.force ? 'Forced refresh requested.' : 'Cached evidence is stale.') : 'No cached evidence found.',
        existingFetchedAt: existingEvidence?.fetchedAt ?? '',
      };
    } catch (error) {
      return {
        index,
        target,
        cacheKey,
        cacheFileName,
        pageDataUrl: '',
        action: 'error',
        reason: error instanceof Error ? error.message : 'Unknown planning failure.',
        existingFetchedAt: existingEvidence?.fetchedAt ?? '',
      };
    }
  });

  const countsByAction = entries.reduce((counts, entry) => {
    counts[entry.action] = (counts[entry.action] ?? 0) + 1;
    return counts;
  }, {});

  return {
    entries,
    summary: {
      targetsAvailable: targets.length,
      targetsPlanned: entries.length,
      fetchesPlanned: plannedFetchCount,
      fetchCandidatesAvailable: fetchCandidateCount,
      limitApplied: fetchCandidateCount > plannedFetchCount,
      countsByAction,
      warnings: [
        ...(fetchCandidateCount > plannedFetchCount
          ? [
              `Limited run to ${plannedFetchCount.toLocaleString()} fetches of ${fetchCandidateCount.toLocaleString()} fetchable targets. Re-run to continue the cache-first batch.`,
            ]
          : []),
      ],
    },
  };
}

function createResultFromPlanEntry(entry, fields = {}) {
  return {
    itemName: entry.target.itemName,
    canonicalKey: entry.target.canonicalKey,
    buddyUrl: entry.target.buddyUrl,
    pageDataUrl: entry.pageDataUrl,
    cacheKey: entry.cacheKey,
    cacheFileName: entry.cacheFileName,
    action: entry.action,
    status: fields.status ?? entry.action,
    httpStatus: fields.httpStatus ?? null,
    sourceStatus: fields.sourceStatus ?? '',
    fetchedAt: fields.fetchedAt ?? '',
    flags: fields.flags ?? [],
    notes: fields.notes ?? [entry.reason].filter(Boolean),
    evidence: fields.evidence ?? null,
  };
}

export async function cacheBuddyItemEvidenceTargets(targets, options = {}) {
  const normalizedOptions = normalizeBuddyItemEvidenceOptions(options);
  const fetchFn = options.fetchFn ?? fetch;
  const sleepFn = options.sleepFn ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const nowIso = options.nowIso ?? new Date(normalizedOptions.nowMs).toISOString();
  const existingEvidenceByCacheKey = options.existingEvidenceByCacheKey ?? {};
  const plan = buildBuddyItemEvidenceCachePlan(targets, existingEvidenceByCacheKey, normalizedOptions);
  const results = [];
  const fetchEntries = plan.entries.filter((entry) => entry.action === 'fetch');

  for (const entry of plan.entries) {
    if (entry.action !== 'fetch') {
      results.push(createResultFromPlanEntry(entry));
      continue;
    }

    try {
      const response = await fetchFn(entry.pageDataUrl, {
        method: 'GET',
        headers: {
          accept: 'application/json',
        },
      });

      if (!response.ok) {
        const evidence = createBuddyItemEvidenceRecord(entry.target, {
          fetchedAt: nowIso,
          httpStatus: response.status,
          pageDataUrl: entry.pageDataUrl,
          notes: [`Expected a successful Buddy page-data fetch but received HTTP ${response.status}.`],
        });

        results.push(
          createResultFromPlanEntry(entry, {
            status: 'http_error',
            httpStatus: response.status,
            sourceStatus: evidence.sourceStatus,
            fetchedAt: nowIso,
            flags: [`http_${response.status}`],
            notes: evidence.reviewNotes,
            evidence,
          }),
        );
      } else {
        const pageData = await response.json();
        const evidence = createBuddyItemEvidenceRecord(entry.target, {
          fetchedAt: nowIso,
          httpStatus: response.status,
          pageDataUrl: entry.pageDataUrl,
          pageData,
        });

        results.push(
          createResultFromPlanEntry(entry, {
            status: 'cached',
            httpStatus: response.status,
            sourceStatus: evidence.sourceStatus,
            fetchedAt: nowIso,
            flags: evidence.sourceStatus === 'sources_blank' ? ['sources_blank'] : [],
            notes: evidence.reviewNotes,
            evidence,
          }),
        );
      }
    } catch (error) {
      const evidence = createBuddyItemEvidenceRecord(entry.target, {
        fetchedAt: nowIso,
        httpStatus: null,
        pageDataUrl: entry.pageDataUrl,
        fetchError: error instanceof Error ? error.message : 'Unknown fetch failure.',
      });

      results.push(
        createResultFromPlanEntry(entry, {
          status: 'fetch_error',
          sourceStatus: evidence.sourceStatus,
          fetchedAt: nowIso,
          flags: ['fetch_error'],
          notes: evidence.reviewNotes,
          evidence,
        }),
      );
    }

    const fetchedCount = results.filter((result) => result.action === 'fetch').length;
    if (fetchedCount < fetchEntries.length) {
      await sleepFn(normalizedOptions.delayMs);
    }
  }

  const reviewResults = results.filter(
    (result) =>
      ['error', 'http_error', 'fetch_error'].includes(result.status) ||
      ['sources_blank', 'uncertain'].includes(result.sourceStatus),
  );
  const countsByStatus = results.reduce((counts, result) => {
    counts[result.status] = (counts[result.status] ?? 0) + 1;
    return counts;
  }, {});

  return {
    plan,
    results,
    reviewResults,
    summary: {
      targetsProcessed: results.length,
      evidenceCached: results.filter((result) => result.status === 'cached').length,
      reviewCount: reviewResults.length,
      countsByStatus,
      warnings: [
        ...plan.summary.warnings,
        ...(reviewResults.length > 0
          ? [`${reviewResults.length.toLocaleString()} cached evidence results need review before parser promotion.`]
          : []),
      ],
    },
  };
}

export function toBuddyItemEvidencePlanCsv(plan) {
  const rows = [
    'item_name,canonical_key,buddy_url,page_data_url,cache_file_name,action,reason,existing_fetched_at',
  ];

  for (const entry of plan.entries) {
    rows.push(
      [
        entry.target.itemName,
        entry.target.canonicalKey,
        entry.target.buddyUrl,
        entry.pageDataUrl,
        entry.cacheFileName,
        entry.action,
        entry.reason,
        entry.existingFetchedAt,
      ]
        .map(escapeCsvValue)
        .join(','),
    );
  }

  return rows.join('\n');
}

export function toBuddyItemEvidenceManifestCsv(cacheResult) {
  const rows = [
    'item_name,canonical_key,buddy_url,page_data_url,cache_file_name,status,http_status,source_status,fetched_at,flags,notes',
  ];

  for (const result of cacheResult.results) {
    rows.push(
      [
        result.itemName,
        result.canonicalKey,
        result.buddyUrl,
        result.pageDataUrl,
        result.cacheFileName,
        result.status,
        result.httpStatus === null ? '' : String(result.httpStatus),
        result.sourceStatus,
        result.fetchedAt,
        result.flags.join('; '),
        result.notes.join('; '),
      ]
        .map(escapeCsvValue)
        .join(','),
    );
  }

  return rows.join('\n');
}

export function toBuddyItemEvidenceReviewCsv(cacheResult) {
  return toBuddyItemEvidenceManifestCsv({
    ...cacheResult,
    results: cacheResult.reviewResults,
  });
}

export function toBuddyItemEvidenceResultJson(cacheResult) {
  return JSON.stringify(
    {
      ...cacheResult,
      results: cacheResult.results.map((result) => ({
        ...result,
        evidence: result.evidence
          ? {
              ...result.evidence,
              pageData: result.evidence.pageData ? '[preserved in page evidence cache file]' : null,
            }
          : null,
      })),
    },
    null,
    2,
  );
}
