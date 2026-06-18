import { deriveAvailableSupplyPool } from './availableSupply';
import type { AcquisitionPlannerInputState } from './acquisitionPlannerState';
import type { DropRateAcquisitionSettings } from './dropRateAcquisitionSettings';
import {
  convertDropRateUnit,
  getDropRateUnitBasis,
  getPreferredDropRateUnit,
  normalizeDropRateSourceType,
  type DropRateDisplayUnit,
} from './dropRateUnitConversions';
import type { DropRateReferenceData, DropRateReferenceEntry } from './loadDropRateReference';
import type { PetSourceReferenceData, PetSourceReferenceEntry } from './loadPetSourceReference';
import type { QuestFutureDemandRow } from './questHistoryPlanning';
import { getSourceRateAssumption, type SourceRateAssumptionsState } from './sourceRateAssumptions';

export type QuestSourceBurdenSeverity = 'scary' | 'watch' | 'ok' | 'unknown';

export type QuestSourceBurdenOption = {
  sourceKey: string;
  sourceName: string;
  sourceType: string;
  coverage: 'drop_rate' | 'source_hint' | 'pet_source';
  unitLabel: string;
  sourceUnitQuantity: number | null;
  dailyRate: number | null;
  days: number | null;
  sourceUrl: string | null;
  notes: string[];
};

export type QuestSourceBurdenRow = {
  canonicalKey: string;
  itemName: string;
  totalQuantity: number;
  availableQuantity: number;
  remainingQuantity: number;
  questCount: number;
  questNames: string[];
  burdenOptions: QuestSourceBurdenOption[];
  bestOption: QuestSourceBurdenOption | null;
  prepDays: number | null;
  severity: QuestSourceBurdenSeverity;
  reasons: string[];
};

export type QuestSourceBurdenAnalytics = {
  rows: QuestSourceBurdenRow[];
  scaryRows: QuestSourceBurdenRow[];
  rowsByCanonicalKey: Map<string, QuestSourceBurdenRow>;
  warnings: string[];
};

export type QuestSourceAllocationInput = {
  waitDays: number;
  allocations: {
    canonicalKey: string;
    allocationPercent: number;
  }[];
};

export type QuestSourceAllocationRow = {
  canonicalKey: string;
  itemName: string;
  allocationPercent: number;
  sourceName: string;
  unitLabel: string;
  dailySourceUnits: number;
  projectedSourceUnits: number;
  projectedItemQuantity: number;
  remainingAfterWait: number;
  warnings: string[];
};

export type QuestSourceAllocationScenario = {
  waitDays: number;
  rows: QuestSourceAllocationRow[];
  warnings: string[];
};

export const DEFAULT_SCARY_PREP_DAYS_THRESHOLD = 7;

function clampNonNegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, value));
}

function normalizeSourceRateKey(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/gu, '_').replace(/^_+|_+$/gu, '');
}

function getBaseDropRateUnit(sourceType: string): DropRateDisplayUnit | null {
  const normalizedSourceType = normalizeDropRateSourceType(sourceType);

  if (normalizedSourceType === 'explore') {
    return 'explores';
  }

  if (normalizedSourceType === 'fishing') {
    return 'fish';
  }

  if (normalizedSourceType === 'farming') {
    return 'crops';
  }

  return null;
}

function getSourceRateKeys(unit: string, sourceName: string): string[] {
  const normalizedUnit = normalizeSourceRateKey(unit);
  const normalizedSourceName = normalizeSourceRateKey(sourceName);
  const aliases: Record<string, string> = {
    arnold_palmer: 'arnold_palmers',
    large_net: 'large_nets',
    apple_cider: 'apple_ciders',
    explore: 'explores',
    wishing_well_throw: 'wishing_well_throws',
    wishing_well: 'wishing_well_throws',
    pet_day: 'pet_days',
    pet: 'pet_days',
  };

  return Array.from(new Set([
    aliases[normalizedUnit] ?? normalizedUnit,
    aliases[normalizedSourceName] ?? normalizedSourceName,
  ])).filter(Boolean);
}

function getDailyRate(
  sourceRateState: SourceRateAssumptionsState,
  unit: string,
  sourceName: string,
): number | null {
  for (const sourceRateKey of getSourceRateKeys(unit, sourceName)) {
    const rate = getSourceRateAssumption(sourceRateState, sourceRateKey);

    if (rate && rate.dailyQuantity > 0) {
      return rate.dailyQuantity;
    }
  }

  return null;
}

