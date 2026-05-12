import { parseMuseumExport, type MuseumParseResult } from './parseMuseumExport';
import { toCanonicalItemKey } from './normalizeItemKey';
import type { MuseumCompletionCanonData, MuseumCompletionCanonEntry } from './loadMuseumCompletionCanon';
import type { MuseumCompletionManualMissingEntry } from './museumCompletionState';

export type PersonalMuseumSlot =
  | {
      slotIndex: number;
      status: 'seen';
      itemName: string;
      canonicalKey: string;
    }
  | {
      slotIndex: number;
      status: 'missing';
    };

export type PersonalMuseumCategory = {
  categoryName: string;
  categoryKey: string;
  expectedOwnedCount: number;
  expectedTotalCount: number;
  seenCount: number;
  missingMarkerCount: number;
  parsedSlotCount: number;
  countValidation: 'matches_header' | 'mismatch';
  slots: PersonalMuseumSlot[];
};

export type PersonalMuseumParseSummary = {
  categoriesParsed: number;
  totalSlotsParsed: number;
  seenItemsParsed: number;
  missingMarkersParsed: number;
  warnings: string[];
};

export type PersonalMuseumParseResult = {
  categories: PersonalMuseumCategory[];
  parseSummary: PersonalMuseumParseSummary;
};

export type MuseumFullListMetadata = {
  lastUpdatedLabel: string | null;
  footerUpdatedLabel: string | null;
};

export type MuseumCompletionMissingItem = {
  categoryName: string;
  categoryKey: string;
  slotIndex: number;
  itemName: string;
  canonicalKey: string;
  confidence: 'known' | 'possible_stale_full_list';
};

export type MuseumCompletionUnresolvedSlot = {
  categoryName: string;
  categoryKey: string;
  slotIndex: number;
  reason: 'missing_full_category' | 'missing_full_slot' | 'candidate_seen_elsewhere';
  candidateItemName: string | null;
  candidateCanonicalKey: string | null;
};

export type MuseumCompletionCategoryProgress = {
  categoryName: string;
  categoryKey: string;
  seenCount: number;
  expectedTotalCount: number;
  missingMarkerCount: number;
  knownMissingCount: number;
  possibleMissingCount: number;
  unresolvedMissingCount: number;
  fullListTotalCount: number | null;
  countStatus: 'matches_full_list' | 'full_list_mismatch' | 'missing_full_category';
};

export type MuseumCompletionProgressSummary = {
  categoriesCount: number;
  totalSlots: number;
  seenItems: number;
  missingMarkers: number;
  knownMissingItems: number;
  possibleMissingItems: number;
  unresolvedMissingSlots: number;
  completionPercent: number | null;
};

export type MuseumCompletionProgress = {
  fullList: MuseumParseResult;
  personal: PersonalMuseumParseResult;
  metadata: MuseumFullListMetadata;
  summary: MuseumCompletionProgressSummary;
  categories: MuseumCompletionCategoryProgress[];
  knownMissingItems: MuseumCompletionMissingItem[];
  possibleMissingItems: MuseumCompletionMissingItem[];
  unresolvedSlots: MuseumCompletionUnresolvedSlot[];
  warnings: string[];
};

export type MuseumCompletionManualCategoryProgress = {
  categoryName: string;
  categoryKey: string;
  seenCount: number;
  expectedTotalCount: number;
  missingMarkerCount: number;
  namedMissingCount: number;
  unresolvedMissingCount: number;
};

export type MuseumCompletionManualProgressSummary = {
  categoriesCount: number;
  totalSlots: number;
  seenItems: number;
  missingMarkers: number;
  namedMissingItems: number;
  namedMissingSlots: number;
  unresolvedMissingSlots: number;
  completionPercent: number | null;
};

export type MuseumCompletionManualProgress = {
  personal: PersonalMuseumParseResult;
  summary: MuseumCompletionManualProgressSummary;
  categories: MuseumCompletionManualCategoryProgress[];
  namedMissingItems: MuseumCompletionManualMissingEntry[];
  warnings: string[];
};

