import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildBuddyIconCacheFilename,
  downloadBuddyItemIcons,
  parseBuddyIconExtractionCsv,
} from '../../scripts/lib/buddyIconDownload.mjs';

async function createTempDir() {
  return mkdtemp(path.join(os.tmpdir(), 'farmrpg-icons-'));
}

describe('buildBuddyIconCacheFilename', () => {
  it('creates a deterministic cache filename from the icon URL', () => {
    const filename = buildBuddyIconCacheFilename({
      iconUrl: 'https://farmrpg.com/img/items/5885.png',
      iconFilename: '5885.png',
    });

    expect(filename).toMatch(/^5885-[a-f0-9]{12}\.png$/);
  });
});

describe('parseBuddyIconExtractionCsv', () => {
  it('parses the icon extraction CSV schema into downloadable rows', () => {
    const rows = parseBuddyIconExtractionCsv(
      [
        'item_name,canonical_key,generated_buddy_slug,candidate_buddy_url,extraction_status,http_status,page_title,icon_url,icon_pathname,icon_filename,image_url_count,flags,notes',
        'Board,board,board,https://buddy.farm/i/board/,icon_found,200,Board,https://farmrpg.com/img/items/5885.png,/img/items/5885.png,5885.png,3,,',
      ].join('\n'),
    );

    expect(rows).toEqual([
      expect.objectContaining({
        itemName: 'Board',
        canonicalKey: 'board',
        extractionStatus: 'icon_found',
        iconUrl: 'https://farmrpg.com/img/items/5885.png',
      }),
    ]);
  });
});

describe('downloadBuddyItemIcons', () => {
  it('downloads each unique icon once and reuses cached results for repeated rows', async () => {
    const cacheDir = await createTempDir();
    let fetchCount = 0;

    const result = await downloadBuddyItemIcons(
      [
        {
          itemName: 'Board',
          canonicalKey: 'board',
          generatedBuddySlug: 'board',
          candidateBuddyUrl: 'https://buddy.farm/i/board/',
          extractionStatus: 'icon_found',
          iconUrl: 'https://farmrpg.com/img/items/5885.png',
          iconFilename: '5885.png',
          flags: [],
          notes: [],
        },
        {
          itemName: 'Mega Board',
          canonicalKey: 'mega board',
          generatedBuddySlug: 'mega-board',
          candidateBuddyUrl: 'https://buddy.farm/i/mega-board/',
          extractionStatus: 'icon_found',
          iconUrl: 'https://farmrpg.com/img/items/5885.png',
          iconFilename: '5885.png',
          flags: [],
          notes: [],
        },
      ],
      {
        cacheDir,
        interRequestDelayMs: 0,
        fetchFn: async () => {
          fetchCount += 1;

          return {
            ok: true,
            status: 200,
            arrayBuffer: async () => new TextEncoder().encode('png-bytes').buffer,
          };
        },
      },
    );

    expect(fetchCount).toBe(1);
    expect(result.summary.countsByStatus).toEqual({
      downloaded: 1,
      reused: 1,
    });
    expect(result.results[0]?.localFilePath).toBeTruthy();
    expect(result.results[1]?.cacheStatus).toBe('reused');

    const firstFile = await readFile(result.results[0].localFilePath, 'utf8');
    expect(firstFile).toBe('png-bytes');
  });
});