function dropRateRowMatchesSettings(
  row: DropRateReferenceEntry,
  settings: DropRateAcquisitionSettings,
): boolean {
  if (row.ironDepot !== null && row.ironDepot !== settings.perks.ironDepotActive) {
    return false;
  }

  if (row.runecube !== null && row.runecube !== settings.perks.eagleEyeRunecubeActive) {
    return false;
  }

  return true;
}

function buildDropRateOption(input: {
  row: DropRateReferenceEntry;
  remainingQuantity: number;
  sourceRateState: SourceRateAssumptionsState;
  dropRateSettings: DropRateAcquisitionSettings;
}): QuestSourceBurdenOption | null {
  const preferredUnit = getPreferredDropRateUnit(input.row.sourceType, input.dropRateSettings);
  const baseUnit = getBaseDropRateUnit(input.row.sourceType);

  if (!preferredUnit || !baseUnit || input.row.rawRate <= 0) {
    return null;
  }

  const conversion = convertDropRateUnit({
    rate: input.row.rawRate,
    sourceType: input.row.sourceType,
    fromUnit: baseUnit,
    toUnit: preferredUnit,
    direction: 'units_per_item',
    settings: input.dropRateSettings,
    baseDropRate: input.row.baseDropRate,
  });

  if (!conversion.calculable || conversion.rate <= 0) {
    return null;
  }

  const unitBasis = getDropRateUnitBasis(
    input.row.sourceType,
    preferredUnit,
    input.dropRateSettings,
    input.row.baseDropRate,
  );
  const sourceUnitQuantity = input.remainingQuantity * conversion.rate;
  const dailyRate = getDailyRate(input.sourceRateState, preferredUnit, input.row.sourceName);
  const days = dailyRate && dailyRate > 0 ? sourceUnitQuantity / dailyRate : null;

  return {
    sourceKey: `drop-rate:${input.row.sourceCanonicalKey}:${preferredUnit}`,
    sourceName: input.row.sourceName,
    sourceType: input.row.sourceType,
    coverage: 'drop_rate',
    unitLabel: unitBasis?.label ?? preferredUnit,
    sourceUnitQuantity,
    dailyRate,
    days,
    sourceUrl: input.row.sourcePageUrl,
    notes: input.row.notes,
  };
}

function buildSourceHintOptions(input: {
  row: QuestFutureDemandRow;
  sourceRateState: SourceRateAssumptionsState;
}): QuestSourceBurdenOption[] {
  return input.row.sourceHints.map((sourceHint) => {
    const dailyRate = getDailyRate(input.sourceRateState, sourceHint.preferredUnit, sourceHint.sourceName);

    return {
      sourceKey: `source-hint:${sourceHint.sourceCanonicalKey}:${sourceHint.preferredUnit}`,
      sourceName: sourceHint.sourceName,
      sourceType: sourceHint.sourceType,
      coverage: 'source_hint' as const,
      unitLabel: sourceHint.preferredUnit,
      sourceUnitQuantity: null,
      dailyRate,
      days: null,
      sourceUrl: sourceHint.sourceUrl,
      notes: sourceHint.notes,
    };
  });
}

function buildPetSourceOptions(input: {
  row: QuestFutureDemandRow;
  petSourceReference: PetSourceReferenceData | null | undefined;
}): QuestSourceBurdenOption[] {
  const petSources: PetSourceReferenceEntry[] = input.petSourceReference?.byItemCanonicalKey[input.row.canonicalKey] ?? [];

  return petSources.map((petSource) => ({
    sourceKey: `pet-source:${petSource.petCanonicalKey}`,
    sourceName: petSource.petName,
    sourceType: 'pet',
    coverage: 'pet_source' as const,
    unitLabel: 'pet source',
    sourceUnitQuantity: null,
    dailyRate: null,
    days: null,
    sourceUrl: petSource.sourceUrl,
    notes: [
      `Unlocks at pet level ${petSource.unlockLevel}.`,
      petSource.petAvailability === 'seasonal' ? 'Seasonal pet.' : 'Normal pet.',
      ...petSource.notes,
    ],
  }));
}

function chooseBestOption(options: QuestSourceBurdenOption[]): QuestSourceBurdenOption | null {
  return [...options].sort((left, right) => {
    if (left.days !== null || right.days !== null) {
      return (left.days ?? Number.POSITIVE_INFINITY) - (right.days ?? Number.POSITIVE_INFINITY);
    }

    if (left.sourceUnitQuantity !== null || right.sourceUnitQuantity !== null) {
      return (left.sourceUnitQuantity ?? Number.POSITIVE_INFINITY) - (right.sourceUnitQuantity ?? Number.POSITIVE_INFINITY);
    }

    return left.sourceName.localeCompare(right.sourceName);
  })[0] ?? null;
}

