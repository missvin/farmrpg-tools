import { describe, expect, it, vi } from 'vitest';

import {
  extractBuddyDropRatePage,
  extractBuddyDropRateTargets,
  getBuddyPageDataUrl,
  parseBuddyDropRateTargetCsv,
  toBuddyDropRatePagesCsv,
  toBuddyDropRateReviewCsv,
  toBuddyDropRateRowsCsv,
} from '../../scripts/lib/buddyDropRateExtract.mjs';

describe('buddyDropRateExtract', () => {
  it('parses target CSV rows and derives Gatsby page-data URLs', () => {
    const targets = parseBuddyDropRateTargetCsv(`target_type,target_name,buddy_url,notes
item,Glass Orb,https://buddy.farm/i/glass-orb/,sample item
location,Ember Lagoon,/l/ember-lagoon/,sample location`);

    expect(targets).toEqual([
      {
        targetType: 'item',
        targetName: 'Glass Orb',
        buddyUrl: 'https://buddy.farm/i/glass-orb/',
        notes: ['sample item'],
      },
      {
        targetType: 'location',
        targetName: 'Ember Lagoon',
        buddyUrl: 'https://buddy.farm/l/ember-lagoon/',
        notes: ['sample location'],
      },
    ]);
    expect(getBuddyPageDataUrl(targets[0].buddyUrl)).toBe(
      'https://buddy.farm/page-data/i/glass-orb/page-data.json',
    );
    expect(getBuddyPageDataUrl(targets[1].buddyUrl)).toBe(
      'https://buddy.farm/page-data/l/ember-lagoon/page-data.json',
    );
  });

  it('extracts item source rows from item page-data', () => {
    const result = extractBuddyDropRatePage(
      {
        targetType: 'item',
        targetName: 'Glass Orb',
        buddyUrl: 'https://buddy.farm/i/glass-orb/',
        notes: [],
      },
      {
        result: {
          data: {
            farmrpg: {
              items: [
                {
                  id: 78,
                  name: 'Glass Orb',
                  image: '/img/items/5708.PNG',
                  dropRatesItems: [
                    {
                      rate: 20.838802071738133,
                      dropRates: {
                        ironDepot: false,
                        manualFishing: null,
                        runecube: true,
                        location: {
                          name: 'Ember Lagoon',
                          image: '/img/items/lagoon.png',
                          type: 'explore',
                          baseDropRate: 0.3333333333333333,
                        },
                        seed: null,
                      },
                    },
                  ],
                  dropRates: [],
                },
              ],
            },
          },
        },
      },
    );

    expect(result.extractionStatus).toBe('extracted');
    expect(result.rows).toEqual([
      expect.objectContaining({
        rowKind: 'item_source',
        targetItemName: 'Glass Orb',
        targetItemId: '78',
        sourceName: 'Ember Lagoon',
        sourceType: 'explore',
        sourceKind: 'location',
        rawRate: 20.838802071738133,
        baseDropRate: 0.3333333333333333,
        ironDepot: false,
        manualFishing: null,
        runecube: true,
      }),
    ]);
  });

  it('extracts location item rows and seed output rows from page-data', () => {
    const locationResult = extractBuddyDropRatePage(
      {
        targetType: 'location',
        targetName: 'Ember Lagoon',
        buddyUrl: 'https://buddy.farm/l/ember-lagoon/',
        notes: [],
      },
      {
        result: {
          data: {
            farmrpg: {
              locations: [
                {
                  name: 'Ember Lagoon',
                  image: '/img/items/lagoon.png',
                  type: 'explore',
                  baseDropRate: 0.3333333333333333,
                  dropRates: [
                    {
                      ironDepot: true,
                      manualFishing: null,
                      runecube: false,
                      items: [
                        {
                          rate: 4.4317813023471855,
                          item: {
                            id: 40,
                            name: 'Stone',
                            image: '/img/items/6174.PNG',
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        },
      },
    );

    expect(locationResult.rows[0]).toEqual(
      expect.objectContaining({
        rowKind: 'location_item',
        targetItemName: 'Stone',
        targetItemId: '40',
        sourceName: 'Ember Lagoon',
        sourceType: 'explore',
        sourceKind: 'location',
        ironDepot: true,
        runecube: false,
      }),
    );

    const seedResult = extractBuddyDropRatePage(
      {
        targetType: 'item',
        targetName: 'Pumpkin Seeds',
        buddyUrl: 'https://buddy.farm/i/pumpkin-seeds/',
        notes: [],
      },
      {
        result: {
          data: {
            farmrpg: {
              items: [
                {
                  id: 70,
                  name: 'Pumpkin Seeds',
                  image: '/img/items/seeds_pumpkin.png',
                  dropRatesItems: [],
                  dropRates: [
                    {
                      runecube: false,
                      items: [
                        {
                          rate: 1,
                          item: {
                            id: 69,
                            name: 'Pumpkin',
                            image: '/img/items/8294.png',
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        },
      },
    );

    expect(seedResult.rows[0]).toEqual(
      expect.objectContaining({
        rowKind: 'seed_output',
        targetItemName: 'Pumpkin',
        sourceName: 'Pumpkin Seeds',
        sourceType: 'farming',
        sourceKind: 'seed',
        rawRate: 1,
        baseDropRate: 1,
        runecube: false,
      }),
    );
  });

  it('fetches targets sequentially, exports CSVs, and reports review rows', async () => {
    const sleepFn = vi.fn().mockResolvedValue(undefined);
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            result: {
              data: {
                farmrpg: {
                  items: [
                    {
                      id: 78,
                      name: 'Glass Orb',
                      image: '/img/items/5708.PNG',
                      dropRatesItems: [],
                      dropRates: [],
                    },
                  ],
                },
              },
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response('', { status: 404 }));

    const extraction = await extractBuddyDropRateTargets(
      [
        {
          targetType: 'item',
          targetName: 'Glass Orb',
          buddyUrl: 'https://buddy.farm/i/glass-orb/',
          notes: [],
        },
        {
          targetType: 'location',
          targetName: 'Missing Zone',
          buddyUrl: 'https://buddy.farm/l/missing-zone/',
          notes: [],
        },
      ],
      { fetchFn, sleepFn, interRequestDelayMs: 7 },
    );

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(sleepFn).toHaveBeenCalledWith(7);
    expect(extraction.summary.countsByStatus).toEqual({
      no_drop_rates: 1,
      uncertain: 1,
    });
    expect(extraction.summary.reviewPageCount).toBe(2);

    expect(toBuddyDropRatePagesCsv(extraction)).toContain('Glass Orb');
    expect(toBuddyDropRateRowsCsv(extraction)).toContain('source_page_type');
    expect(toBuddyDropRateReviewCsv(extraction)).toContain('Missing Zone');
  });
});
