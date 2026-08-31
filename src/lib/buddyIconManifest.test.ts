import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  deriveBuddyIconManifest,
  mergeBuddyIconManifestResults,
  parseBuddyIconDownloadCsv,
  toBuddyIconManifestCsv,
} from '../../scripts/lib/buddyIconManifest.mjs';

async function createTempDir() {
  return mkdtemp(path.join(os.tmpdir(), 'farmrpg-icon-manifest-'));
}

describe('parseBuddyIconDownloadCsv', () => {
  it('parses the download CSV schema into manifest-joinable rows', () => {
    const rows = parseBuddyIconDownloadCsv(
      [
        'item_name,canonical_key,generated_buddy_slug,candidate_buddy_url,icon_url,icon_pathname,icon_filename,icon_asset_key,farmrpg_item_id_candidate,cache_status,http_status,cache_filename,local_relative_path,flags,notes',
        'Board,board,board,https://buddy.farm/i/board/,https://farmrpg.com/img/items/5885.png,/img/items/5885.png,5885.png,5885,5885,existing,200,5885-b7d4ab025c3d.png,generated/item-icons/5885-b7d4ab025c3d.png,,',
      ].join('\n'),
    );

    expect(rows).toEqual([
      expect.objectContaining({
        itemName: 'Board',
        canonicalKey: 'board',
        cacheStatus: 'existing',
        localRelativePath: 'generated/item-icons/5885-b7d4ab025c3d.png',
      }),
    ]);
  });
});

describe('mergeBuddyIconManifestResults', () => {
  it('recomputes merged summaries and uses catalog-compatible canonical keys for new rows', () => {
    const existingResult = {
      itemName: 'Board',
      canonicalKey: 'board',
      manifestStatus: 'ready',
      sharedAssetItemCount: 1,
      sharedAssetReuse: false,
      flags: [],
    };
    const newResult = {
      itemName: "Cid's Spare Pickaxe",
      canonicalKey: 'cid s spare pickaxe',
      manifestStatus: 'ready',
      sharedAssetItemCount: 1,
      sharedAssetReuse: false,
      flags: [],
    };
    const staleCidResult = {
      ...newResult,
      canonicalKey: 'cid s spare pickaxe',
    };

    const merged = mergeBuddyIconManifestResults(
      { results: [existingResult, staleCidResult] },
      { results: [newResult] },
    );

    expect(merged.results).toEqual([
      existingResult,
      expect.objectContaining({
        itemName: "Cid's Spare Pickaxe",
        canonicalKey: "cid's spare pickaxe",
      }),
    ]);
    expect(merged.summary).toEqual(
      expect.objectContaining({
        itemRowsProcessed: 2,
        cleanManifestRowCount: 2,
        reviewCount: 0,
      }),
    );
  });
});

