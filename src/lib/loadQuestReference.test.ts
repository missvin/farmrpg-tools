import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildQuestReferenceData,
  parseQuestCatalogCsv,
  parseQuestRequirementsCsv,
  parseQuestRewardsCsv,
  parseQuestSourceHintsCsv,
} from './loadQuestReference';

describe('parseQuestSourceHintsCsv', () => {
  it('parses the checked-in local source-hint reference file', () => {
    const result = parseQuestSourceHintsCsv(
      readFileSync(join(process.cwd(), 'data', 'quest_item_source_hints.csv'), 'utf8'),
    );

    expect(result.length).toBeGreaterThan(1200);
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({
        itemName: 'Salt Rock',
        canonicalKey: 'salt rock',
        sourceName: 'Black Rock Canyon',
        sourceType: 'exploring',
      }),
      expect.objectContaining({
        itemName: 'Large Net',
        canonicalKey: 'large net',
        sourceName: 'Bag of Presents 02',
        sourceType: 'openable',
        preferredUnit: 'openable',
      }),
      expect.objectContaining({
        itemName: 'Spiked Shell',
        canonicalKey: 'spiked shell',
        sourceName: 'Salt',
        sourceType: 'wishing_well',
        preferredUnit: 'Wishing Well throw',
      }),
    ]));
  });
});

describe('quest reference data', () => {
  it('parses the expanded checked-in quest universe coverage', () => {
    const referenceData = buildQuestReferenceData({
      quests: parseQuestCatalogCsv(readFileSync(join(process.cwd(), 'data', 'quest_catalog.csv'), 'utf8')),
      requirements: parseQuestRequirementsCsv(
        readFileSync(join(process.cwd(), 'data', 'quest_requirements.csv'), 'utf8'),
      ),
      rewards: parseQuestRewardsCsv(readFileSync(join(process.cwd(), 'data', 'quest_rewards.csv'), 'utf8')),
      sourceHints: [],
    });

    expect(referenceData.quests.length).toBeGreaterThan(2300);
    expect(referenceData.requirementsByQuestKey['distant illusions xiii']).toEqual(expect.arrayContaining([
      expect.objectContaining({
        itemName: 'Frost Snapper Shell',
        quantity: 15000,
      }),
      expect.objectContaining({
        itemName: 'Frost Shield',
        quantity: 15000,
      }),
    ]));
    expect(referenceData.requirementsByQuestKey['problems start arising iii']).toEqual(expect.arrayContaining([
      expect.objectContaining({
        itemName: 'Lima Bean',
        quantity: 1250,
      }),
    ]));
    expect(referenceData.requirementsByQuestKey['pirate stealth arrival xxvii']).toEqual(expect.arrayContaining([
      expect.objectContaining({
        itemName: 'Spades',
        quantity: 100,
      }),
    ]));
    expect(referenceData.questsByKey['pirate stealth arrival xxvii']).toEqual(expect.objectContaining({
      questlineAliases: expect.arrayContaining(['PSA', 'Pirates']),
      nextQuestKeys: ['pirate stealth arrival xxviii'],
    }));
    expect(referenceData.questsByKey['pirates start arriving xvii']).toEqual(expect.objectContaining({
      nextQuestKeys: ['the masonry requires attention xviii'],
    }));
  });
});
