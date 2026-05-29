import { loadItemAliases, resolveItemAlias, type ItemAliasData, type ItemAliasEntry } from './itemAliases';
import { loadItemCatalog, type ItemCatalogData, type ItemCatalogEntry } from './loadItemCatalog';
import {
  loadMuseumCompletionCanon,
  type MuseumCompletionCanonData,
  type MuseumCompletionCanonEntry,
} from './loadMuseumCompletionCanon';
import {
  loadMuseumLookupCoverage,
  type MuseumLookupCoverageData,
  type MuseumLookupCoverageEntry,
} from './loadMuseumLookupCoverage';
import { toCanonicalItemKey } from './normalizeItemKey';

export type LocalItemReferenceRecognitionStatus =
  | 'catalog'
  | 'alias'
  | 'museum_only'
  | 'museum_canon'
  | 'unrecognized';

export type LocalItemReferenceLookup = {
  itemCatalog: ItemCatalogData;
  aliases: ItemAliasData;
  museumCoverage: MuseumLookupCoverageData;
  museumCanon?: MuseumCompletionCanonData;
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
  museumCanonEntry: MuseumCompletionCanonEntry | null;
  masteryPossible: ItemCatalogEntry['masteryPossible'] | 'unknown';
  sourceDatasets: string[];
  warnings: string[];
};

export function createLocalItemReferenceLookup(input: {
  itemCatalog: ItemCatalogData;
  aliases: ItemAliasData;
  museumCoverage: MuseumLookupCoverageData;
  museumCanon?: MuseumCompletionCanonData;
}): LocalItemReferenceLookup {
  return input;
}

function getSourceDatasets(
  catalogEntry: ItemCatalogEntry | null,
  museumEntry: MuseumLookupCoverageEntry | null,
  museumCanonEntry: MuseumCompletionCanonEntry | null,
  matchedAlias: ItemAliasEntry | null,
): string[] {
  const sourceDatasets = new Set<string>();

  for (const sourceDataset of catalogEntry?.sourceDatasets ?? []) {
    sourceDatasets.add(sourceDataset);
  }

  if (museumEntry) {
    sourceDatasets.add('museum_lookup_coverage');
  }

  if (museumCanonEntry) {
    sourceDatasets.add('museum_completion_canon');
  }

  if (matchedAlias) {
    sourceDatasets.add('item_aliases');
  }

  return [...sourceDatasets].sort((left, right) => left.localeCompare(right));
}

function findMuseumCanonEntry(
  museumCanon: MuseumCompletionCanonData | undefined,
  canonicalKey: string,
): MuseumCompletionCanonEntry | null {
  return museumCanon?.entries.find((entry) => entry.canonicalKey === canonicalKey) ?? null;
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
  const museumCanonEntry = findMuseumCanonEntry(lookup.museumCanon, canonicalKey);
  const unapprovedAlias = !matchedAlias ? lookup.aliases.byAliasKey[inputKey] ?? null : null;
  const recognized = Boolean(catalogEntry || museumEntry || museumCanonEntry);
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

  if (!catalogEntry && !museumEntry && museumCanonEntry) {
    warnings.push('Recognized from museum completion canon only; do not infer mastery eligibility.');
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
        : museumCanonEntry
          ? 'museum_canon'
          : 'unrecognized';

  return {
    inputName: trimmedInputName,
    inputKey,
    canonicalKey,
    displayName:
      catalogEntry?.itemName ??
      museumEntry?.itemName ??
      museumCanonEntry?.itemName ??
      matchedAlias?.canonicalItemName ??
      trimmedInputName,
    recognized,
    recognitionStatus,
    matchedAlias,
    catalogEntry,
    museumEntry,
    museumCanonEntry,
    masteryPossible: catalogEntry?.masteryPossible ?? 'unknown',
    sourceDatasets: getSourceDatasets(catalogEntry, museumEntry, museumCanonEntry, matchedAlias),
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
  const [itemCatalog, aliases, museumCoverage, museumCanon] = await Promise.all([
    loadItemCatalog(),
    loadItemAliases(),
    loadMuseumLookupCoverage(),
    loadMuseumCompletionCanon(),
  ]);

  return createLocalItemReferenceLookup({
    itemCatalog,
    aliases,
    museumCoverage,
    museumCanon,
  });
}