function classifySeverity(input: {
  remainingQuantity: number;
  bestOption: QuestSourceBurdenOption | null;
  thresholdDays: number;
}): QuestSourceBurdenSeverity {
  if (input.remainingQuantity <= 0) {
    return 'ok';
  }

  if (input.bestOption?.days !== null && input.bestOption?.days !== undefined) {
    if (input.bestOption.days > input.thresholdDays) {
      return 'scary';
    }

    if (input.bestOption.days > input.thresholdDays / 2) {
      return 'watch';
    }

    return 'ok';
  }

  if (input.bestOption) {
    return 'watch';
  }

  return 'unknown';
}

function getReasons(input: {
  row: QuestFutureDemandRow;
  remainingQuantity: number;
  bestOption: QuestSourceBurdenOption | null;
  severity: QuestSourceBurdenSeverity;
  thresholdDays: number;
}): string[] {
  const reasons: string[] = [];

  if (input.remainingQuantity <= 0) {
    reasons.push('already covered by counted supply');
  }

  if (input.bestOption?.days !== null && input.bestOption?.days !== undefined) {
    reasons.push(
      `${input.bestOption.days.toFixed(input.bestOption.days < 10 ? 1 : 0)} days at current ${input.bestOption.unitLabel}/day`,
    );
  } else if (input.bestOption?.sourceUnitQuantity !== null && input.bestOption?.sourceUnitQuantity !== undefined) {
    reasons.push('source units can be estimated, but no daily rate is saved');
  } else if (input.bestOption) {
    reasons.push('source path is known, but exact units are not reviewed yet');
  } else {
    reasons.push('no reviewed source path is available yet');
  }

  if (input.severity === 'scary') {
    reasons.push(`above ${input.thresholdDays.toLocaleString()} day prep threshold`);
  }

  if (input.row.requirements.length > 1) {
    reasons.push(`needed by ${input.row.requirements.length.toLocaleString()} known requirement rows`);
  }

  if (input.row.sourceHints.some((sourceHint) => normalizeDropRateSourceType(sourceHint.sourceType) === 'fishing')) {
    reasons.push('competes for fishing resources');
  }

  return Array.from(new Set(reasons));
}

export function deriveQuestSourceBurdenAnalytics(input: {
  demandRows: QuestFutureDemandRow[];
  sourceRateState: SourceRateAssumptionsState;
  scaryThresholdDays?: number;
  acquisitionState?: AcquisitionPlannerInputState | null;
  petSourceReference?: PetSourceReferenceData | null;
  dropRateReference?: DropRateReferenceData | null;
  dropRateSettings?: DropRateAcquisitionSettings | null;
}): QuestSourceBurdenAnalytics {
  const thresholdDays = clampNonNegative(input.scaryThresholdDays ?? DEFAULT_SCARY_PREP_DAYS_THRESHOLD) ||
    DEFAULT_SCARY_PREP_DAYS_THRESHOLD;
  const supplyPool = input.acquisitionState
    ? deriveAvailableSupplyPool({
      acquisitionState: input.acquisitionState,
      petSourceReference: input.petSourceReference,
    })
    : null;
  const warnings = [...(supplyPool?.warnings ?? [])];
  const rows = input.demandRows.map((demandRow) => {
    const availableQuantity = Math.min(
      demandRow.totalQuantity,
      supplyPool?.byCanonicalKey[demandRow.canonicalKey]?.effectiveQuantity ?? 0,
    );
    const remainingQuantity = Math.max(0, demandRow.totalQuantity - availableQuantity);
    const matchingDropRateRows = input.dropRateReference?.byTargetCanonicalKey[demandRow.canonicalKey]
      ?.filter((row) => (input.dropRateSettings ? dropRateRowMatchesSettings(row, input.dropRateSettings) : true)) ?? [];
    const dropRateOptions = input.dropRateSettings
      ? matchingDropRateRows
        .map((row) => buildDropRateOption({
          row,
          remainingQuantity,
          sourceRateState: input.sourceRateState,
          dropRateSettings: input.dropRateSettings as DropRateAcquisitionSettings,
        }))
        .filter((option): option is QuestSourceBurdenOption => Boolean(option))
      : [];
    const burdenOptions = [
      ...dropRateOptions,
      ...buildPetSourceOptions({ row: demandRow, petSourceReference: input.petSourceReference }),
      ...(dropRateOptions.length === 0
        ? buildSourceHintOptions({ row: demandRow, sourceRateState: input.sourceRateState })
        : []),
    ];
    const bestOption = chooseBestOption(burdenOptions);
    const severity = classifySeverity({
      remainingQuantity,
      bestOption,
      thresholdDays,
    });

    return {
      canonicalKey: demandRow.canonicalKey,
      itemName: demandRow.itemName,
      totalQuantity: demandRow.totalQuantity,
      availableQuantity,
      remainingQuantity,
      questCount: demandRow.questCount,
      questNames: Array.from(new Set(demandRow.requirements.map((requirement) => requirement.questName))).sort(),
      burdenOptions,
      bestOption,
      prepDays: bestOption?.days ?? null,
      severity,
      reasons: getReasons({
        row: demandRow,
        remainingQuantity,
        bestOption,
        severity,
        thresholdDays,
      }),
    };
  }).sort((left, right) => {
    const severityRank: Record<QuestSourceBurdenSeverity, number> = {
      scary: 0,
      watch: 1,
      unknown: 2,
      ok: 3,
    };

    if (severityRank[left.severity] !== severityRank[right.severity]) {
      return severityRank[left.severity] - severityRank[right.severity];
    }

    if ((right.prepDays ?? 0) !== (left.prepDays ?? 0)) {
      return (right.prepDays ?? 0) - (left.prepDays ?? 0);
    }

    if (right.remainingQuantity !== left.remainingQuantity) {
      return right.remainingQuantity - left.remainingQuantity;
    }

    return left.itemName.localeCompare(right.itemName);
  });

  return {
    rows,
    scaryRows: rows.filter((row) => row.severity === 'scary' || row.severity === 'watch').slice(0, 20),
    rowsByCanonicalKey: new Map(rows.map((row) => [row.canonicalKey, row])),
    warnings,
  };
}

