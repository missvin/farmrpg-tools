import { extractHtmlTitle } from './buddyFarmProbe.mjs';

export const ICON_EXTRACTION_STATUSES = ['icon_found', 'no_icon', 'uncertain'];
export const ICON_OBSERVATION_STATUSES = ['observed', 'review_needed'];

const H1_RE = /<h1\b[^>]*>(?<content>[\s\S]*?)<\/h1>/iu;
const ITEM_IMAGE_RE = /<img\b[^>]*src="(?<src>(?:https?:\/\/[^"]+|\/[^"]+img\/items\/[^"]+|\/img\/items\/[^"]+))"[^>]*>/giu;

function normalizeUrl(href) {
  if (!href) {
    return null;
  }

  try {
    return new URL(href, 'https://buddy.farm').href;
  } catch {
    return href;
  }
}

function escapeCsvValue(value) {
  if (/[",\n]/u.test(value)) {
    return `"${value.replace(/"/gu, '""')}"`;
  }

  return value;
}

function getIconFilename(iconUrl) {
  if (!iconUrl) {
    return null;
  }

  try {
    const pathname = new URL(iconUrl).pathname;
    const segments = pathname.split('/').filter(Boolean);
    return segments[segments.length - 1] ?? null;
  } catch {
    return null;
  }
}

function getIconAssetKey(iconFilename) {
  if (!iconFilename) {
    return null;
  }

  const extension = iconFilename.match(/\.[^.]+$/u)?.[0] ?? '';
  const baseName = extension ? iconFilename.slice(0, -extension.length) : iconFilename;
  return baseName || null;
}

function getFarmRpgItemIdCandidate(iconFilename) {
  const assetKey = getIconAssetKey(iconFilename);

  if (!assetKey || !/^\d+$/u.test(assetKey)) {
    return null;
  }

  return assetKey;
}

function getIconPathname(iconUrl) {
  if (!iconUrl) {
    return null;
  }

  try {
    return new URL(iconUrl).pathname;
  } catch {
    return null;
  }
}

function extractImageUrls(htmlText) {
  return Array.from(htmlText.matchAll(ITEM_IMAGE_RE))
    .map((match) => normalizeUrl(match.groups?.src ?? null))
    .filter(Boolean);
}

function evaluateStopCondition(metrics, options) {
  if (metrics.consecutiveFailures >= options.maxConsecutiveFailures) {
    return `Stopped after ${metrics.consecutiveFailures.toLocaleString()} consecutive extraction failures.`;
  }

  if (metrics.totalFailures >= options.maxTotalFailures) {
    return `Stopped after ${metrics.totalFailures.toLocaleString()} total extraction failures.`;
  }

  if (
    metrics.networkAttempts >= options.failureRateMinAttempts &&
    metrics.totalFailures / metrics.networkAttempts > options.maxFailureRate
  ) {
    return `Stopped because extraction failure rate reached ${(metrics.totalFailures / metrics.networkAttempts * 100).toFixed(1)}% after ${metrics.networkAttempts.toLocaleString()} attempts.`;
  }

  return null;
}

export function extractBuddyItemIconPage(candidate, htmlText) {
  const pageTitle = extractHtmlTitle(htmlText) ?? candidate.itemName;
  const h1Html = htmlText.match(H1_RE)?.groups?.content ?? '';
  const h1ImageUrls = extractImageUrls(h1Html);
  const imageUrls = extractImageUrls(htmlText);
  const primaryIconUrl = h1ImageUrls[0] ?? imageUrls[0] ?? null;
  const flags = [];
  const notes = [];

  if (!primaryIconUrl) {
    return {
      itemName: candidate.itemName,
      canonicalKey: candidate.canonicalKey,
      generatedBuddySlug: candidate.generatedBuddySlug,
      candidateBuddyUrl: candidate.candidateBuddyUrl,
      pageTitle,
      extractionStatus: 'no_icon',
      iconUrl: null,
      iconPathname: null,
      iconFilename: null,
      imageUrlCount: 0,
      flags: ['no_item_icon_link_detected'],
      notes: ['No item icon URL could be detected from the buddy item page HTML.'],
    };
  }

  const iconPathname = getIconPathname(primaryIconUrl);
  const iconFilename = getIconFilename(primaryIconUrl);

  if (h1ImageUrls.length === 0 && imageUrls.length > 0) {
    flags.push('fell_back_to_global_image_search');
    notes.push('No title-area item image was detected, so extraction fell back to the first item image in the page.');
  }

  if (!iconPathname?.includes('/img/items/')) {
    flags.push('unexpected_icon_path');
    notes.push('The extracted icon URL did not use the expected /img/items/ path.');
  }

  return {
    itemName: candidate.itemName,
    canonicalKey: candidate.canonicalKey,
    generatedBuddySlug: candidate.generatedBuddySlug,
    candidateBuddyUrl: candidate.candidateBuddyUrl,
    pageTitle,
    extractionStatus: flags.length > 0 ? 'uncertain' : 'icon_found',
    iconUrl: primaryIconUrl,
    iconPathname,
    iconFilename,
    imageUrlCount: imageUrls.length,
    flags,
    notes,
  };
}

export async function extractBuddyItemIcons(candidates, options = {}) {
  const fetchFn = options.fetchFn ?? fetch;
  const sleepFn = options.sleepFn ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const interRequestDelayMs = options.interRequestDelayMs ?? 1500;
  const stopOptions = {
    maxConsecutiveFailures: options.maxConsecutiveFailures ?? 3,
    maxTotalFailures: options.maxTotalFailures ?? 5,
    maxFailureRate: options.maxFailureRate ?? 0.2,
    failureRateMinAttempts: options.failureRateMinAttempts ?? 10,
  };
  const results = [];
  const metrics = {
    networkAttempts: 0,
    totalFailures: 0,
    consecutiveFailures: 0,
  };
  let guardStopReason = null;

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];

    if (guardStopReason) {
      results.push({
        itemName: candidate.itemName,
        canonicalKey: candidate.canonicalKey,
        generatedBuddySlug: candidate.generatedBuddySlug,
        candidateBuddyUrl: candidate.candidateBuddyUrl,
        pageTitle: null,
        extractionStatus: 'uncertain',
        iconUrl: null,
        iconPathname: null,
        iconFilename: null,
        imageUrlCount: 0,
        httpStatus: null,
        flags: ['stopped_by_guard'],
        notes: [guardStopReason],
      });
      continue;
    }

    try {
      metrics.networkAttempts += 1;
      const response = await fetchFn(candidate.candidateBuddyUrl, {
        method: 'GET',
        headers: {
          accept: 'text/html,application/xhtml+xml',
        },
      });

      if (!response.ok) {
        metrics.totalFailures += 1;
        metrics.consecutiveFailures += 1;
        results.push({
          itemName: candidate.itemName,
          canonicalKey: candidate.canonicalKey,
          generatedBuddySlug: candidate.generatedBuddySlug,
          candidateBuddyUrl: candidate.candidateBuddyUrl,
          pageTitle: null,
          extractionStatus: 'uncertain',
          iconUrl: null,
          iconPathname: null,
          iconFilename: null,
          imageUrlCount: 0,
          httpStatus: response.status,
          flags: [`http_${response.status}`],
          notes: [`Expected a successful buddy page fetch but received HTTP ${response.status}.`],
        });
      } else {
        const htmlText = await response.text();
        metrics.consecutiveFailures = 0;
        results.push({
          ...extractBuddyItemIconPage(candidate, htmlText),
          httpStatus: response.status,
        });
      }
    } catch (error) {
      metrics.totalFailures += 1;
      metrics.consecutiveFailures += 1;
      results.push({
        itemName: candidate.itemName,
        canonicalKey: candidate.canonicalKey,
        generatedBuddySlug: candidate.generatedBuddySlug,
        candidateBuddyUrl: candidate.candidateBuddyUrl,
        pageTitle: null,
        extractionStatus: 'uncertain',
        iconUrl: null,
        iconPathname: null,
        iconFilename: null,
        imageUrlCount: 0,
        httpStatus: null,
        flags: ['fetch_error'],
        notes: [error instanceof Error ? error.message : 'Unknown fetch failure.'],
      });
    }

    guardStopReason = evaluateStopCondition(metrics, stopOptions);

    if (index < candidates.length - 1) {
      await sleepFn(interRequestDelayMs);
    }
  }

  const countsByStatus = results.reduce((counts, result) => {
    counts[result.extractionStatus] = (counts[result.extractionStatus] ?? 0) + 1;
    return counts;
  }, {});

  const reviewResults = results.filter((result) => result.extractionStatus !== 'icon_found');

  return {
    results,
    reviewResults,
    summary: {
      candidatesProcessed: results.length,
      countsByStatus,
      reviewCount: reviewResults.length,
      stoppedByGuard: guardStopReason !== null,
      guardStopReason,
      networkAttempts: metrics.networkAttempts,
      totalFailures: metrics.totalFailures,
    },
  };
}

