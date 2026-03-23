import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildBuddyIconCacheFilename,
  downloadBuddyItemIcons,
  parseBuddyIconSourceCsv,
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

describe('parseBuddyIconSourceCsv', () => {
  it('parses the observation CSV schema into downloadable rows with preserved asset metadata', () => {
    const rows = parseBuddyIconSourceCsv(
      [
        'item_name,canonical_key,generated_buddy_slug,candidate_buddy_url,page_title,extraction_status,observation_status,icon_url,icon_pathname,icon_filename,icon_asset_key,farmrpg_item_id_candidate,flags,notes',
        'Board,board,board,https://buddy.farm/i/board/,Board,icon_found,observed,https://farmrpg.com/img/items/5885.png,/img/items/5885.png,5885.png,5885,5885,,',
      ].join('\n'),
    );

    expect(rows).toEqual([
      expect.objectContaining({
        itemName: 'Board',
        iconUrl: 'https://farmrpg.com/img/items/5885.png',
        iconAssetKey: '5885',
        farmrpgItemIdCandidate: '5885',
        observationStatus: 'observed',
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
        randomFn: () => 0,
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

  it('skips network requests for already cached files on rerun', async () => {
    const cacheDir = await createTempDir();
    let fetchCount = 0;
    const iconRows = [
      {
        itemName: 'Board',
        canonicalKey: 'board',
        generatedBuddySlug: 'board',
        candidateBuddyUrl: 'https://buddy.farm/i/board/',
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
    ];

    const fetchFn = async () => {
      fetchCount += 1;

      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => new TextEncoder().encode('png-bytes').buffer,
      };
    };

    const firstResult = await downloadBuddyItemIcons(iconRows, {
      cacheDir,
      interRequestDelayMs: 0,
      fetchFn,
      randomFn: () => 0,
    });

    const secondResult = await downloadBuddyItemIcons(iconRows, {
      cacheDir,
      interRequestDelayMs: 0,
      fetchFn,
      randomFn: () => 0,
    });

    expect(fetchCount).toBe(1);
    expect(firstResult.results[0]?.cacheStatus).toBe('downloaded');
    expect(secondResult.results[0]?.cacheStatus).toBe('existing');
  });

  it('stops conservatively when repeated failures suggest a structural problem and flags remaining rows for review', async () => {
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
          observationStatus: 'observed',
          iconUrl: 'https://farmrpg.com/img/items/5885.png',
          iconPathname: '/img/items/5885.png',
          iconFilename: '5885.png',
          iconAssetKey: '5885',
          farmrpgItemIdCandidate: '5885',
          flags: [],
          notes: [],
        },
        {
          itemName: 'Fancy Pipe',
          canonicalKey: 'fancy pipe',
          generatedBuddySlug: 'fancy-pipe',
          candidateBuddyUrl: 'https://buddy.farm/i/fancy-pipe/',
          extractionStatus: 'icon_found',
          observationStatus: 'observed',
          iconUrl: 'https://farmrpg.com/img/items/7275.png?1',
          iconPathname: '/img/items/7275.png',
          iconFilename: '7275.png',
          iconAssetKey: '7275',
          farmrpgItemIdCandidate: '7275',
          flags: [],
          notes: [],
        },
        {
          itemName: 'Apple Ant Buddy Doll',
          canonicalKey: 'apple ant buddy doll',
          generatedBuddySlug: 'apple-ant-buddy-doll',
          candidateBuddyUrl: 'https://buddy.farm/i/apple-ant-buddy-doll/',
          extractionStatus: 'icon_found',
          observationStatus: 'observed',
          iconUrl: 'https://farmrpg.com/img/items/ant_apple_buddy_doll.png',
          iconPathname: '/img/items/ant_apple_buddy_doll.png',
          iconFilename: 'ant_apple_buddy_doll.png',
          iconAssetKey: 'ant_apple_buddy_doll',
          farmrpgItemIdCandidate: null,
          flags: [],
          notes: [],
        },
        {
          itemName: '11th Leaf Centerpiece',
          canonicalKey: '11th leaf centerpiece',
          generatedBuddySlug: '11th-leaf-centerpiece',
          candidateBuddyUrl: 'https://buddy.farm/i/11th-leaf-centerpiece/',
          extractionStatus: 'icon_found',
          observationStatus: 'observed',
          iconUrl: 'https://farmrpg.com/img/items/centerpiece.png',
          iconPathname: '/img/items/centerpiece.png',
          iconFilename: 'centerpiece.png',
          iconAssetKey: 'centerpiece',
          farmrpgItemIdCandidate: null,
          flags: [],
          notes: [],
        },
      ],
      {
        cacheDir,
        interRequestDelayMs: 0,
        maxConsecutiveFailures: 3,
        fetchFn: async () => {
          fetchCount += 1;

          return {
            ok: false,
            status: 500,
          };
        },
        randomFn: () => 0,
      },
    );

    expect(fetchCount).toBe(3);
    expect(result.summary.stoppedByGuard).toBe(true);
    expect(result.summary.guardStopReason).toContain('3 consecutive failures');
    expect(result.summary.countsByStatus).toEqual({
      failed: 3,
      skipped_guard: 1,
    });
    expect(result.reviewResults).toHaveLength(4);
    expect(result.results[3]).toEqual(
      expect.objectContaining({
        cacheStatus: 'skipped_guard',
        flags: expect.arrayContaining(['stopped_by_guard']),
      }),
    );
  });

  it('applies jittered multi-second pacing between network requests', async () => {
    const cacheDir = await createTempDir();
    const sleepCalls = [];

    await downloadBuddyItemIcons(
      [
        {
          itemName: 'Board',
          canonicalKey: 'board',
          generatedBuddySlug: 'board',
          candidateBuddyUrl: 'https://buddy.farm/i/board/',
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
        {
          itemName: 'Fancy Pipe',
          canonicalKey: 'fancy pipe',
          generatedBuddySlug: 'fancy-pipe',
          candidateBuddyUrl: 'https://buddy.farm/i/fancy-pipe/',
          extractionStatus: 'icon_found',
          observationStatus: 'observed',
          iconUrl: 'https://farmrpg.com/img/items/7275.png?1',
          iconPathname: '/img/items/7275.png',
          iconFilename: '7275.png',
          iconAssetKey: '7275',
          farmrpgItemIdCandidate: '7275',
          flags: [],
          notes: [],
        },
      ],
      {
        cacheDir,
        interRequestDelayMs: 3000,
        interRequestJitterMs: 500,
        randomFn: () => 0.5,
        sleepFn: async (ms) => {
          sleepCalls.push(ms);
        },
        fetchFn: async () => ({
          ok: true,
          status: 200,
          arrayBuffer: async () => new TextEncoder().encode('png-bytes').buffer,
        }),
      },
    );

    expect(sleepCalls).toEqual([3250]);
  });

  it('downloads observed special-case icon rows even when extraction status remains uncertain', async () => {
    const cacheDir = await createTempDir();
    let fetchCount = 0;

    const result = await downloadBuddyItemIcons(
      [
        {
          itemName: 'Captured Ghost',
          canonicalKey: 'captured ghost',
          generatedBuddySlug: 'captured-ghost',
          candidateBuddyUrl: 'https://buddy.farm/i/captured-ghost/',
          extractionStatus: 'uncertain',
          observationStatus: 'observed',
          iconUrl: 'https://farmrpg.com/img/ghost.png',
          iconPathname: '/img/ghost.png',
          iconFilename: 'ghost.png',
          iconAssetKey: 'ghost',
          farmrpgItemIdCandidate: null,
          flags: ['unexpected_icon_path'],
          notes: ['The extracted icon URL did not use the expected /img/items/ path.'],
        },
      ],
      {
        cacheDir,
        interRequestDelayMs: 0,
        interRequestJitterMs: 0,
        randomFn: () => 0,
        fetchFn: async () => {
          fetchCount += 1;

          return {
            ok: true,
            status: 200,
            arrayBuffer: async () => new TextEncoder().encode('ghost-bytes').buffer,
          };
        },
      },
    );

    expect(fetchCount).toBe(1);
    expect(result.summary.iconRowsProcessed).toBe(1);
    expect(result.results[0]).toEqual(
      expect.objectContaining({
        itemName: 'Captured Ghost',
        cacheStatus: 'downloaded',
      }),
    );
  });
});
