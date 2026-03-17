import { describe, expect, it, vi } from 'vitest';

import {
  extractHtmlTitle,
  parseBuddyCandidateCsv,
  probeBuddyFarmCandidate,
  probeBuddyFarmCandidates,
  toBuddyProbeReviewCsv,
} from '../../scripts/lib/buddyFarmProbe.mjs';

describe('buddyFarmProbe', () => {
  it('parses buddy candidate CSV rows', () => {
    const candidates = parseBuddyCandidateCsv(`museum_category,category,item_name,canonical_key,obtainable,generated_buddy_slug,candidate_buddy_url,alternate_buddy_slug,confidence,flags,notes
Event,Event,Piñata Whop Stick,piñata whop stick,Y,pi-ata-whop-stick,https://buddy.farm/i/pi-ata-whop-stick/,pinata-whop-stick,review,non_ascii_or_diacritic; alternate_slug_variant,Contains non-ASCII or diacritic characters; Alternate slug variant differs from the primary generated slug.`);

    expect(candidates).toEqual([
      {
        museumCategory: 'Event',
        category: 'Event',
        itemName: 'Piñata Whop Stick',
        canonicalKey: 'piñata whop stick',
        obtainable: true,
        generatedBuddySlug: 'pi-ata-whop-stick',
        candidateBuddyUrl: 'https://buddy.farm/i/pi-ata-whop-stick/',
        alternateBuddySlug: 'pinata-whop-stick',
        confidence: 'review',
        flags: ['non_ascii_or_diacritic', 'alternate_slug_variant'],
        notes: [
          'Contains non-ASCII or diacritic characters',
          'Alternate slug variant differs from the primary generated slug.',
        ],
      },
    ]);
  });

  it('classifies found, not_found, redirect, and blocked probe outcomes', async () => {
    const sleepFn = vi.fn().mockResolvedValue(undefined);

    const foundResult = await probeBuddyFarmCandidate(
      {
        itemName: 'Bamboo Trellis',
        canonicalKey: 'bamboo trellis',
        generatedBuddySlug: 'bamboo-trellis',
        candidateBuddyUrl: 'https://buddy.farm/i/bamboo-trellis/',
        flags: [],
        notes: [],
      },
      {
        fetchFn: vi.fn().mockResolvedValue(
          new Response('<html><head><title>Bamboo Trellis</title></head></html>', { status: 200 }),
        ),
        sleepFn,
      },
    );

    expect(foundResult.probeStatus).toBe('found');
    expect(foundResult.pageTitle).toBe('Bamboo Trellis');

    const notFoundResult = await probeBuddyFarmCandidate(
      {
        itemName: 'Missing Item',
        canonicalKey: 'missing item',
        generatedBuddySlug: 'missing-item',
        candidateBuddyUrl: 'https://buddy.farm/i/missing-item/',
        flags: [],
        notes: [],
      },
      {
        fetchFn: vi.fn().mockResolvedValue(new Response('', { status: 404 })),
        sleepFn,
      },
    );

    expect(notFoundResult.probeStatus).toBe('not_found');

    const redirectResult = await probeBuddyFarmCandidate(
      {
        itemName: 'Redirected Item',
        canonicalKey: 'redirected item',
        generatedBuddySlug: 'redirected-item',
        candidateBuddyUrl: 'https://buddy.farm/i/redirected-item/',
        flags: [],
        notes: [],
      },
      {
        fetchFn: vi.fn().mockResolvedValue(
          new Response('', {
            status: 302,
            headers: {
              location: '/i/final-item/',
            },
          }),
        ),
        sleepFn,
      },
    );

    expect(redirectResult.probeStatus).toBe('redirect');
    expect(redirectResult.finalUrl).toBe('https://buddy.farm/i/final-item/');

    const blockedResult = await probeBuddyFarmCandidate(
      {
        itemName: 'Rate Limited Item',
        canonicalKey: 'rate limited item',
        generatedBuddySlug: 'rate-limited-item',
        candidateBuddyUrl: 'https://buddy.farm/i/rate-limited-item/',
        flags: [],
        notes: [],
      },
      {
        fetchFn: vi.fn().mockResolvedValue(new Response('', { status: 429 })),
        sleepFn,
      },
    );

    expect(blockedResult.probeStatus).toBe('blocked_or_rate_limited');
  });

  it('retries transient failures, batches sequentially, and exports review rows', async () => {
    const sleepFn = vi.fn().mockResolvedValue(undefined);
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('socket hang up'))
      .mockResolvedValueOnce(new Response('<title>Recovered</title>', { status: 200 }))
      .mockResolvedValueOnce(new Response('', { status: 404 }));

    const probeResult = await probeBuddyFarmCandidates(
      [
        {
          itemName: 'Recovered Item',
          canonicalKey: 'recovered item',
          generatedBuddySlug: 'recovered-item',
          candidateBuddyUrl: 'https://buddy.farm/i/recovered-item/',
          flags: [],
          notes: [],
        },
        {
          itemName: 'Missing Item',
          canonicalKey: 'missing item',
          generatedBuddySlug: 'missing-item',
          candidateBuddyUrl: 'https://buddy.farm/i/missing-item/',
          flags: [],
          notes: [],
        },
      ],
      {
        fetchFn,
        sleepFn,
        maxRetries: 1,
        retryDelayMs: 5,
        interRequestDelayMs: 7,
      },
    );

    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(sleepFn).toHaveBeenCalledTimes(2);
    expect(probeResult.summary.countsByStatus).toEqual({
      found: 1,
      not_found: 1,
    });
    expect(probeResult.results[0].attempts).toBe(2);
    expect(probeResult.results[0].flags).toContain('retry_used');

    const reviewCsv = toBuddyProbeReviewCsv(probeResult);
    expect(reviewCsv).toContain('Missing Item');
    expect(reviewCsv).not.toContain('Recovered Item,');
  });

  it('extracts HTML titles from fetched pages', () => {
    expect(extractHtmlTitle('<title>Buddy Farm | Bamboo Trellis</title>')).toBe(
      'Buddy Farm | Bamboo Trellis',
    );
    expect(extractHtmlTitle('<title data-react-helmet="true">10 Gold</title>')).toBe('10 Gold');
    expect(
      extractHtmlTitle('<meta property="og:title" content="Buddy Farm | Blue Catfish" />'),
    ).toBe('Buddy Farm | Blue Catfish');
    expect(extractHtmlTitle('<html></html>')).toBeNull();
  });
});
