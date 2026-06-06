import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { validateBuddyEvidenceArtifactReadiness } from '../../scripts/lib/buddyEvidenceArtifactReadiness.mjs';

async function writeArtifactFixture(options: {
  buddyUrl?: string;
  evidenceBuddyUrl?: string;
  httpStatus?: number | null;
  includeItemPayload?: boolean;
  petRows?: string;
}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'buddy-readiness-'));
  const cacheDir = path.join(root, 'cache');
  const pagesDir = path.join(cacheDir, 'pages');
  const fanoutDir = path.join(root, 'fanout');
  const targetCsvPath = path.join(root, 'targets.csv');
  const buddyUrl = options.buddyUrl ?? 'https://buddy.farm/i/green-shield/';
  const evidenceBuddyUrl = options.evidenceBuddyUrl ?? buddyUrl;

  await mkdir(pagesDir, { recursive: true });
  await mkdir(fanoutDir, { recursive: true });
  await writeFile(
    targetCsvPath,
    `item_name,canonical_key,buddy_url,notes\nGreen Shield,green shield,${buddyUrl},test\n`,
    'utf8',
  );
  await writeFile(
    path.join(pagesDir, 'green-shield__green-shield.json'),
    JSON.stringify(
      {
        itemName: 'Green Shield',
        canonicalKey: 'green shield',
        buddyUrl: evidenceBuddyUrl,
        pageDataUrl: evidenceBuddyUrl.replace('/i/', '/page-data/i/') + 'page-data.json',
        httpStatus: options.httpStatus === undefined ? 200 : options.httpStatus,
        pageData:
          options.includeItemPayload === false
            ? null
            : {
                result: {
                  data: {
                    farmrpg: {
                      items: [{ name: 'Green Shield' }],
                    },
                  },
                },
              },
      },
      null,
      2,
    ),
    'utf8',
  );
  await writeFile(
    path.join(fanoutDir, 'pet_source_reference_candidates.csv'),
    options.petRows ??
      [
        'pet_name,pet_canonical_key,item_name,item_canonical_key,unlock_level,source_url,page_data_url,coverage_status,notes,cache_file_name,parser_version',
        ...Array.from({ length: 12 }, (_, index) =>
          `Hedgehog,hedgehog,Item ${index + 1},item ${index + 1},6,https://buddy.farm/i/item-${index + 1}/,https://buddy.farm/page-data/i/item-${index + 1}/page-data.json,candidate,test,item-${index + 1}.json,test`,
        ),
      ].join('\n'),
    'utf8',
  );

  return { cacheDir, fanoutDir, targetCsvPath };
}

describe('buddyEvidenceArtifactReadiness', () => {
  it('accepts a complete local evidence artifact with expected pet coverage', async () => {
    const fixture = await writeArtifactFixture({});

    await expect(
      validateBuddyEvidenceArtifactReadiness({
        ...fixture,
        expectedCount: 1,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        valid: true,
        summary: expect.objectContaining({
          targetsChecked: 1,
          errorCount: 0,
        }),
      }),
    );
  });

  it('rejects known wrong edge slugs even when a stale differently named cache file exists', async () => {
    const fixture = await writeArtifactFixture({
      buddyUrl: 'https://buddy.farm/i/r-o-a-s/',
      httpStatus: 404,
      includeItemPayload: false,
    });
    const result = await validateBuddyEvidenceArtifactReadiness({
      ...fixture,
      expectedCount: 1,
    });

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'known_wrong_slug' }),
        expect.objectContaining({ code: 'missing_cache_file' }),
      ]),
    );
  });

  it('rejects non-success evidence and missing direct item payloads', async () => {
    const fixture = await writeArtifactFixture({
      httpStatus: 404,
      includeItemPayload: false,
    });
    const result = await validateBuddyEvidenceArtifactReadiness({
      ...fixture,
      expectedCount: 1,
    });

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'non_success_evidence' }),
        expect.objectContaining({ code: 'missing_direct_item_payload' }),
      ]),
    );
  });

  it('rejects stale cache files and suspicious pet-source gaps', async () => {
    const fixture = await writeArtifactFixture({
      evidenceBuddyUrl: 'https://buddy.farm/i/old-green-shield/',
      petRows: [
        'pet_name,pet_canonical_key,item_name,item_canonical_key,unlock_level,source_url,page_data_url,coverage_status,notes,cache_file_name,parser_version',
        ...Array.from({ length: 11 }, (_, index) =>
          `Hedgehog,hedgehog,Item ${index + 1},item ${index + 1},6,https://buddy.farm/i/item-${index + 1}/,https://buddy.farm/page-data/i/item-${index + 1}/page-data.json,candidate,test,item-${index + 1}.json,test`,
        ),
      ].join('\n'),
    });
    const result = await validateBuddyEvidenceArtifactReadiness({
      ...fixture,
      expectedCount: 1,
    });

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'stale_cache_buddy_url' }),
        expect.objectContaining({ code: 'pet_source_group_gap' }),
      ]),
    );
  });
});
