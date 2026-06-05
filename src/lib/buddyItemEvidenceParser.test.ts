import { describe, expect, it } from 'vitest';

import {
  deriveBuddyEvidencePromotionFanout,
  parseBuddyItemEvidenceRecord,
  parseBuddyItemEvidenceRecords,
  toBuddyEvidenceFanoutCsvs,
  validateBuddyEvidencePromotionFanout,
} from '../../scripts/lib/buddyItemEvidenceParser.mjs';

function createEvidence() {
  return {
    evidenceType: 'buddy_item_page_data',
    extractionVersion: 'buddy-item-evidence-cache-v1',
    fetchedAt: '2026-06-05T00:00:00.000Z',
    httpStatus: 200,
    itemName: 'Salt',
    canonicalKey: 'salt',
    buddyUrl: 'https://buddy.farm/i/salt/',
    pageDataUrl: 'https://buddy.farm/page-data/i/salt/page-data.json',
    pageTitle: 'Salt',
    sourceStatus: 'sources_present',
    detectedSections: [
      'dropRatesItems',
      'locksmithItems',
      'locksmithOutputItems',
      'petItems',
      'recipeIngredientItems',
      'recipeItems',
      'wishingWellInputItems',
      'newBuddyThing',
    ],
    pageData: {
      result: {
        data: {
          farmrpg: {
            items: [
              {
                id: 305,
                name: 'Salt',
                image: '/img/items/salt.png',
                type: 'item',
                description: 'Makes food taste better',
                canCraft: true,
                canCook: false,
                canBuy: false,
                canMail: false,
                canFleaMarket: false,
                craftingLevel: 70,
                cookingLevel: 1,
                recipeItems: [
                  {
                    quantity: 50,
                    item: {
                      id: 304,
                      name: 'Salt Rock',
                      image: '/img/items/saltrock.png',
                    },
                  },
                ],
                recipeIngredientItems: [
                  {
                    quantity: 10,
                    item: {
                      id: 900,
                      name: 'Soup',
                      image: '/img/items/soup.png',
                      canCraft: false,
                      canCook: true,
                    },
                  },
                ],
                dropRatesItems: [
                  {
                    rate: 20,
                    dropRates: {
                      ironDepot: false,
                      manualFishing: null,
                      runecube: false,
                      location: {
                        name: 'Jundland Desert',
                        image: '/img/items/desert.png',
                        type: 'explore',
                        baseDropRate: 0.33,
                      },
                      seed: null,
                    },
                  },
                ],
                petItems: [
                  {
                    level: 3,
                    pet: {
                      name: 'Skunk',
                      image: '/img/pets/pet_skunk.png',
                    },
                  },
                ],
                locksmithItems: [
                  {
                    quantityMin: 10,
                    quantityMax: 10,
                    outputItem: {
                      id: 305,
                      name: 'Salt',
                      image: '/img/items/salt.png',
                    },
                  },
                ],
                locksmithOutputItems: [
                  {
                    quantityMin: 10,
                    quantityMax: 10,
                    item: {
                      id: 573,
                      name: 'Large Chest 03',
                      image: '/img/items/LC-3.png?1',
                    },
                  },
                ],
                wishingWellInputItems: [
                  {
                    chance: 0.5,
                    outputItem: {
                      id: 473,
                      name: 'Spiked Shell',
                      image: '/img/items/spikey.png',
                    },
                  },
                ],
                wishingWellOutputItems: [],
                requiredForQuests: [
                  {
                    quantity: 100,
                    quest: {
                      id: 1,
                      name: 'Salt Test I',
                      image: '/img/items/buddy.png',
                      endDate: null,
                      isHidden: false,
                    },
                  },
                ],
                rewardForQuests: [],
              },
            ],
          },
        },
      },
    },
  };
}

function createEvidenceWithWhitespaceName() {
  const evidence = createEvidence();
  evidence.pageData.result.data.farmrpg.items[0].petItems[0].pet.name = 'Lemur\n';
  return evidence;
}

