import { describe, expect, it } from 'vitest';

import {
  deriveBuddyIconObservations,
  extractBuddyItemIconPage,
  extractBuddyItemIcons,
  toBuddyIconExtractionCsv,
  toBuddyIconObservationCsv,
} from '../../scripts/lib/buddyIconExtract.mjs';

describe('extractBuddyItemIconPage', () => {
  it('extracts the primary item icon URL from a buddy item page', () => {
    const result = extractBuddyItemIconPage(
      {
        itemName: 'Board',
        canonicalKey: 'board',
        generatedBuddySlug: 'board',
        candidateBuddyUrl: 'https://buddy.farm/i/board/',
      },
      `
        <html>
          <head><title>Board</title></head>
          <body>
            <h1><img src="https://farmrpg.com/img/items/board.png" />Board</h1>
            <div><img src="https://farmrpg.com/img/items/wood.png" />Wood</div>
            <h3>Recipe</h3>
          </body>
        </html>
      `,
    );

    expect(result).toMatchObject({
      extractionStatus: 'icon_found',
      iconUrl: 'https://farmrpg.com/img/items/board.png',
      iconPathname: '/img/items/board.png',
      iconFilename: 'board.png',
      imageUrlCount: 2,
      flags: [],
    });
  });

  it('keeps missing icons reviewable instead of throwing', () => {
    const result = extractBuddyItemIconPage(
      {
        itemName: 'Mystery Item',
        canonicalKey: 'mystery item',
        generatedBuddySlug: 'mystery-item',
        candidateBuddyUrl: 'https://buddy.farm/i/mystery-item/',
      },
      `
        <html>
          <head><title>Mystery Item</title></head>
          <body>
            <h1>Mystery Item</h1>
          </body>
        </html>
      `,
    );

    expect(result).toMatchObject({
      extractionStatus: 'no_icon',
      iconUrl: null,
      flags: ['no_item_icon_link_detected'],
    });
  });

  it('normalizes observed icon filename metadata from URLs with query strings', () => {
    const result = extractBuddyItemIconPage(
      {
        itemName: 'Fancy Pipe',
        canonicalKey: 'fancy pipe',
        generatedBuddySlug: 'fancy-pipe',
        candidateBuddyUrl: 'https://buddy.farm/i/fancy-pipe/',
      },
      `
        <html>
          <head><title>Fancy Pipe</title></head>
          <body>
            <h1><img src="https://farmrpg.com/img/items/7275.png?1" />Fancy Pipe</h1>
          </body>
        </html>
      `,
    );

    expect(result).toMatchObject({
      iconUrl: 'https://farmrpg.com/img/items/7275.png?1',
      iconPathname: '/img/items/7275.png',
      iconFilename: '7275.png',
    });
  });
});

describe('toBuddyIconExtractionCsv', () => {
  it('exports icon extraction rows in a reviewable CSV shape', () => {
    const csvText = toBuddyIconExtractionCsv({
      results: [
        {
          itemName: 'Board',
          canonicalKey: 'board',
          generatedBuddySlug: 'board',
          candidateBuddyUrl: 'https://buddy.farm/i/board/',
          extractionStatus: 'icon_found',
          httpStatus: 200,
          pageTitle: 'Board',
          iconUrl: 'https://farmrpg.com/img/items/board.png',
          iconPathname: '/img/items/board.png',
          iconFilename: 'board.png',
          imageUrlCount: 1,
          flags: [],
          notes: [],
        },
      ],
    });

    expect(csvText).toContain('item_name,canonical_key,generated_buddy_slug,candidate_buddy_url,extraction_status');
    expect(csvText).toContain('Board,board,board,https://buddy.farm/i/board/,icon_found,200,Board,https://farmrpg.com/img/items/board.png,/img/items/board.png,board.png,1,,');
  });
});

