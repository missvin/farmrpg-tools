import { describe, expect, it } from 'vitest';

import { createDefaultAcquisitionPlannerInputState } from './acquisitionPlannerState';
import { createDefaultDropRateAcquisitionSettings } from './dropRateAcquisitionSettings';
import type { DropRateReferenceData, DropRateReferenceEntry } from './loadDropRateReference';
import type { QuestFutureDemandRow } from './questHistoryPlanning';
import {
  deriveQuestSourceAllocationScenario,
  deriveQuestSourceBurdenAnalytics,
} from './questSourceBurden';
import { createDefaultSourceRateAssumptionsState, upsertSourceRateAssumption } from './sourceRateAssumptions';

function createDropRateRow(input: {
  targetItemName: string;
  targetCanonicalKey: string;
  sourceName: string;
  sourceCanonicalKey: string;
  sourceType: 'explore' | 'fishing';
  rawRate: number;
}): DropRateReferenceEntry {
  return {
    targetItemName: input.targetItemName,
    targetCanonicalKey: input.targetCanonicalKey,
    sourceName: input.sourceName,
    sourceCanonicalKey: input.sourceCanonicalKey,
    sourceType: input.sourceType,
    sourceKind: 'location',
    rowKind: 'item_source',
    rawRate: input.rawRate,
    baseDropRate: null,
    sourcePageType: 'item',
    sourcePageName: input.targetItemName,
    sourcePageUrl: `https://buddy.farm/i/${input.targetCanonicalKey.replace(/\s+/gu, '-')}/`,
    pageDataUrl: '',
    targetItemId: null,
    targetItemImage: null,
    sourceImage: null,
    ironDepot: null,
    manualFishing: null,
    runecube: null,
    flags: [],
    notes: [],
  };
}

function createDropRateReference(rows: DropRateReferenceEntry[]): DropRateReferenceData {
  return {
    entries: rows,
    byTargetCanonicalKey: rows.reduce<Record<string, DropRateReferenceEntry[]>>((lookup, row) => {
      lookup[row.targetCanonicalKey] = [...(lookup[row.targetCanonicalKey] ?? []), row];
      return lookup;
    }, {}),
  };
}

function createDemandRow(input: {
  canonicalKey: string;
  itemName: string;
  totalQuantity: number;
  questName?: string;
}): QuestFutureDemandRow {
  return {
    canonicalKey: input.canonicalKey,
    itemName: input.itemName,
    totalQuantity: input.totalQuantity,
    questCount: 1,
    requirements: [
      {
        questKey: input.questName ?? 'future quest',
        questName: input.questName ?? 'Future Quest',
        questlineKey: 'future line',
        questlineName: 'Future Line',
        quantity: input.totalQuantity,
        scope: 'future_chain',
      },
    ],
    scopes: [{ scope: 'future_chain', quantity: input.totalQuantity }],
    sourceHints: [],
  };
}

describe('deriveQuestSourceBurdenAnalytics', () => {
  it('turns future quest demand into source units and prep days', () => {
    const dropRateReference = createDropRateReference([
      createDropRateRow({
        targetItemName: 'Lima Bean',
        targetCanonicalKey: 'lima bean',
        sourceName: 'Cane Pole Ridge',
        sourceCanonicalKey: 'cane pole ridge',
        sourceType: 'explore',
        rawRate: 19_800,
      }),
      createDropRateRow({
        targetItemName: 'Frost Snapper Shell',
        targetCanonicalKey: 'frost snapper shell',
        sourceName: 'Large Net',
        sourceCanonicalKey: 'large net',
        sourceType: 'fishing',
        rawRate: 19_730,
      }),
    ]);
    const sourceRates = upsertSourceRateAssumption(
      upsertSourceRateAssumption(createDefaultSourceRateAssumptionsState(), {
        sourceKey: 'arnold_palmers',
        label: 'Arnold Palmers',
        dailyQuantity: 200,
      }),
      {
        sourceKey: 'large_nets',
        label: 'Large Nets',
        dailyQuantity: 2000,
      },
    );
    const acquisitionState = createDefaultAcquisitionPlannerInputState();

    acquisitionState.inventory.entries.push({
      canonicalItemKey: 'frost snapper shell',
      itemName: 'Frost Snapper Shell',
      inventoryCount: 6245,
    });

    const analytics = deriveQuestSourceBurdenAnalytics({
      demandRows: [
        createDemandRow({
          canonicalKey: 'lima bean',
          itemName: 'Lima Bean',
          totalQuantity: 1250,
        }),
        createDemandRow({
          canonicalKey: 'frost snapper shell',
          itemName: 'Frost Snapper Shell',
          totalQuantity: 15000,
        }),
      ],
      sourceRateState: sourceRates,
      acquisitionState,
      dropRateReference,
      dropRateSettings: createDefaultDropRateAcquisitionSettings(),
    });

    expect(analytics.rowsByCanonicalKey.get('lima bean')).toMatchObject({
      itemName: 'Lima Bean',
      remainingQuantity: 1250,
      severity: 'scary',
      prepDays: 247.5,
    });
    expect(analytics.rowsByCanonicalKey.get('lima bean')?.bestOption).toMatchObject({
      unitLabel: 'Arnold Palmer',
      sourceUnitQuantity: 49_500,
      dailyRate: 200,
    });
    expect(analytics.rowsByCanonicalKey.get('frost snapper shell')).toMatchObject({
      availableQuantity: 6245,
      remainingQuantity: 8755,
      severity: 'scary',
    });
    expect(analytics.rowsByCanonicalKey.get('frost snapper shell')?.bestOption?.sourceUnitQuantity).toBeCloseTo(
      345_472.3,
      1,
    );
  });

  it('models allocation splits over a wait window', () => {
    const dropRateReference = createDropRateReference([
      createDropRateRow({
        targetItemName: 'Frost Snapper Shell',
        targetCanonicalKey: 'frost snapper shell',
        sourceName: 'Large Net',
        sourceCanonicalKey: 'large net',
        sourceType: 'fishing',
        rawRate: 19_730,
      }),
    ]);
    const sourceRates = upsertSourceRateAssumption(createDefaultSourceRateAssumptionsState(), {
      sourceKey: 'large_nets',
      label: 'Large Nets',
      dailyQuantity: 2000,
    });
    const analytics = deriveQuestSourceBurdenAnalytics({
      demandRows: [
        createDemandRow({
          canonicalKey: 'frost snapper shell',
          itemName: 'Frost Snapper Shell',
          totalQuantity: 15000,
        }),
      ],
      sourceRateState: sourceRates,
      dropRateReference,
      dropRateSettings: createDefaultDropRateAcquisitionSettings(),
    });

    const scenario = deriveQuestSourceAllocationScenario(analytics, {
      waitDays: 7,
      allocations: [
        {
          canonicalKey: 'frost snapper shell',
          allocationPercent: 70,
        },
      ],
    });

    expect(scenario.rows[0]).toMatchObject({
      itemName: 'Frost Snapper Shell',
      allocationPercent: 70,
      dailySourceUnits: 1400,
      projectedSourceUnits: 9800,
    });
    expect(scenario.rows[0].projectedItemQuantity).toBeCloseTo(248.35, 1);
    expect(scenario.rows[0].remainingAfterWait).toBeCloseTo(14_751.65, 1);
  });
});
