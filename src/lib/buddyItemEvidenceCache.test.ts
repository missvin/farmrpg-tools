import { describe, expect, it, vi } from 'vitest';

import {
  buildBuddyItemEvidenceCachePlan,
  cacheBuddyItemEvidenceTargets,
  DEFAULT_BUDDY_ITEM_EVIDENCE_DELAY_MS,
  getBuddyItemEvidenceFileName,
  getBuddyItemPageDataUrl,
  isFreshBuddyItemEvidence,
  parseBuddyItemEvidenceTargetCsv,
  toBuddyItemEvidenceManifestCsv,
  toBuddyItemEvidencePlanCsv,
  toBuddyItemEvidenceReviewCsv,
} from '../../scripts/lib/buddyItemEvidenceCache.mjs';

const fetchedAt = '2026-06-03T12:00:00.000Z';
const nowMs = Date.parse(fetchedAt);

function createTarget(itemName = 'Glass Orb') {
  return {
    itemName,
    canonicalKey: itemName.toLowerCase().replace(/\s+/gu, '_'),
    buddyUrl: `https://buddy.farm/i/${itemName.toLowerCase().replace(/\s+/gu, '-')}/`,
    sourceSchema: 'target',
    sourceProbeStatus: null,
    notes: [],
  };
}

describe('buddyItemEvidenceCache', () => {
  it('parses direct target CSV rows and probe result CSV rows', () => {
    const directTargets = parseBuddyItemEvidenceTargetCsv(`item_name,canonical_key,buddy_url,notes
Glass Orb,glass_orb,https://buddy.farm/i/glass-orb/,new-game source review`);

    expect(directTargets).toEqual([
      {
        itemName: 'Glass Orb',
        canonicalKey: 'glass_orb',
        buddyUrl: 'https://buddy.farm/i/glass-orb/',
        sourceSchema: 'target',
        sourceProbeStatus: null,
        notes: ['new-game source review'],
      },
    ]);

    const probeTargets = parseBuddyItemEvidenceTargetCsv(`item_name,canonical_key,generated_buddy_slug,candidate_buddy_url,probe_status,http_status,final_url,page_title,attempts,flags,notes
Salt,salt,salt,https://buddy.farm/i/salt/,found,200,,Salt,1,,pet source gap
Missing Thing,missing_thing,missing-thing,https://buddy.farm/i/missing-thing/,not_found,404,,Missing,1,,not real`);

    expect(probeTargets).toEqual([
      expect.objectContaining({
        itemName: 'Salt',
        canonicalKey: 'salt',
        buddyUrl: 'https://buddy.farm/i/salt/',
        sourceSchema: 'probe_result',
        sourceProbeStatus: 'found',
        notes: ['pet source gap'],
      }),
    ]);
  });

  it('derives Buddy item page-data URLs and cache filenames', () => {
    const target = createTarget('Frost Snapper Shell');

    expect(getBuddyItemPageDataUrl(target.buddyUrl)).toBe(
      'https://buddy.farm/page-data/i/frost-snapper-shell/page-data.json',
    );
    expect(getBuddyItemEvidenceFileName(target)).toBe('frost-snapper-shell__frost-snapper-shell.json');
    expect(() => getBuddyItemPageDataUrl('https://farmrpg.com/i/salt/')).toThrow(/buddy\.farm/u);
    expect(() => getBuddyItemPageDataUrl('https://buddy.farm/l/jundland-desert/')).toThrow(/buddy item URL/u);
  });

  it('plans dry-run fetches and skips fresh successful cache entries', () => {
    const salt = createTarget('Salt');
    const glassOrb = createTarget('Glass Orb');
    const plan = buildBuddyItemEvidenceCachePlan(
      [salt, glassOrb],
      {
        [salt.canonicalKey + '__salt']: {
          fetchedAt,
          httpStatus: 200,
        },
      },
      { dryRun: true, nowMs, delayMs: DEFAULT_BUDDY_ITEM_EVIDENCE_DELAY_MS, limit: 2, maxAgeDays: 30 },
    );

    expect(plan.summary.countsByAction).toEqual({
      skip_fresh: 1,
      would_fetch: 1,
    });
    expect(toBuddyItemEvidencePlanCsv(plan)).toContain('would_fetch');
    expect(isFreshBuddyItemEvidence({ fetchedAt, httpStatus: 200 }, { nowMs, maxAgeDays: 30 })).toBe(true);
    expect(isFreshBuddyItemEvidence({ fetchedAt, httpStatus: 404 }, { nowMs, maxAgeDays: 30 })).toBe(false);
  });

  it('does not fetch during dry runs', async () => {
    const fetchFn = vi.fn();

    const result = await cacheBuddyItemEvidenceTargets([createTarget('Salt')], {
      dryRun: true,
      nowMs,
      fetchFn,
      delayMs: DEFAULT_BUDDY_ITEM_EVIDENCE_DELAY_MS,
      limit: 1,
    });

    expect(fetchFn).not.toHaveBeenCalled();
    expect(result.results[0]).toEqual(expect.objectContaining({ status: 'would_fetch' }));
  });

  it('fetches sequentially, preserves raw page-data, and exports review manifests', async () => {
    const sleepFn = vi.fn().mockResolvedValue(undefined);
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            result: {
              pageContext: {
                title: 'Glass Orb',
              },
              data: {
                farmrpg: {
                  items: [
                    {
                      id: 78,
                      name: 'Glass Orb',
                      image: '/img/items/5708.PNG',
                      dropRatesItems: [
                        {
                          rate: 20,
                          dropRates: {
                            location: {
                              name: 'Ember Lagoon',
                            },
                          },
                        },
                      ],
                    },
                  ],
                },
              },
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            result: {
              data: {
                farmrpg: {
                  items: [
                    {
                      id: 999,
                      name: 'Brand New Box',
                      image: '/img/items/new-box.png',
                    },
                  ],
                },
              },
            },
          }),
          { status: 200 },
        ),
      );

    const result = await cacheBuddyItemEvidenceTargets([createTarget('Glass Orb'), createTarget('Brand New Box')], {
      fetchFn,
      sleepFn,
      nowMs,
      nowIso: fetchedAt,
      delayMs: 5000,
      limit: 2,
    });

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(sleepFn).toHaveBeenCalledWith(5000);
    expect(result.summary.countsByStatus).toEqual({ cached: 2 });
    expect(result.results[0].evidence).toEqual(
      expect.objectContaining({
        itemName: 'Glass Orb',
        buddyItemName: 'Glass Orb',
        sourceStatus: 'sources_present',
        pageData: expect.objectContaining({ result: expect.any(Object) }),
      }),
    );
    expect(result.results[1].evidence).toEqual(
      expect.objectContaining({
        sourceStatus: 'sources_blank',
        blankSourceIndicators: ['no_nonempty_known_source_sections'],
      }),
    );
    expect(result.reviewResults).toHaveLength(1);
    expect(toBuddyItemEvidenceManifestCsv(result)).toContain('Brand New Box');
    expect(toBuddyItemEvidenceReviewCsv(result)).toContain('sources_blank');
  });
});
