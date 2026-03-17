import { extractHtmlTitle, parseBuddyCandidateCsv } from './buddyFarmProbe.mjs';

export const RECIPE_EXTRACTION_STATUSES = ['recipe_found', 'no_recipe', 'uncertain'];

const SECTION_HEADING_RE = /<h3\b[^>]*>(?<heading>.*?)<\/h3>/giu;
const ROW_MARKER_RE = /<div class="d-flex w-100 justify-content-between gap-4\s+css-0 list-group-item">/gu;
const LINE_ONE_RE = /<div class="bf-list-line-one[^"]*"[^>]*>(?<value>.*?)<\/div>/isu;
const LINE_TWO_RE = /<div class="bf-list-line-two[^"]*"[^>]*>(?<value>.*?)<\/div>/isu;
const VALUE_RE = /<span class="bf-list-value[^"]*"[^>]*>(?<value>.*?)<\/span>/isu;
const HREF_RE = /<a\b[^>]*href="(?<href>\/i\/[^"]+\/)"/isu;
const QUANTITY_RE = /^\d[\d,]*$/u;

function decodeHtmlEntities(value) {
  if (!value) {
    return '';
  }

  const namedEntities = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
    rsquo: "'",
  };

  return value
    .replace(/&#x(?<hex>[0-9a-f]+);/giu, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(?<decimal>\d+);/gu, (_, decimal) => String.fromCodePoint(parseInt(decimal, 10)))
    .replace(/&(?<named>[a-z]+);/giu, (match, named) => namedEntities[named.toLowerCase()] ?? match);
}

function cleanHtmlText(value) {
  return decodeHtmlEntities(value)
    .replace(/<[^>]+>/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function normalizeItemHref(href) {
  if (!href) {
    return null;
  }

  try {
    return new URL(href, 'https://buddy.farm').href;
  } catch {
    return href;
  }
}

function extractSections(htmlText) {
  const headingMatches = Array.from(htmlText.matchAll(SECTION_HEADING_RE));

  return headingMatches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = headingMatches[index + 1]?.index ?? htmlText.length;

    return {
      heading: cleanHtmlText(match.groups?.heading ?? ''),
      html: htmlText.slice(start, end),
    };
  });
}

function splitListRows(sectionHtml) {
  const markers = Array.from(sectionHtml.matchAll(ROW_MARKER_RE));

  return markers.map((marker, index) => {
    const start = marker.index ?? 0;
    const end = markers[index + 1]?.index ?? sectionHtml.length;
    return sectionHtml.slice(start, end);
  });
}

function parseSectionEntries(sectionHtml) {
  return splitListRows(sectionHtml)
    .map((rowHtml) => {
      const name = cleanHtmlText(rowHtml.match(LINE_ONE_RE)?.groups?.value ?? '');

      if (!name) {
        return null;
      }

      const value = cleanHtmlText(rowHtml.match(VALUE_RE)?.groups?.value ?? '');
      const lineTwo = cleanHtmlText(rowHtml.match(LINE_TWO_RE)?.groups?.value ?? '');
      const href = normalizeItemHref(rowHtml.match(HREF_RE)?.groups?.href ?? null);

      return {
        name,
        value,
        href,
        lineTwo: lineTwo || null,
      };
    })
    .filter(Boolean);
}

function parseCraftRecipeSection(sectionHtml) {
  const entries = parseSectionEntries(sectionHtml);
  const ingredients = entries
    .filter((entry) => entry.href && QUANTITY_RE.test(entry.value))
    .map((entry) => ({
      itemName: entry.name,
      buddyUrl: entry.href,
      quantity: Number(entry.value.replace(/,/gu, '')),
    }));

  return {
    recipeType: 'craft',
    sectionHeading: 'Recipe',
    recipeBookItem: null,
    parameters: [],
    ingredients,
  };
}

function parseCookingRecipeSection(sectionHtml) {
  const entries = parseSectionEntries(sectionHtml);
  const recipeBookItem = entries.find((entry) => entry.href && entry.value.toLowerCase() === 'recipe') ?? null;
  const parameters = entries
    .filter((entry) => !entry.href && entry.value)
    .map((entry) => ({
      label: entry.name,
      value: entry.value,
    }));
  const ingredients = entries
    .filter((entry) => entry.href && entry.value && entry.value.toLowerCase() !== 'recipe' && QUANTITY_RE.test(entry.value))
    .map((entry) => ({
      itemName: entry.name,
      buddyUrl: entry.href,
      quantity: Number(entry.value.replace(/,/gu, '')),
    }));

  return {
    recipeType: 'cooking',
    sectionHeading: 'Cooking Recipe',
    recipeBookItem: recipeBookItem
      ? {
          itemName: recipeBookItem.name,
          buddyUrl: recipeBookItem.href,
          value: recipeBookItem.value,
        }
      : null,
    parameters,
    ingredients,
  };
}

function parseUsedInSection(sectionHtml) {
  return parseSectionEntries(sectionHtml)
    .filter((entry) => entry.href && QUANTITY_RE.test(entry.value))
    .map((entry) => ({
      itemName: entry.name,
      buddyUrl: entry.href,
      quantity: Number(entry.value.replace(/,/gu, '')),
    }));
}

