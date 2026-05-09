import { loadItemAliases, resolveItemAlias, type ItemAliasData, type ItemAliasEntry } from './itemAliases';
import { loadItemCatalog, type ItemCatalogData, type ItemCatalogEntry } from './loadItemCatalog';
import {
  loadMuseumLookupCoverage,
  type MuseumLookupCoverageData,
  type MuseumLookupCoverageEntry,
} from './loadMuseumLookupCoverage';
import { toCanonicalItemKey } from './normalizeItemKey';

export type LocalItemReferenceRecognitionStatus = 'catalog' | 'alias' | 'museum_only' | 'unrecognized';

export type LocalItemReferenceLookup = {
  itemCatalog: ItemCatalogData;
  aliases: ItemAliasData;
  museumCoverage: MuseumLookupCoverageData;
};

export type LocalItemReferenceResult = {
  inputName: string;
  inputKey: string;
  canonicalKey: string;
  displayName: string;
  recognized: boolean;
  recognitionStatus: LocalItemReferenceRecognitionStatus;
  matchedAlias: ItemAliasEntry | null;
  catalogEntry: ItemCatalogEntry | null;
  museumEntry: MuseumLookupCoverageEntry | null;
  masteryPossible: ItemCatalogEntry['masteryPossible'] | 'unknown';
  sourceDatasets: string[];
  warnings: string[];
};

export function createLocalItemReferenceLookup(input: {
  itemCatalog: ItemCatalogData;
  aliases: ItemAliasData;
  museumCoverage: MuseumLookupCoverageData;
}): LocalItemReferenceLookup {
  return input;
}

function getSourceDatasets(
  catalogEntry: ItemCatalogEntry | null,
  museumEntry: MuseumLookupCoverageEntry | null,
  matchedAlias: ItemAliasEntry | null,
): string[] {
  const sourceDatasets = new Set<string>();

  for (const sourceDataset of catalogEntry?.sourceDatasets ?? []) {
    sourceDatasets.add(sourceDataset);
  }

  if (museumEntry) {
    sourceDatasets.add('museum_lookup_coverage');
  }

  if (matchedAlias) {
    sourceDatasets.add('item_aliases');
  }

  return [...sourceDatasets].sort((left, right) => left.localeCompare(right));
}

export function resolveLocalItemReference(
  inputName: string,
  lookup: LocalItemReferenceLookup,
): LocalItemReferenceResult {
  const trimmedInputName = inputName.trim();
  const inputKey = toCanonicalItemKey(trimmedInputName);
  const aliasResolution = resolveItemAlias(trimmedInputName, lookup.aliases);
  const canonicalKey = aliasResolution.canonicalKey;
  const matchedAlias = aliasResolution.matchedAlias;
  const catalogEntry = lookup.itemCatalog.byCanonicalKey[canonicalKey] ?? null;
  const museumEntry = lookup.museumCoverage.byCanonicalKey[canonicalKey] ?? null;
  const unapprovedAlias = !matchedAlias ? lookup.aliases.byAliasKey[inputKey] ?? null : null;
  const recognized = Boolean(catalogEntry || museumEntry);
  const warnings: string[] = [];

  if (unapprovedAlias) {
    warnings.push(
      `Alias "${unapprovedAlias.aliasName}" is ${unapprovedAlias.reviewStatus}; unresolved until it is approved.`,
    );
  }

  if (matchedAlias && !recognized) {
    warnings.push(
      `Approved alias "${matchedAlias.aliasName}" maps to "${matchedAlias.canonicalItemName}", but that target is missing from local reference coverage.`,
    );
  }

  if (!catalogEntry && museumEntry) {
    warnings.push('Recognized from museum lookup coverage only; do not infer mastery eligibility.');
  }

  if (!recognized) {
    warnings.push('No local item reference coverage found; keep this visible as a review candidate.');
  }

  const recognitionStatus: LocalItemReferenceRecognitionStatus = matchedAlias
    ? 'alias'
    : catalogEntry
      ? 'catalog'
      : museumEntry
        ? 'museum_only'
        : 'unrecognized';

  return {
    inputName: trimmedInputName,
    inputKey,
    canonicalKey,
    displayName: catalogEntry?.itemName ?? museumEntry?.itemName ?? matchedAlias?.canonicalItemName ?? trimmedInputName,
    recognized,
    recognitionStatus,
    matchedAlias,
    catalogEntry,
    museumEntry,
    masteryPossible: catalogEntry?.masteryPossible ?? 'unknown',
    sourceDatasets: getSourceDatasets(catalogEntry, museumEntry, matchedAlias),
    warnings,
  };
}

function escapeCsvValue(value: string): string {
  if (/[",\n]/u.test(value)) {
    return `"${value.replace(/"/gu, '""')}"`;
  }

  return value;
}

export function toLocalItemReferenceReviewCsv(results: LocalItemReferenceResult[]): string {
  const rows = [
    'observed_item_name,observed_key,resolved_canonical_key,display_name,recognition_status,recognized,mastery_possible,source_datasets,warnings',
  ];

  for (const result of results.filter((entry) => !entry.recognized || entry.warnings.length > 0)) {
    rows.push(
      [
        result.inputName,
        result.inputKey,
        result.canonicalKey,
        result.displayName,
        result.recognitionStatus,
        result.recognized ? 'Y' : 'N',
        result.masteryPossible,
        result.sourceDatasets.join('; '),
        result.warnings.join('; '),
      ]
        .map(escapeCsvValue)
        .join(','),
    );
  }

  return rows.join('\n');
}

export async function loadLocalItemReferenceLookup(): Promise<LocalItemReferenceLookup> {
  const [itemCatalog, aliases, museumCoverage] = await Promise.all([
    loadItemCatalog(),
    loadItemAliases(),
    loadMuseumLookupCoverage(),
  ]);

  return createLocalItemReferenceLookup({
    itemCatalog,
    aliases,
    museumCoverage,
  });
}