export function deriveQuestSourceAllocationScenario(
  burden: QuestSourceBurdenAnalytics,
  input: QuestSourceAllocationInput,
): QuestSourceAllocationScenario {
  const waitDays = clampNonNegative(input.waitDays);
  const warnings: string[] = [];
  const rows = input.allocations
    .map((allocation) => {
      const burdenRow = burden.rowsByCanonicalKey.get(allocation.canonicalKey);
      const allocationPercent = clampPercent(allocation.allocationPercent);

      if (!burdenRow || !burdenRow.bestOption) {
        return null;
      }

      const bestOption = burdenRow.bestOption;

      if (
        bestOption.sourceUnitQuantity === null ||
        bestOption.dailyRate === null ||
        bestOption.sourceUnitQuantity <= 0 ||
        bestOption.dailyRate <= 0 ||
        burdenRow.remainingQuantity <= 0
      ) {
        return {
          canonicalKey: burdenRow.canonicalKey,
          itemName: burdenRow.itemName,
          allocationPercent,
          sourceName: bestOption.sourceName,
          unitLabel: bestOption.unitLabel,
          dailySourceUnits: 0,
          projectedSourceUnits: 0,
          projectedItemQuantity: 0,
          remainingAfterWait: burdenRow.remainingQuantity,
          warnings: ['This item needs a reviewed source-unit estimate and a saved daily source rate before allocation can be modeled.'],
        };
      }

      const sourceUnitsPerItem = bestOption.sourceUnitQuantity / burdenRow.remainingQuantity;
      const dailySourceUnits = bestOption.dailyRate * (allocationPercent / 100);
      const projectedSourceUnits = dailySourceUnits * waitDays;
      const projectedItemQuantity = Math.min(
        burdenRow.remainingQuantity,
        sourceUnitsPerItem > 0 ? projectedSourceUnits / sourceUnitsPerItem : 0,
      );

      return {
        canonicalKey: burdenRow.canonicalKey,
        itemName: burdenRow.itemName,
        allocationPercent,
        sourceName: bestOption.sourceName,
        unitLabel: bestOption.unitLabel,
        dailySourceUnits,
        projectedSourceUnits,
        projectedItemQuantity,
        remainingAfterWait: Math.max(0, burdenRow.remainingQuantity - projectedItemQuantity),
        warnings: [],
      };
    })
    .filter((row): row is QuestSourceAllocationRow => Boolean(row));
  const totalAllocationPercent = input.allocations.reduce((sum, row) => sum + clampPercent(row.allocationPercent), 0);

  if (totalAllocationPercent > 100) {
    warnings.push('Allocation is over 100%; lower one or more rows to keep the scenario realistic.');
  }

  return {
    waitDays,
    rows,
    warnings,
  };
}
