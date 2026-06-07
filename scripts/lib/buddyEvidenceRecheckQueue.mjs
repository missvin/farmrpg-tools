export const DEFAULT_BUDDY_EVIDENCE_BLANK_RECHECK_DAYS = 28;
export const DEFAULT_BUDDY_EVIDENCE_TERMINAL_RECHECK_DAYS = 7;
export const DEFAULT_BUDDY_EVIDENCE_STALE_AFTER_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

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

function parseTimestamp(value) {
  const timestamp = Date.parse(value ?? '');
  return Number.isFinite(timestamp) ? timestamp : null;
}

function addDays(timestampMs, days) {
  return new Date(timestampMs + days * DAY_MS).toISOString().slice(0, 10);
}

function normalizeDateOnly(value) {
  const timestamp = parseTimestamp(value);
  return timestamp === null ? '' : new Date(timestamp).toISOString().slice(0, 10);
}

function toAgeDays(fetchedAtMs, asOfMs) {
  if (fetchedAtMs === null) {
    return '';
  }

  return Math.max(0, Math.floor((asOfMs - fetchedAtMs) / DAY_MS));
}

function hasNonSuccessStatus(row) {
  const status = String(row.status ?? '').trim();
  const httpStatus = String(row.http_status ?? '').trim();

  return ['error', 'http_error', 'fetch_error', 'skip_terminal'].includes(status) || (httpStatus && httpStatus !== '200');
}

function isQueueState(recheckState) {
  return ['new', 'sources_blank', 'needs_recheck', 'stale'].includes(recheckState);
}