const PERSONAL_CATEGORY_HEADER_PATTERN = /^(?<name>.+?)\s*\(\s*(?<owned>\d+)\s*\/\s*(?<total>\d+)\s*\)$/u;
const FOOTER_END_MARKERS = new Set(['consume a meal', 'close panel']);

function normalizeMuseumLine(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

export function normalizeMuseumCategoryKey(categoryName: string): string {
  const normalizedName = normalizeMuseumLine(categoryName).toLowerCase();

  if (normalizedName === 'event items') {
    return 'event';
  }

  if (/ items$/u.test(normalizedName)) {
    return normalizedName.replace(/ items$/u, '');
  }

  return normalizedName;
}

function parsePersonalCategoryHeader(line: string): {
  categoryName: string;
  expectedOwnedCount: number;
  expectedTotalCount: number;
} | null {
  const match = line.match(PERSONAL_CATEGORY_HEADER_PATTERN);

  if (!match?.groups) {
    return null;
  }

  return {
    categoryName: normalizeMuseumLine(match.groups.name ?? ''),
    expectedOwnedCount: Number(match.groups.owned),
    expectedTotalCount: Number(match.groups.total),
  };
}

function isMissingMarker(line: string): boolean {
  return line === '-' || /^\?+$/u.test(line);
}

function commitPersonalCategory(
  categories: PersonalMuseumCategory[],
  warnings: string[],
  currentCategory: PersonalMuseumCategory | null,
): void {
  if (!currentCategory) {
    return;
  }

  currentCategory.parsedSlotCount = currentCategory.slots.length;
  currentCategory.seenCount = currentCategory.slots.filter((slot) => slot.status === 'seen').length;
  currentCategory.missingMarkerCount = currentCategory.slots.filter((slot) => slot.status === 'missing').length;
  currentCategory.countValidation =
    currentCategory.seenCount === currentCategory.expectedOwnedCount &&
    currentCategory.parsedSlotCount === currentCategory.expectedTotalCount
      ? 'matches_header'
      : 'mismatch';

  if (currentCategory.countValidation === 'mismatch') {
    warnings.push(
      `${currentCategory.categoryName}: parsed ${currentCategory.seenCount.toLocaleString()} seen items and ${currentCategory.missingMarkerCount.toLocaleString()} missing markers from ${currentCategory.parsedSlotCount.toLocaleString()} slots, but the header shows ${currentCategory.expectedOwnedCount.toLocaleString()} / ${currentCategory.expectedTotalCount.toLocaleString()}.`,
    );
  }

  categories.push(currentCategory);
}

export function parsePersonalMuseumExport(rawText: string): PersonalMuseumParseResult {
  const lines = rawText.split(/\r?\n/u).map(normalizeMuseumLine);
  const categories: PersonalMuseumCategory[] = [];
  const warnings: string[] = [];
  let currentCategory: PersonalMuseumCategory | null = null;

  for (const line of lines) {
    if (!line) {
      continue;
    }

    if (FOOTER_END_MARKERS.has(line.toLowerCase())) {
      break;
    }

    const categoryHeader = parsePersonalCategoryHeader(line);
    if (categoryHeader) {
      commitPersonalCategory(categories, warnings, currentCategory);
      currentCategory = {
        categoryName: categoryHeader.categoryName,
        categoryKey: normalizeMuseumCategoryKey(categoryHeader.categoryName),
        expectedOwnedCount: categoryHeader.expectedOwnedCount,
        expectedTotalCount: categoryHeader.expectedTotalCount,
        seenCount: 0,
        missingMarkerCount: 0,
        parsedSlotCount: 0,
        countValidation: 'mismatch',
        slots: [],
      };
      continue;
    }

    if (!currentCategory) {
      continue;
    }

    const slotIndex = currentCategory.slots.length;

    if (isMissingMarker(line)) {
      currentCategory.slots.push({
        slotIndex,
        status: 'missing',
      });
      continue;
    }

    const canonicalKey = toCanonicalItemKey(line);
    if (!canonicalKey) {
      continue;
    }

    currentCategory.slots.push({
      slotIndex,
      status: 'seen',
      itemName: line,
      canonicalKey,
    });
  }

  commitPersonalCategory(categories, warnings, currentCategory);

  if (categories.length === 0) {
    warnings.push('No museum completion categories were detected in the pasted personal museum export.');
  }

  const seenItemsParsed = categories.reduce((total, category) => total + category.seenCount, 0);
  const missingMarkersParsed = categories.reduce((total, category) => total + category.missingMarkerCount, 0);
  const totalSlotsParsed = categories.reduce((total, category) => total + category.parsedSlotCount, 0);

  return {
    categories,
    parseSummary: {
      categoriesParsed: categories.length,
      totalSlotsParsed,
      seenItemsParsed,
      missingMarkersParsed,
      warnings,
    },
  };
}

export function extractMuseumFullListMetadata(rawText: string): MuseumFullListMetadata {
  const lastUpdatedMatch = rawText.match(/\(Last Updated (?<updated>[^)]+)\)/u);
  const footerUpdatedMatch = rawText.match(/^(?<updated>\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s+by\s+.+)$/imu);

  return {
    lastUpdatedLabel: lastUpdatedMatch?.groups?.updated?.trim() ?? null,
    footerUpdatedLabel: footerUpdatedMatch?.groups?.updated?.trim() ?? null,
  };
}

