const BUDDY_CANDIDATE_COLUMNS = [
  'museum_category',
  'category',
  'item_name',
  'canonical_key',
  'obtainable',
  'generated_buddy_slug',
  'candidate_buddy_url',
  'alternate_buddy_slug',
  'confidence',
  'flags',
  'notes',
];

export const PROBE_STATUSES = [
  'found',
  'not_found',
  'redirect',
  'ambiguous',
  'fetch_failed',
  'blocked_or_rate_limited',
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
  if (/[",\n]/u.test(value)) {
    return `"${value.replace(/"/gu, '""')}"`;
  }

  return value;
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
  const missingColumns = BUDDY_CANDIDATE_COLUMNS.filter((column) => !headers.includes(column));
  const unexpectedColumns = headers.filter((header) => !BUDDY_CANDIDATE_COLUMNS.includes(header));

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

  throw new Error(`Invalid buddy candidate CSV schema (${details.join('; ')}).`);
}

export function parseBuddyCandidateCsv(csvText) {
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
      museumCategory: readField(values, headerIndex, 'museum_category').trim(),
      category: readField(values, headerIndex, 'category').trim(),
      itemName: readField(values, headerIndex, 'item_name').trim(),
      canonicalKey: readField(values, headerIndex, 'canonical_key').trim(),
      obtainable: readField(values, headerIndex, 'obtainable').trim().toUpperCase() === 'Y',
      generatedBuddySlug: readField(values, headerIndex, 'generated_buddy_slug').trim(),
      candidateBuddyUrl: readField(values, headerIndex, 'candidate_buddy_url').trim(),
      alternateBuddySlug: readField(values, headerIndex, 'alternate_buddy_slug').trim() || null,
      confidence: readField(values, headerIndex, 'confidence').trim(),
      flags: splitReviewField(readField(values, headerIndex, 'flags')),
      notes: splitReviewField(readField(values, headerIndex, 'notes')),
    };
  });
}

export function extractHtmlTitle(htmlText) {
  const titleMatch = htmlText.match(/<title\b[^>]*>(?<title>.*?)<\/title>/isu);

  if (titleMatch?.groups?.title) {
    return titleMatch.groups.title.replace(/\s+/gu, ' ').trim();
  }

  const metaTitleMatch = htmlText.match(
    /<meta\b[^>]*(?:property|name)=["'](?:og:title|twitter:title)["'][^>]*content=["'](?<title>.*?)["'][^>]*>/isu,
  );

  return metaTitleMatch?.groups?.title?.replace(/\s+/gu, ' ').trim() ?? null;
}

function normalizeLocation(location, candidateUrl) {
  try {
    return new URL(location, candidateUrl).href;
  } catch {
    return location;
  }
}

function shouldRetryStatus(status) {
  return status === 503 || status === 504 || status === 408;
}

export async function probeBuddyFarmCandidate(candidate, options = {}) {
  const fetchFn = options.fetchFn ?? fetch;
  const sleepFn = options.sleepFn ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const maxRetries = options.maxRetries ?? 1;
  const retryDelayMs = options.retryDelayMs ?? 2000;

  let attempt = 0;
  let lastResult = null;

  while (attempt <= maxRetries) {
    attempt += 1;
    const flags = [...candidate.flags];
    const notes = [...candidate.notes];

    try {
      const response = await fetchFn(candidate.candidateBuddyUrl, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          accept: 'text/html,application/xhtml+xml',
        },
      });

      const locationHeader = response.headers.get('location');
      const finalUrl = locationHeader ? normalizeLocation(locationHeader, candidate.candidateBuddyUrl) : response.url || null;
      let pageTitle = null;
      let status = 'ambiguous';

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        status = 'redirect';
        flags.push('http_redirect');
        notes.push(`Received HTTP ${response.status} redirect.`);
      } else if (response.status === 404) {
        status = 'not_found';
      } else if ([403, 429].includes(response.status)) {
        status = 'blocked_or_rate_limited';
        flags.push('rate_limit_or_block');
      } else if (shouldRetryStatus(response.status)) {
        if (attempt <= maxRetries) {
          await sleepFn(retryDelayMs);
          continue;
        }

        status = 'blocked_or_rate_limited';
        flags.push('server_busy');
      } else if (response.ok) {
        const bodyText = await response.text();
        pageTitle = extractHtmlTitle(bodyText);

        if (response.redirected || (finalUrl && finalUrl !== candidate.candidateBuddyUrl)) {
          status = 'redirect';
          flags.push('final_url_differs');
        } else if (!pageTitle) {
          status = 'ambiguous';
          flags.push('missing_title');
          notes.push('Page responded successfully but no HTML title was detected.');
        } else {
          status = 'found';
        }
      } else {
        status = 'fetch_failed';
      }

      if (attempt > 1) {
        flags.push('retry_used');
        notes.push(`Probe succeeded after ${attempt.toLocaleString()} attempts.`);
      }

      lastResult = {
        itemName: candidate.itemName,
        canonicalKey: candidate.canonicalKey,
        generatedBuddySlug: candidate.generatedBuddySlug,
        candidateBuddyUrl: candidate.candidateBuddyUrl,
        probeStatus: status,
        httpStatus: response.status,
        finalUrl,
        pageTitle,
        attempts: attempt,
        flags: [...new Set(flags)],
        notes,
      };

      return lastResult;
    } catch (error) {
      if (attempt <= maxRetries) {
        await sleepFn(retryDelayMs);
        continue;
      }

      const flags = [...candidate.flags, 'fetch_error'];
      const notes = [...candidate.notes, error instanceof Error ? error.message : 'Unknown fetch failure.'];

      lastResult = {
        itemName: candidate.itemName,
        canonicalKey: candidate.canonicalKey,
        generatedBuddySlug: candidate.generatedBuddySlug,
        candidateBuddyUrl: candidate.candidateBuddyUrl,
        probeStatus: 'fetch_failed',
        httpStatus: null,
        finalUrl: null,
        pageTitle: null,
        attempts: attempt,
        flags: [...new Set(flags)],
        notes,
      };

      return lastResult;
    }
  }

  return lastResult;
}

