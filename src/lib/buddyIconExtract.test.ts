import { describe, expect, it } from 'vitest';

import {
  extractBuddyItemIconPage,
  toBuddyIconExtractionCsv,
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
