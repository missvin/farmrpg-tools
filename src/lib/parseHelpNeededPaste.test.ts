import { describe, expect, it } from 'vitest';

import { parseHelpNeededPaste } from './parseHelpNeededPaste';

describe('parseHelpNeededPaste', () => {
  it('parses active requests, NPCs, completion percent, and player gates from noisy page text', () => {
    const result = parseHelpNeededPaste(`
Farm RPG
Help Needed

My skills

Farming
Level 99

Fishing
Level 99

Crafting
Level 99

Exploring
Level 99

Cooking
Level 98

Mining
Level 78

The Tower
Unused Points: 8,350
Level 292

Active Requests (2) Sort: Comp%, NPC, Title, Default

ACTIVE HELP REQUEST
Distant Illusions XII
Request from Buddy
94.14%
Pirates Start Arriving XVI
Request from Vincent
78.27%

Personal Requests (0)
No more left today.

Consume a meal
566
Cabbage Stew
`);

    expect(result.reportedActiveRequestCount).toBe(2);
    expect(result.activeRequests).toEqual([
      {
        questKey: 'distant illusions xii',
        questName: 'Distant Illusions XII',
        npc: 'Buddy',
        completionPercent: 94.14,
      },
      {
        questKey: 'pirates start arriving xvi',
        questName: 'Pirates Start Arriving XVI',
        npc: 'Vincent',
        completionPercent: 78.27,
      },
    ]);
    expect(result.gates).toMatchObject({
      farmingLevel: 99,
      fishingLevel: 99,
      craftingLevel: 99,
      exploringLevel: 99,
      cookingLevel: 98,
      miningLevel: 78,
      towerLevel: 292,
    });
    expect(result.warnings).toEqual([]);
  });

  it('warns when the reported active count does not match parsed request rows', () => {
    const result = parseHelpNeededPaste(`
Active Requests (2)
One Real Quest
Request from Buddy
12.5%
Request Totals
`);

    expect(result.activeRequests).toHaveLength(1);
    expect(result.warnings).toContain('Active Requests reported 2 quests, but 1 quest could be parsed.');
  });
});