describe('deriveBuddyIconManifest', () => {
  it('builds clean manifest rows from observed icon metadata and cached download outputs', async () => {
    const repoRoot = await createTempDir();
    const localRelativePath = 'generated/item-icons/5885-b7d4ab025c3d.png';
    await mkdir(path.join(repoRoot, 'generated', 'item-icons'), { recursive: true });
    await writeFile(path.join(repoRoot, localRelativePath), 'png-bytes');

    const manifestResult = await deriveBuddyIconManifest(
      [
        'item_name,canonical_key,generated_buddy_slug,candidate_buddy_url,page_title,extraction_status,observation_status,icon_url,icon_pathname,icon_filename,icon_asset_key,farmrpg_item_id_candidate,flags,notes',
        'Board,board,board,https://buddy.farm/i/board/,Board,icon_found,observed,https://farmrpg.com/img/items/5885.png,/img/items/5885.png,5885.png,5885,5885,,',
      ].join('\n'),
      [
        'item_name,canonical_key,generated_buddy_slug,candidate_buddy_url,icon_url,icon_pathname,icon_filename,icon_asset_key,farmrpg_item_id_candidate,cache_status,http_status,cache_filename,local_relative_path,flags,notes',
        `Board,board,board,https://buddy.farm/i/board/,https://farmrpg.com/img/items/5885.png,/img/items/5885.png,5885.png,5885,5885,existing,200,5885-b7d4ab025c3d.png,${localRelativePath},,`,
      ].join('\n'),
      { repoRoot },
    );

    expect(manifestResult.summary).toEqual(
      expect.objectContaining({
        itemRowsProcessed: 1,
        cleanManifestRowCount: 1,
        reviewCount: 0,
      }),
    );
    expect(manifestResult.results[0]).toEqual(
      expect.objectContaining({
        canonicalKey: 'board',
        manifestStatus: 'ready',
        localRelativePath,
      }),
    );
  });

  it('preserves shared cache reuse as valid manifest state', async () => {
    const repoRoot = await createTempDir();
    const localRelativePath = 'generated/item-icons/applecrate-ed2574f1160e.png';
    await mkdir(path.join(repoRoot, 'generated', 'item-icons'), { recursive: true });
    await writeFile(path.join(repoRoot, localRelativePath), 'png-bytes');

    const manifestResult = await deriveBuddyIconManifest(
      [
        'item_name,canonical_key,generated_buddy_slug,candidate_buddy_url,page_title,extraction_status,observation_status,icon_url,icon_pathname,icon_filename,icon_asset_key,farmrpg_item_id_candidate,flags,notes',
        'Apple Crate 01,apple crate 01,apple-crate-01,https://buddy.farm/i/apple-crate-01/,Apple Crate 01,icon_found,observed,https://farmrpg.com/img/items/applecrate.png,/img/items/applecrate.png,applecrate.png,applecrate,,,',
        'Apple Crate 02,apple crate 02,apple-crate-02,https://buddy.farm/i/apple-crate-02/,Apple Crate 02,icon_found,observed,https://farmrpg.com/img/items/applecrate.png,/img/items/applecrate.png,applecrate.png,applecrate,,,',
      ].join('\n'),
      [
        'item_name,canonical_key,generated_buddy_slug,candidate_buddy_url,icon_url,icon_pathname,icon_filename,icon_asset_key,farmrpg_item_id_candidate,cache_status,http_status,cache_filename,local_relative_path,flags,notes',
        `Apple Crate 01,apple crate 01,apple-crate-01,https://buddy.farm/i/apple-crate-01/,https://farmrpg.com/img/items/applecrate.png,/img/items/applecrate.png,applecrate.png,applecrate,,existing,200,applecrate-ed2574f1160e.png,${localRelativePath},,`,
        `Apple Crate 02,apple crate 02,apple-crate-02,https://buddy.farm/i/apple-crate-02/,https://farmrpg.com/img/items/applecrate.png,/img/items/applecrate.png,applecrate.png,applecrate,,reused,200,applecrate-ed2574f1160e.png,${localRelativePath},,`,
      ].join('\n'),
      { repoRoot },
    );

    expect(manifestResult.summary).toEqual(
      expect.objectContaining({
        cleanManifestRowCount: 2,
        sharedAssetReuseRowCount: 1,
      }),
    );
    expect(manifestResult.results[1]).toEqual(
      expect.objectContaining({
        manifestStatus: 'ready',
        sharedAssetItemCount: 2,
        sharedAssetReuse: true,
      }),
    );
  });

  it('surfaces review rows when a cached file is missing', async () => {
    const repoRoot = await createTempDir();

    const manifestResult = await deriveBuddyIconManifest(
      [
        'item_name,canonical_key,generated_buddy_slug,candidate_buddy_url,page_title,extraction_status,observation_status,icon_url,icon_pathname,icon_filename,icon_asset_key,farmrpg_item_id_candidate,flags,notes',
        'Board,board,board,https://buddy.farm/i/board/,Board,icon_found,observed,https://farmrpg.com/img/items/5885.png,/img/items/5885.png,5885.png,5885,5885,,',
      ].join('\n'),
      [
        'item_name,canonical_key,generated_buddy_slug,candidate_buddy_url,icon_url,icon_pathname,icon_filename,icon_asset_key,farmrpg_item_id_candidate,cache_status,http_status,cache_filename,local_relative_path,flags,notes',
        'Board,board,board,https://buddy.farm/i/board/,https://farmrpg.com/img/items/5885.png,/img/items/5885.png,5885.png,5885,5885,existing,200,5885-b7d4ab025c3d.png,generated/item-icons/5885-b7d4ab025c3d.png,,',
      ].join('\n'),
      { repoRoot },
    );

    expect(manifestResult.summary.reviewCount).toBe(1);
    expect(manifestResult.reviewResults[0]).toEqual(
      expect.objectContaining({
        manifestStatus: 'review_needed',
        notes: expect.arrayContaining(['The manifest expected a cached local icon file, but it was not present on disk.']),
      }),
    );
  });
});

describe('toBuddyIconManifestCsv', () => {
  it('exports manifest rows with local cache paths and shared-asset fields', () => {
    const csvText = toBuddyIconManifestCsv({
      results: [
        {
          itemName: 'Board',
          canonicalKey: 'board',
          generatedBuddySlug: 'board',
          candidateBuddyUrl: 'https://buddy.farm/i/board/',
          pageTitle: 'Board',
          manifestStatus: 'ready',
          cacheStatus: 'existing',
          iconUrl: 'https://farmrpg.com/img/items/5885.png',
          iconPathname: '/img/items/5885.png',
          iconFilename: '5885.png',
          iconAssetKey: '5885',
          farmrpgItemIdCandidate: '5885',
          cacheFilename: '5885-b7d4ab025c3d.png',
          localRelativePath: 'generated/item-icons/5885-b7d4ab025c3d.png',
          sharedAssetItemCount: 1,
          sharedAssetReuse: false,
          flags: [],
          notes: [],
        },
      ],
    });

    expect(csvText).toContain('manifest_status,cache_status');
    expect(csvText).toContain('shared_asset_item_count,shared_asset_reuse');
    expect(csvText).toContain('Board,board,board,https://buddy.farm/i/board/,Board,ready,existing,https://farmrpg.com/img/items/5885.png,/img/items/5885.png,5885.png,5885,5885,5885-b7d4ab025c3d.png,generated/item-icons/5885-b7d4ab025c3d.png,1,false,,');
  });
});