function buildNoRecipeResult(candidate, pageTitle, usedIn) {
  return {
    itemName: candidate.itemName,
    canonicalKey: candidate.canonicalKey,
    generatedBuddySlug: candidate.generatedBuddySlug,
    candidateBuddyUrl: candidate.candidateBuddyUrl,
    pageTitle,
    extractionStatus: 'no_recipe',
    recipeType: null,
    recipe: null,
    usedIn,
    flags: [],
    notes: [],
  };
}

export function extractBuddyRecipePage(candidate, htmlText) {
  const pageTitle = decodeHtmlEntities(extractHtmlTitle(htmlText) ?? candidate.itemName);
  const sections = extractSections(htmlText);
  const sectionByHeading = new Map(sections.map((section) => [section.heading, section.html]));
  const cookingSectionHtml = sectionByHeading.get('Cooking Recipe') ?? null;
  const craftSectionHtml = sectionByHeading.get('Recipe') ?? null;
  const usedIn = parseUsedInSection(sectionByHeading.get('Used In') ?? '');

  if (cookingSectionHtml) {
    const recipe = parseCookingRecipeSection(cookingSectionHtml);

    if (recipe.recipeBookItem || recipe.ingredients.length > 0 || recipe.parameters.length > 0) {
      return {
        itemName: candidate.itemName,
        canonicalKey: candidate.canonicalKey,
        generatedBuddySlug: candidate.generatedBuddySlug,
        candidateBuddyUrl: candidate.candidateBuddyUrl,
        pageTitle,
        extractionStatus: 'recipe_found',
        recipeType: recipe.recipeType,
        recipe,
        usedIn,
        flags: [],
        notes: [],
      };
    }

    return {
      ...buildNoRecipeResult(candidate, pageTitle, usedIn),
      extractionStatus: 'uncertain',
      flags: ['empty_cooking_recipe_section'],
      notes: ['A Cooking Recipe section was found but no recipe details could be parsed.'],
    };
  }

  if (craftSectionHtml) {
    const recipe = parseCraftRecipeSection(craftSectionHtml);

    if (recipe.ingredients.length > 0) {
      return {
        itemName: candidate.itemName,
        canonicalKey: candidate.canonicalKey,
        generatedBuddySlug: candidate.generatedBuddySlug,
        candidateBuddyUrl: candidate.candidateBuddyUrl,
        pageTitle,
        extractionStatus: 'recipe_found',
        recipeType: recipe.recipeType,
        recipe,
        usedIn,
        flags: [],
        notes: [],
      };
    }

    return {
      ...buildNoRecipeResult(candidate, pageTitle, usedIn),
      extractionStatus: 'uncertain',
      flags: ['empty_recipe_section'],
      notes: ['A Recipe section was found but no linked ingredient rows could be parsed.'],
    };
  }

  return buildNoRecipeResult(candidate, pageTitle, usedIn);
}

export async function extractBuddyRecipeCandidates(candidates, options = {}) {
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
          recipeType: null,
          recipe: null,
          usedIn: [],
          httpStatus: response.status,
          flags: [`http_${response.status}`],
          notes: [`Expected a successful buddy page fetch but received HTTP ${response.status}.`],
        });
      } else {
        const htmlText = await response.text();
        results.push({
          ...extractBuddyRecipePage(candidate, htmlText),
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
        recipeType: null,
        recipe: null,
        usedIn: [],
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

  return {
    results,
    summary: {
      candidatesProcessed: results.length,
      countsByStatus,
      uncertainResults: results.filter((result) => result.extractionStatus === 'uncertain').length,
    },
  };
}

function escapeCsvValue(value) {
  if (/[",\n]/u.test(value)) {
    return `"${value.replace(/"/gu, '""')}"`;
  }

  return value;
}

export function toBuddyRecipeExtractionJson(extractionResult) {
  return JSON.stringify(extractionResult, null, 2);
}

export function toBuddyRecipeExtractionSummaryCsv(extractionResult) {
  const rows = [
    'item_name,candidate_buddy_url,generated_buddy_slug,extraction_status,recipe_type,http_status,ingredient_count,used_in_count,cooking_level,base_time,flags,notes',
  ];

  for (const result of extractionResult.results) {
    const cookingLevel = result.recipe?.parameters?.find((parameter) => parameter.label === 'Cooking Level')?.value ?? '';
    const baseTime = result.recipe?.parameters?.find((parameter) => parameter.label === 'Base Time')?.value ?? '';

    rows.push(
      [
        result.itemName,
        result.candidateBuddyUrl,
        result.generatedBuddySlug,
        result.extractionStatus,
        result.recipeType ?? '',
        result.httpStatus === null ? '' : String(result.httpStatus),
        String(result.recipe?.ingredients?.length ?? 0),
        String(result.usedIn?.length ?? 0),
        cookingLevel,
        baseTime,
        result.flags.join('; '),
        result.notes.join('; '),
      ]
        .map((value) => escapeCsvValue(value))
        .join(','),
    );
  }

  return rows.join('\n');
}

export function toBuddyRecipeExtractionReviewCsv(extractionResult) {
  return toBuddyRecipeExtractionSummaryCsv({
    ...extractionResult,
    results: extractionResult.results.filter((result) => result.extractionStatus === 'uncertain'),
  });
}

export function parseBuddyRecipeSampleCsv(csvText) {
  return parseBuddyCandidateCsv(csvText);
}