export function toBuddyIconExtractionJson(extractionResult) {
  return JSON.stringify(extractionResult, null, 2);
}

export function toBuddyIconExtractionCsv(extractionResult) {
  const rows = [
    'item_name,canonical_key,generated_buddy_slug,candidate_buddy_url,extraction_status,http_status,page_title,icon_url,icon_pathname,icon_filename,image_url_count,flags,notes',
  ];

  for (const result of extractionResult.results) {
    rows.push(
      [
        result.itemName,
        result.canonicalKey,
        result.generatedBuddySlug,
        result.candidateBuddyUrl,
        result.extractionStatus,
        result.httpStatus === null ? '' : String(result.httpStatus),
        result.pageTitle ?? '',
        result.iconUrl ?? '',
        result.iconPathname ?? '',
        result.iconFilename ?? '',
        String(result.imageUrlCount ?? 0),
        result.flags.join('; '),
        result.notes.join('; '),
      ]
        .map(escapeCsvValue)
        .join(','),
    );
  }

  return rows.join('\n');
}

export function toBuddyIconReviewCsv(extractionResult) {
  return toBuddyIconExtractionCsv({
    ...extractionResult,
    results: extractionResult.reviewResults,
  });
}

export function deriveBuddyIconObservations(extractionResult) {
  const results = extractionResult.results.map((result) => {
    const iconAssetKey = getIconAssetKey(result.iconFilename);
    const farmrpgItemIdCandidate = getFarmRpgItemIdCandidate(result.iconFilename);
    const observationStatus =
      result.extractionStatus === 'icon_found' && result.iconUrl && result.iconPathname && result.iconFilename
        ? 'observed'
        : 'review_needed';

    return {
      itemName: result.itemName,
      canonicalKey: result.canonicalKey,
      generatedBuddySlug: result.generatedBuddySlug,
      candidateBuddyUrl: result.candidateBuddyUrl,
      pageTitle: result.pageTitle ?? null,
      extractionStatus: result.extractionStatus,
      observationStatus,
      iconUrl: result.iconUrl ?? null,
      iconPathname: result.iconPathname ?? null,
      iconFilename: result.iconFilename ?? null,
      iconAssetKey,
      farmrpgItemIdCandidate,
      flags: [...result.flags],
      notes: [...result.notes],
    };
  });

  const countsByStatus = results.reduce((counts, result) => {
    counts[result.observationStatus] = (counts[result.observationStatus] ?? 0) + 1;
    return counts;
  }, {});

  return {
    results,
    reviewResults: results.filter((result) => result.observationStatus !== 'observed'),
    summary: {
      rowsProcessed: results.length,
      countsByStatus,
      observedCount: results.filter((result) => result.observationStatus === 'observed').length,
      numericFarmRpgItemIdCandidateCount: results.filter((result) => result.farmrpgItemIdCandidate !== null).length,
      reviewCount: results.filter((result) => result.observationStatus !== 'observed').length,
    },
  };
}

export function toBuddyIconObservationJson(observationResult) {
  return JSON.stringify(observationResult, null, 2);
}

export function toBuddyIconObservationCsv(observationResult) {
  const rows = [
    'item_name,canonical_key,generated_buddy_slug,candidate_buddy_url,page_title,extraction_status,observation_status,icon_url,icon_pathname,icon_filename,icon_asset_key,farmrpg_item_id_candidate,flags,notes',
  ];

  for (const result of observationResult.results) {
    rows.push(
      [
        result.itemName,
        result.canonicalKey,
        result.generatedBuddySlug,
        result.candidateBuddyUrl,
        result.pageTitle ?? '',
        result.extractionStatus,
        result.observationStatus,
        result.iconUrl ?? '',
        result.iconPathname ?? '',
        result.iconFilename ?? '',
        result.iconAssetKey ?? '',
        result.farmrpgItemIdCandidate ?? '',
        result.flags.join('; '),
        result.notes.join('; '),
      ]
        .map(escapeCsvValue)
        .join(','),
    );
  }

  return rows.join('\n');
}

export function toBuddyIconObservationReviewCsv(observationResult) {
  return toBuddyIconObservationCsv({
    ...observationResult,
    results: observationResult.reviewResults,
  });
}