function formatSourceLabel(metadata: MuseumFullListMetadata): string {
  return metadata.footerUpdatedLabel ?? metadata.lastUpdatedLabel ?? 'unknown update time';
}

export function deriveMuseumCompletionProgress(
  fullListRawText: string,
  personalRawText: string,
): MuseumCompletionProgress {
  const fullList = parseMuseumExport(fullListRawText);
  const personal = parsePersonalMuseumExport(personalRawText);
  const metadata = extractMuseumFullListMetadata(fullListRawText);
  const warnings = [...fullList.parseSummary.warnings, ...personal.parseSummary.warnings];
  const fullCategoriesByKey = new Map(
    fullList.categories.map((category) => [normalizeMuseumCategoryKey(category.categoryName), category]),
  );
  const seenCanonicalKeys = new Set<string>();

  for (const category of personal.categories) {
    for (const slot of category.slots) {
      if (slot.status === 'seen') {
        seenCanonicalKeys.add(slot.canonicalKey);
      }
    }
  }

  const knownMissingItems: MuseumCompletionMissingItem[] = [];
  const possibleMissingItems: MuseumCompletionMissingItem[] = [];
  const unresolvedSlots: MuseumCompletionUnresolvedSlot[] = [];
  const categories: MuseumCompletionCategoryProgress[] = [];

  for (const category of personal.categories) {
    const fullCategory = fullCategoriesByKey.get(category.categoryKey) ?? null;
    const fullListTotalCount = fullCategory?.parsedItemCount ?? null;
    const countStatus: MuseumCompletionCategoryProgress['countStatus'] =
      fullListTotalCount === null
        ? 'missing_full_category'
        : fullListTotalCount === category.expectedTotalCount
          ? 'matches_full_list'
          : 'full_list_mismatch';

    if (countStatus === 'missing_full_category') {
      warnings.push(`${category.categoryName}: no matching category was found in the full museum list.`);
    } else if (countStatus === 'full_list_mismatch' && fullListTotalCount !== null) {
      warnings.push(
        `${category.categoryName}: your museum export expects ${category.expectedTotalCount.toLocaleString()} slots, but the full museum list has ${fullListTotalCount.toLocaleString()} entries. Full list source: ${formatSourceLabel(metadata)}.`,
      );
    }

    const categoryKnownBefore = knownMissingItems.length;
    const categoryPossibleBefore = possibleMissingItems.length;
    const categoryUnresolvedBefore = unresolvedSlots.length;

    for (const slot of category.slots) {
      if (slot.status !== 'missing') {
        continue;
      }

      if (!fullCategory) {
        unresolvedSlots.push({
          categoryName: category.categoryName,
          categoryKey: category.categoryKey,
          slotIndex: slot.slotIndex,
          reason: 'missing_full_category',
          candidateItemName: null,
          candidateCanonicalKey: null,
        });
        continue;
      }

      const candidateItem = fullCategory.items[slot.slotIndex] ?? null;
      if (!candidateItem) {
        unresolvedSlots.push({
          categoryName: category.categoryName,
          categoryKey: category.categoryKey,
          slotIndex: slot.slotIndex,
          reason: 'missing_full_slot',
          candidateItemName: null,
          candidateCanonicalKey: null,
        });
        continue;
      }

      if (seenCanonicalKeys.has(candidateItem.canonicalKey)) {
        unresolvedSlots.push({
          categoryName: category.categoryName,
          categoryKey: category.categoryKey,
          slotIndex: slot.slotIndex,
          reason: 'candidate_seen_elsewhere',
          candidateItemName: candidateItem.itemName,
          candidateCanonicalKey: candidateItem.canonicalKey,
        });
        continue;
      }

      const missingItem: MuseumCompletionMissingItem = {
        categoryName: category.categoryName,
        categoryKey: category.categoryKey,
        slotIndex: slot.slotIndex,
        itemName: candidateItem.itemName,
        canonicalKey: candidateItem.canonicalKey,
        confidence: countStatus === 'matches_full_list' ? 'known' : 'possible_stale_full_list',
      };

      if (missingItem.confidence === 'known') {
        knownMissingItems.push(missingItem);
      } else {
        possibleMissingItems.push(missingItem);
      }
    }

    categories.push({
      categoryName: category.categoryName,
      categoryKey: category.categoryKey,
      seenCount: category.seenCount,
      expectedTotalCount: category.expectedTotalCount,
      missingMarkerCount: category.missingMarkerCount,
      knownMissingCount: knownMissingItems.length - categoryKnownBefore,
      possibleMissingCount: possibleMissingItems.length - categoryPossibleBefore,
      unresolvedMissingCount: unresolvedSlots.length - categoryUnresolvedBefore,
      fullListTotalCount,
      countStatus,
    });
  }

  const totalSlots = personal.parseSummary.totalSlotsParsed;
  const seenItems = personal.parseSummary.seenItemsParsed;

  return {
    fullList,
    personal,
    metadata,
    summary: {
      categoriesCount: categories.length,
      totalSlots,
      seenItems,
      missingMarkers: personal.parseSummary.missingMarkersParsed,
      knownMissingItems: knownMissingItems.length,
      possibleMissingItems: possibleMissingItems.length,
      unresolvedMissingSlots: unresolvedSlots.length,
      completionPercent: totalSlots > 0 ? (seenItems / totalSlots) * 100 : null,
    },
    categories,
    knownMissingItems,
    possibleMissingItems,
    unresolvedSlots,
    warnings: Array.from(new Set(warnings)),
  };
}