export function parseBuddyEvidenceManifestCsv(csvText) {
  const lines = csvText
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvRow(lines[0]).map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = parseCsvRow(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
}

export function deriveBuddyEvidenceFreshnessRows(manifestRows, options = {}) {
  const asOfMs = parseTimestamp(options.asOf ?? new Date().toISOString());
  if (asOfMs === null) {
    throw new Error('Use a valid --as-of timestamp or date for Buddy evidence freshness derivation.');
  }

  const blankRecheckDays = options.blankRecheckDays ?? DEFAULT_BUDDY_EVIDENCE_BLANK_RECHECK_DAYS;
  const terminalRecheckDays = options.terminalRecheckDays ?? DEFAULT_BUDDY_EVIDENCE_TERMINAL_RECHECK_DAYS;
  const staleAfterDays = options.staleAfterDays ?? DEFAULT_BUDDY_EVIDENCE_STALE_AFTER_DAYS;
  const promotedCanonicalKeys = options.promotedCanonicalKeys ?? new Set();

  return manifestRows.map((row) => {
    const fetchedAtMs = parseTimestamp(row.fetched_at);
    const evidenceAgeDays = toAgeDays(fetchedAtMs, asOfMs);
    const sourceStatus = String(row.source_status ?? '').trim();
    const status = String(row.status ?? '').trim();
    const suggestedBlankDate = fetchedAtMs === null ? '' : addDays(fetchedAtMs, blankRecheckDays);
    const suggestedTerminalDate = fetchedAtMs === null ? '' : addDays(fetchedAtMs, terminalRecheckDays);
    const ageIsStale = fetchedAtMs !== null && evidenceAgeDays !== '' && evidenceAgeDays > staleAfterDays;
    let recheckState = 'ready_for_parse';
    let suggestedRecheckDate = '';
    let recheckReason = 'Sources are present and cache is inside the freshness window.';
    let manualNextAction = 'No recheck needed before parsing or promotion review.';

    if (promotedCanonicalKeys.has(row.canonical_key)) {
      recheckState = 'promoted';
      recheckReason = 'Canonical key is marked promoted by the caller.';
      manualNextAction = 'No recheck needed unless source data changes materially.';
    } else if (!status || !row.fetched_at) {
      recheckState = 'new';
      suggestedRecheckDate = normalizeDateOnly(options.asOf ?? new Date(asOfMs).toISOString());
      recheckReason = 'No cached evidence timestamp is available.';
      manualNextAction = 'Include in a bounded manual cache run.';
    } else if (hasNonSuccessStatus(row)) {
      suggestedRecheckDate = suggestedTerminalDate;
      recheckState = suggestedRecheckDate && Date.parse(suggestedRecheckDate) <= asOfMs ? 'needs_recheck' : 'sources_blank';
      recheckReason = 'Cached evidence is terminal or uncertain.';
      manualNextAction = 'Retry in a small manual batch after the suggested date.';
    } else if (ageIsStale) {
      recheckState = 'stale';
      suggestedRecheckDate = normalizeDateOnly(options.asOf ?? new Date(asOfMs).toISOString());
      recheckReason = `Cached evidence is older than ${staleAfterDays.toLocaleString()} days.`;
      manualNextAction = 'Consider rechecking in a bounded manual cache run if this item matters now.';
    } else if (sourceStatus === 'sources_blank' || sourceStatus === 'uncertain') {
      suggestedRecheckDate = suggestedBlankDate;
      recheckState = suggestedRecheckDate && Date.parse(suggestedRecheckDate) <= asOfMs ? 'needs_recheck' : 'sources_blank';
      recheckReason =
        sourceStatus === 'sources_blank'
          ? 'Buddy page currently has no known non-empty source sections.'
          : 'Buddy evidence source status is uncertain.';
      manualNextAction = 'Wait until the suggested date, then recheck in a bounded manual cache run.';
    }

    return {
      item_name: row.item_name ?? '',
      canonical_key: row.canonical_key ?? '',
      buddy_url: row.buddy_url ?? '',
      page_data_url: row.page_data_url ?? '',
      cache_file_name: row.cache_file_name ?? '',
      current_status: status,
      http_status: row.http_status ?? '',
      source_status: sourceStatus,
      fetched_at: row.fetched_at ?? '',
      evidence_age_days: evidenceAgeDays,
      recheck_state: recheckState,
      suggested_recheck_date: suggestedRecheckDate,
      recheck_reason: recheckReason,
      manual_next_action: manualNextAction,
      flags: row.flags ?? '',
      notes: row.notes ?? '',
    };
  });
}

export function buildBuddyEvidenceRecheckQueue(manifestRows, options = {}) {
  const freshnessRows = deriveBuddyEvidenceFreshnessRows(manifestRows, options);
  const queueRows = freshnessRows.filter((row) => isQueueState(row.recheck_state));
  const countsByState = freshnessRows.reduce((counts, row) => {
    counts[row.recheck_state] = (counts[row.recheck_state] ?? 0) + 1;
    return counts;
  }, {});

  return {
    freshnessRows,
    queueRows,
    summary: {
      rowsProcessed: freshnessRows.length,
      queueRowCount: queueRows.length,
      countsByState,
      asOf: options.asOf ?? new Date().toISOString(),
      blankRecheckDays: options.blankRecheckDays ?? DEFAULT_BUDDY_EVIDENCE_BLANK_RECHECK_DAYS,
      terminalRecheckDays: options.terminalRecheckDays ?? DEFAULT_BUDDY_EVIDENCE_TERMINAL_RECHECK_DAYS,
      staleAfterDays: options.staleAfterDays ?? DEFAULT_BUDDY_EVIDENCE_STALE_AFTER_DAYS,
    },
  };
}

export function toBuddyEvidenceFreshnessCsv(rows) {
  const headers = [
    'item_name',
    'canonical_key',
    'buddy_url',
    'page_data_url',
    'cache_file_name',
    'current_status',
    'http_status',
    'source_status',
    'fetched_at',
    'evidence_age_days',
    'recheck_state',
    'suggested_recheck_date',
    'recheck_reason',
    'manual_next_action',
    'flags',
    'notes',
  ];

  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(',')),
  ].join('\n');
}
