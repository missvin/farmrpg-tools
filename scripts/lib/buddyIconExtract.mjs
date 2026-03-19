import { extractHtmlTitle } from './buddyFarmProbe.mjs';

export const ICON_EXTRACTION_STATUSES = ['icon_found', 'no_icon', 'uncertain'];

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
  const results = [];

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];

    try {
      const response = await fetchFn(candidate.candidateBuddyUrl, {
        method: 'GET',
        headers: {
          accept: 'text/html,application/xhtml+xml',
        },
      });

      if (!response.ok) {
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
        results.push({
          ...extractBuddyItemIconPage(candidate, htmlText),
          httpStatus: response.status,
        });
      }
    } catch (error) {
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