describe('buddyItemEvidenceParser', () => {
  it('extracts typed facts from cached Buddy item page-data evidence', () => {
    const parsed = parseBuddyItemEvidenceRecord(createEvidence(), { cacheFileName: 'salt__salt.json' });

    expect(parsed.metadata).toEqual(
      expect.objectContaining({
        itemName: 'Salt',
        canonicalKey: 'salt',
        farmrpgItemId: '305',
        buddySlug: 'salt',
        iconUrl: 'https://farmrpg.com/img/items/salt.png',
      }),
    );
    expect(parsed.facts.recipes[0]).toEqual(
      expect.objectContaining({
        outputItemName: 'Salt',
        recipeType: 'craft',
        ingredients: [
          expect.objectContaining({
            inputItemName: 'Salt Rock',
            inputCanonicalKey: 'salt rock',
            quantity: 50,
          }),
        ],
      }),
    );
    expect(parsed.facts.petSources[0]).toEqual(
      expect.objectContaining({
        petName: 'Skunk',
        itemName: 'Salt',
        unlockLevel: 3,
        cacheFileName: 'salt__salt.json',
      }),
    );
    expect(parsed.facts.openableSources[0]).toEqual(
      expect.objectContaining({
        openableItemName: 'Large Chest 03',
        contentItemName: 'Salt',
        quantityKind: 'fixed',
        cacheFileName: 'salt__salt.json',
      }),
    );
    expect(parsed.facts.wishingWellOutputs[0]).toEqual(
      expect.objectContaining({
        thrownItemName: 'Salt',
        rewardItemName: 'Spiked Shell',
        rewardChance: 0.5,
        flags: ['reward_quantity_defaulted'],
        cacheFileName: 'salt__salt.json',
      }),
    );
    expect(parsed.facts.dropRates[0]).toEqual(
      expect.objectContaining({
        targetItemName: 'Salt',
        sourceName: 'Jundland Desert',
        sourceType: 'explore',
        rawRate: 20,
      }),
    );
    expect(parsed.facts.questRequirementsAndRewards[0]).toEqual(
      expect.objectContaining({
        factType: 'quest_requirement',
        questName: 'Salt Test I',
        quantity: 100,
      }),
    );
    expect(parsed.unknownDetectedSections).toEqual(['newBuddyThing']);
    expect(parsed.warnings[0]).toContain('newBuddyThing');
  });

  it('normalizes review-facing names to one-line strings', () => {
    const parsed = parseBuddyItemEvidenceRecord(createEvidenceWithWhitespaceName(), { cacheFileName: 'salt__salt.json' });
    const parsedResult = parseBuddyItemEvidenceRecords([
      {
        cacheFileName: 'salt__salt.json',
        evidence: createEvidenceWithWhitespaceName(),
      },
    ]);
    const fanout = deriveBuddyEvidencePromotionFanout(parsedResult);
    const csvs = toBuddyEvidenceFanoutCsvs(fanout);

    expect(parsed.facts.petSources[0]).toEqual(
      expect.objectContaining({
        petName: 'Lemur',
        petCanonicalKey: 'lemur',
      }),
    );
    expect(csvs['pet_source_reference_candidates.csv']).toContain('Lemur,lemur,Salt');
    expect(csvs['pet_source_reference_candidates.csv']).not.toContain('Lemur\n');
  });

  it('turns parsed facts into destination-specific review CSVs without mastery output', () => {
    const parsedResult = parseBuddyItemEvidenceRecords([
      {
        cacheFileName: 'salt__salt.json',
        evidence: createEvidence(),
      },
    ]);
    const fanout = deriveBuddyEvidencePromotionFanout(parsedResult);
    const csvs = toBuddyEvidenceFanoutCsvs(fanout);

    expect(fanout.summary).toEqual(
      expect.objectContaining({
        itemCatalogCandidates: 1,
        iconObservationCandidates: 1,
        recipeCandidates: 1,
        recipeInputCandidates: 1,
        dropRateCandidates: 1,
        petSourceCandidates: 1,
        openableCandidates: 1,
        wishingWellCandidates: 1,
        sourceHintCandidates: 1,
      }),
    );
    expect(csvs['pet_source_reference_candidates.csv']).toContain('Skunk');
    expect(csvs['pet_source_reference_candidates.csv']).toContain('salt__salt.json');
    expect(csvs['source_hint_candidates.csv']).toContain('Large Chest 03');
    expect(csvs['wishing_well_reference_candidates.csv']).toContain('Spiked Shell');
    expect(Object.keys(csvs)).not.toContain('mastery_difficulty_candidates.csv');
  });

  it('validates fan-out CSV-safe scalar fields and source provenance', () => {
    const parsedResult = parseBuddyItemEvidenceRecords([
      {
        cacheFileName: 'salt__salt.json',
        evidence: createEvidence(),
      },
    ]);
    const fanout = deriveBuddyEvidencePromotionFanout(parsedResult);

    expect(validateBuddyEvidencePromotionFanout(fanout)).toEqual({
      valid: true,
      issues: [],
    });

    fanout.outputs.petSourceCandidates[0].pet_name = 'Lemur\n';
    fanout.outputs.openableCandidates[0].cache_file_name = '';
    const validation = validateBuddyEvidencePromotionFanout(fanout);

    expect(validation.valid).toBe(false);
    expect(validation.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          outputName: 'petSourceCandidates',
          fieldName: 'pet_name',
          issue: 'embedded_newline',
        }),
        expect.objectContaining({
          outputName: 'openableCandidates',
          fieldName: 'cache_file_name',
          issue: 'missing_cache_file_name',
        }),
      ]),
    );
  });

  it('keeps Wishing Well quantities visibly defaulted instead of confirmed', () => {
    const parsedResult = parseBuddyItemEvidenceRecords([
      {
        cacheFileName: 'salt__salt.json',
        evidence: createEvidence(),
      },
    ]);
    const fanout = deriveBuddyEvidencePromotionFanout(parsedResult);

    expect(fanout.outputs.wishingWellCandidates[0]).toEqual(
      expect.objectContaining({
        thrown_item_name: 'Salt',
        reward_item_name: 'Spiked Shell',
        reward_chance: 0.5,
        reward_quantity: 1,
        flags: 'reward_quantity_defaulted',
      }),
    );
  });

  it('keeps terminal evidence visible for review instead of parsing source facts', () => {
    const parsed = parseBuddyItemEvidenceRecord({
      itemName: 'Pot of Gold',
      canonicalKey: 'pot of gold',
      buddyUrl: 'https://buddy.farm/i/pot-of-gold/',
      pageDataUrl: 'https://buddy.farm/page-data/i/pot-of-gold/page-data.json',
      httpStatus: 404,
      sourceStatus: 'uncertain',
      pageData: null,
    });

    expect(parsed.flags).toContain('terminal_or_non_success_evidence');
    expect(parsed.flags).toContain('missing_item_payload');
    expect(parsed.facts.petSources).toEqual([]);
    expect(parsed.warnings.join(' ')).toContain('HTTP status');
  });
});
