import { describe, expect, it, vi } from 'vitest';

import {
  extractBuddyQuestPage,
  extractBuddyQuestTargets,
  getBuddyQuestPageDataUrl,
  parseBuddyQuestTargetCsv,
  toBuddyQuestCatalogCsv,
  toBuddyQuestRequirementsCsv,
  toBuddyQuestReviewCsv,
  toBuddyQuestRewardsCsv,
} from '../../scripts/lib/buddyQuestExtract.mjs';

describe('buddyQuestExtract', () => {
  it('parses target CSV rows and derives quest page-data URLs', () => {
    const targets = parseBuddyQuestTargetCsv(`quest_name,buddy_url,questline_name,questline_aliases,notes
Distant Illusions XII,https://buddy.farm/q/distant-illusions-xii/,Distant Illusions,DI,seed quest`);

    expect(targets).toEqual([
      {
        questName: 'Distant Illusions XII',
        buddyUrl: 'https://buddy.farm/q/distant-illusions-xii/',
        questlineName: 'Distant Illusions',
        questlineAliases: ['DI'],
        notes: ['seed quest'],
      },
    ]);
    expect(getBuddyQuestPageDataUrl(targets[0].buddyUrl)).toBe(
      'https://buddy.farm/page-data/q/distant-illusions-xii/page-data.json',
    );
  });

  it('extracts catalog, requirement, reward, and chain rows from quest page-data', () => {
    const result = extractBuddyQuestPage(
      {
        questName: 'Distant Illusions XII',
        buddyUrl: 'https://buddy.farm/q/distant-illusions-xii/',
        questlineName: 'Distant Illusions',
        questlineAliases: ['DI'],
        notes: [],
      },
      {
        result: {
          data: {
            farmrpg: {
              quests: [
                {
                  name: 'Distant Illusions XII',
                  questline: { name: 'Distant Illusions' },
                  stageLabel: 'XII',
                  npc: { name: 'Buddy' },
                  previousQuest: { name: 'Distant Illusions XI' },
                  nextQuest: { name: 'Distant Illusions XIII' },
                  requirements: [
                    {
                      item: { name: 'Strange Ring' },
                      quantity: 1000,
                    },
                  ],
                  rewards: [
                    {
                      item: { name: 'Silver' },
                      quantity: 50,
                    },
                  ],
                },
              ],
            },
          },
        },
      },
    );

    expect(result.extractionStatus).toBe('extracted');
    expect(result.catalogRow).toEqual(
      expect.objectContaining({
        questKey: 'distant illusions xii',
        questlineKey: 'distant illusions',
        previousQuestKey: 'distant illusions xi',
        nextQuestKeys: ['distant illusions xiii'],
        coverageStatus: 'reviewed',
      }),
    );
    expect(result.requirementRows).toEqual([
      expect.objectContaining({
        questKey: 'distant illusions xii',
        itemName: 'Strange Ring',
        canonicalKey: 'strange ring',
        quantity: 1000,
      }),
    ]);
    expect(result.rewardRows).toEqual([
      expect.objectContaining({
        itemName: 'Silver',
        canonicalKey: 'silver',
        quantity: 50,
      }),
    ]);
  });

  it('marks ambiguous pages for review instead of promoting bad rows', () => {
    const result = extractBuddyQuestPage(
      {
        questName: 'Missing Quest',
        buddyUrl: 'https://buddy.farm/q/missing-quest/',
        questlineName: 'Missing',
        questlineAliases: [],
        notes: [],
      },
      {
        result: {
          data: {
            farmrpg: {},
          },
        },
      },
    );

    expect(result.extractionStatus).toBe('uncertain');
    expect(result.catalogRow).toBeNull();
    expect(result.flags).toEqual(['quest_payload_not_unique']);
  });

  it('fetches targets sequentially and exports reviewable CSV outputs', async () => {
    const sleepFn = vi.fn().mockResolvedValue(undefined);
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            result: {
              data: {
                farmrpg: {
                  quests: [
                    {
                      name: 'Pirates Start Arriving XVI',
                      questlineName: 'Pirates Start Arriving',
                      requirements: [{ itemName: 'Orange Gecko', quantity: 200 }],
                      rewards: [],
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

    const extraction = await extractBuddyQuestTargets(
      [
        {
          questName: 'Pirates Start Arriving XVI',
          buddyUrl: 'https://buddy.farm/q/pirates-start-arriving-xvi/',
          questlineName: 'Pirates Start Arriving',
          questlineAliases: ['PSA'],
          notes: [],
        },
        {
          questName: 'Missing Quest',
          buddyUrl: 'https://buddy.farm/q/missing-quest/',
          questlineName: 'Missing',
          questlineAliases: [],
          notes: [],
        },
      ],
      { fetchFn, sleepFn, interRequestDelayMs: 7 },
    );

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(sleepFn).toHaveBeenCalledWith(7);
    expect(extraction.summary.countsByStatus).toEqual({
      partial: 1,
      uncertain: 1,
    });
    expect(toBuddyQuestCatalogCsv(extraction)).toContain('Pirates Start Arriving XVI');
    expect(toBuddyQuestRequirementsCsv(extraction)).toContain('Orange Gecko');
    expect(toBuddyQuestRewardsCsv(extraction)).toContain('reward_type');
    expect(toBuddyQuestReviewCsv(extraction)).toContain('Missing Quest');
  });
});