export function deriveMuseumCompletionFromPersonalExport(
  personalRawText: string,
  manualMissingItems: MuseumCompletionManualMissingEntry[],
  canonData: MuseumCompletionCanonData | null = null,
): MuseumCompletionManualProgress {
  const personal = parsePersonalMuseumExport(personalRawText);
  const warnings = [...personal.parseSummary.warnings];
  const categoriesByKey = new Map(personal.categories.map((category) => [category.categoryKey, category]));
  const seenCanonicalKeys = new Set<string>();

  for (const category of personal.categories) {
    for (const slot of category.slots) {
      if (slot.status === 'seen') {
        seenCanonicalKeys.add(slot.canonicalKey);
      }
    }
  }

  const canonNamedItems: MuseumCompletionManualMissingEntry[] = [];
  const canonSlotCountsByCategory = new Map<string, number>();
  const canonNamedKeys = new Set<string>();

  for (const category of personal.categories) {
    const canonEntries = canonData?.byCategoryKey[category.categoryKey] ?? [];

    if (canonEntries.length === 0) {
      continue;
    }

    if (canonEntries.length !== category.expectedTotalCount) {
      warnings.push(
        `${category.categoryName}: the reviewed museum list has ${canonEntries.length.toLocaleString()} slots, but your export expects ${category.expectedTotalCount.toLocaleString()}; unnamed slots remain until the list is updated.`,
      );
      continue;
    }

    const canonEntriesBySlot = new Map(canonEntries.map((entry) => [entry.slotIndex, entry]));

    for (const slot of category.slots) {
      if (slot.status !== 'missing') {
        continue;
      }

      const canonEntry = canonEntriesBySlot.get(slot.slotIndex + 1) ?? null;

      if (!canonEntry || canonEntry.reviewStatus === 'ambiguous' || canonEntry.reviewStatus === 'stale') {
        continue;
      }

      if (seenCanonicalKeys.has(canonEntry.canonicalKey)) {
        warnings.push(
          `${canonEntry.itemName}: the reviewed museum list suggests this missing slot, but the item appears elsewhere in your current export.`,
        );
        continue;
      }

      canonNamedItems.push(toCanonMissingEntry(category, canonEntry));
      canonNamedKeys.add(canonEntry.canonicalKey);
      canonSlotCountsByCategory.set(
        category.categoryKey,
        (canonSlotCountsByCategory.get(category.categoryKey) ?? 0) + 1,
      );
    }
  }

  const usableManualItems: MuseumCompletionManualMissingEntry[] = [];
  const manualSlotCountsByCategory = new Map<string, number>();

  for (const entry of manualMissingItems) {
    const category = categoriesByKey.get(entry.categoryKey);

    if (!category) {
      warnings.push(
        `${entry.itemName}: saved museum review entry is for ${entry.categoryName}, but that category was not found in the current museum export.`,
      );
      continue;
    }

    if (seenCanonicalKeys.has(entry.canonicalKey)) {
      warnings.push(
        `${entry.itemName}: saved museum review entry looks resolved because this item appears in the current museum export.`,
      );
      continue;
    }

    if (canonNamedKeys.has(entry.canonicalKey)) {
      continue;
    }

    usableManualItems.push(entry);
    manualSlotCountsByCategory.set(
      entry.categoryKey,
      (manualSlotCountsByCategory.get(entry.categoryKey) ?? 0) + entry.slotCount,
    );
  }

  const categories = personal.categories.map((category): MuseumCompletionManualCategoryProgress => {
    const manualSlotCount = manualSlotCountsByCategory.get(category.categoryKey) ?? 0;
    const canonSlotCount = canonSlotCountsByCategory.get(category.categoryKey) ?? 0;
    const namedMissingCount = Math.min(category.missingMarkerCount, canonSlotCount + manualSlotCount);

    if (manualSlotCount > category.missingMarkerCount) {
      warnings.push(
        `${category.categoryName}: saved reviewed missing items cover ${manualSlotCount.toLocaleString()} slots, but the current museum export only has ${category.missingMarkerCount.toLocaleString()} missing markers in this category.`,
      );
    }

    return {
      categoryName: category.categoryName,
      categoryKey: category.categoryKey,
      seenCount: category.seenCount,
      expectedTotalCount: category.expectedTotalCount,
      missingMarkerCount: category.missingMarkerCount,
      namedMissingCount,
      unresolvedMissingCount: Math.max(0, category.missingMarkerCount - namedMissingCount),
    };
  });

  const totalSlots = personal.parseSummary.totalSlotsParsed;
  const seenItems = personal.parseSummary.seenItemsParsed;
  const namedMissingSlots = categories.reduce((total, category) => total + category.namedMissingCount, 0);
  const unresolvedMissingSlots = categories.reduce(
    (total, category) => total + category.unresolvedMissingCount,
    0,
  );

  return {
    personal,
    summary: {
      categoriesCount: categories.length,
      totalSlots,
      seenItems,
      missingMarkers: personal.parseSummary.missingMarkersParsed,
      namedMissingItems: canonNamedItems.length + usableManualItems.length,
      namedMissingSlots,
      unresolvedMissingSlots,
      completionPercent: totalSlots > 0 ? (seenItems / totalSlots) * 100 : null,
    },
    categories,
    namedMissingItems: [...canonNamedItems, ...usableManualItems],
    warnings: Array.from(new Set(warnings)),
  };
}

function toCanonMissingEntry(
  category: PersonalMuseumCategory,
  canonEntry: MuseumCompletionCanonEntry,
): MuseumCompletionManualMissingEntry {
  return {
    id: `canon-${category.categoryKey}-${canonEntry.slotIndex}`,
    categoryKey: category.categoryKey,
    categoryName: category.categoryName,
    itemName: canonEntry.itemName,
    canonicalKey: canonEntry.canonicalKey,
    slotCount: 1,
    note: canonEntry.notes ?? '',
  };
}