describe('deriveBuddyIconObservations', () => {
  it('preserves observed icon metadata and only derives numeric farmrpg_item_id candidates from directly numeric filenames', () => {
    const observationResult = deriveBuddyIconObservations({
      results: [
        {
          itemName: 'Board',
          canonicalKey: 'board',
          generatedBuddySlug: 'board',
          candidateBuddyUrl: 'https://buddy.farm/i/board/',
          extractionStatus: 'icon_found',
          pageTitle: 'Board',
          iconUrl: 'https://farmrpg.com/img/items/5885.png',
          iconPathname: '/img/items/5885.png',
          iconFilename: '5885.png',
          flags: [],
          notes: [],
        },
        {
          itemName: 'Apple Ant Buddy Doll',
          canonicalKey: 'apple ant buddy doll',
          generatedBuddySlug: 'apple-ant-buddy-doll',
          candidateBuddyUrl: 'https://buddy.farm/i/apple-ant-buddy-doll/',
          extractionStatus: 'icon_found',
          pageTitle: 'Apple Ant Buddy Doll',
          iconUrl: 'https://farmrpg.com/img/items/ant_apple_buddy_doll.png',
          iconPathname: '/img/items/ant_apple_buddy_doll.png',
          iconFilename: 'ant_apple_buddy_doll.png',
          flags: [],
          notes: [],
        },
        {
          itemName: 'Fancy Pipe',
          canonicalKey: 'fancy pipe',
          generatedBuddySlug: 'fancy-pipe',
          candidateBuddyUrl: 'https://buddy.farm/i/fancy-pipe/',
          extractionStatus: 'icon_found',
          pageTitle: 'Fancy Pipe',
          iconUrl: 'https://farmrpg.com/img/items/7275.png?1',
          iconPathname: '/img/items/7275.png',
          iconFilename: '7275.png',
          flags: [],
          notes: [],
        },
      ],
    });

    expect(observationResult.results).toEqual([
      expect.objectContaining({
        observationStatus: 'observed',
        iconAssetKey: '5885',
        farmrpgItemIdCandidate: '5885',
      }),
      expect.objectContaining({
        observationStatus: 'observed',
        iconAssetKey: 'ant_apple_buddy_doll',
        farmrpgItemIdCandidate: null,
      }),
      expect.objectContaining({
        observationStatus: 'observed',
        iconAssetKey: '7275',
        farmrpgItemIdCandidate: '7275',
      }),
    ]);
    expect(observationResult.summary.observedCount).toBe(3);
    expect(observationResult.summary.numericFarmRpgItemIdCandidateCount).toBe(2);
  });

  it('keeps uncertain or missing icon rows reviewable in the observation artifact', () => {
    const observationResult = deriveBuddyIconObservations({
      results: [
        {
          itemName: 'Mystery Item',
          canonicalKey: 'mystery item',
          generatedBuddySlug: 'mystery-item',
          candidateBuddyUrl: 'https://buddy.farm/i/mystery-item/',
          extractionStatus: 'no_icon',
          pageTitle: 'Mystery Item',
          iconUrl: null,
          iconPathname: null,
          iconFilename: null,
          flags: ['no_item_icon_link_detected'],
          notes: ['No item icon URL could be detected from the buddy item page HTML.'],
        },
      ],
    });

    expect(observationResult.results[0]).toEqual(
      expect.objectContaining({
        observationStatus: 'review_needed',
        iconAssetKey: null,
        farmrpgItemIdCandidate: null,
      }),
    );
    expect(observationResult.reviewResults).toHaveLength(1);
  });
});

describe('extractBuddyItemIcons', () => {
  it('stops conservatively when repeated extraction failures suggest a structural problem', async () => {
    let fetchCount = 0;

    const result = await extractBuddyItemIcons(
      [
        {
          itemName: 'Board',
          canonicalKey: 'board',
          generatedBuddySlug: 'board',
          candidateBuddyUrl: 'https://buddy.farm/i/board/',
        },
        {
          itemName: 'Fancy Pipe',
          canonicalKey: 'fancy pipe',
          generatedBuddySlug: 'fancy-pipe',
          candidateBuddyUrl: 'https://buddy.farm/i/fancy-pipe/',
        },
        {
          itemName: 'Apple Ant Buddy Doll',
          canonicalKey: 'apple ant buddy doll',
          generatedBuddySlug: 'apple-ant-buddy-doll',
          candidateBuddyUrl: 'https://buddy.farm/i/apple-ant-buddy-doll/',
        },
        {
          itemName: '11th Leaf Centerpiece',
          canonicalKey: '11th leaf centerpiece',
          generatedBuddySlug: '11th-leaf-centerpiece',
          candidateBuddyUrl: 'https://buddy.farm/i/11th-leaf-centerpiece/',
        },
      ],
      {
        interRequestDelayMs: 0,
        maxConsecutiveFailures: 3,
        fetchFn: async () => {
          fetchCount += 1;

          return {
            ok: false,
            status: 500,
          };
        },
      },
    );

    expect(fetchCount).toBe(3);
    expect(result.summary.stoppedByGuard).toBe(true);
    expect(result.summary.guardStopReason).toContain('3 consecutive extraction failures');
    expect(result.summary.totalFailures).toBe(3);
    expect(result.reviewResults).toHaveLength(4);
    expect(result.results[3]).toEqual(
      expect.objectContaining({
        extractionStatus: 'uncertain',
        flags: ['stopped_by_guard'],
      }),
    );
  });
});

describe('toBuddyIconObservationCsv', () => {
  it('exports observed icon metadata with separate asset key and optional numeric id candidate columns', () => {
    const csvText = toBuddyIconObservationCsv({
      results: [
        {
          itemName: 'Board',
          canonicalKey: 'board',
          generatedBuddySlug: 'board',
          candidateBuddyUrl: 'https://buddy.farm/i/board/',
          pageTitle: 'Board',
          extractionStatus: 'icon_found',
          observationStatus: 'observed',
          iconUrl: 'https://farmrpg.com/img/items/5885.png',
          iconPathname: '/img/items/5885.png',
          iconFilename: '5885.png',
          iconAssetKey: '5885',
          farmrpgItemIdCandidate: '5885',
          flags: [],
          notes: [],
        },
      ],
    });

    expect(csvText).toContain('icon_asset_key,farmrpg_item_id_candidate');
    expect(csvText).toContain('Board,board,board,https://buddy.farm/i/board/,Board,icon_found,observed,https://farmrpg.com/img/items/5885.png,/img/items/5885.png,5885.png,5885,5885,,');
  });
});