export async function probeBuddyFarmCandidates(candidates, options = {}) {
  const interRequestDelayMs = options.interRequestDelayMs ?? 1500;
  const sleepFn = options.sleepFn ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const results = [];

  for (let index = 0; index < candidates.length; index += 1) {
    const result = await probeBuddyFarmCandidate(candidates[index], options);
    results.push(result);

    if (index < candidates.length - 1) {
      await sleepFn(interRequestDelayMs);
    }
  }

  const countsByStatus = results.reduce((counts, result) => {
    counts[result.probeStatus] = (counts[result.probeStatus] ?? 0) + 1;
    return counts;
  }, {});

  const reviewResults = results.filter((result) => result.probeStatus !== 'found');
  const warnings = [];

  if (reviewResults.length > 0) {
    warnings.push(
      `${reviewResults.length.toLocaleString()} probe results need review because they were not clean "found" responses.`,
    );
  }

  return {
    results,
    reviewResults,
    summary: {
      candidatesProbed: results.length,
      countsByStatus,
      warnings,
    },
  };
}

export function toBuddyProbeResultsJson(probeResult) {
  return JSON.stringify(probeResult, null, 2);
}

export function toBuddyProbeResultsCsv(probeResult) {
  const rows = [
    'item_name,canonical_key,generated_buddy_slug,candidate_buddy_url,probe_status,http_status,final_url,page_title,attempts,flags,notes',
  ];

  for (const result of probeResult.results) {
    rows.push(
      [
        result.itemName,
        result.canonicalKey,
        result.generatedBuddySlug,
        result.candidateBuddyUrl,
        result.probeStatus,
        result.httpStatus === null ? '' : String(result.httpStatus),
        result.finalUrl ?? '',
        result.pageTitle ?? '',
        String(result.attempts),
        result.flags.join('; '),
        result.notes.join('; '),
      ]
        .map(escapeCsvValue)
        .join(','),
    );
  }

  return rows.join('\n');
}

export function toBuddyProbeReviewCsv(probeResult) {
  return toBuddyProbeResultsCsv({
    ...probeResult,
    results: probeResult.reviewResults,
  });
}
