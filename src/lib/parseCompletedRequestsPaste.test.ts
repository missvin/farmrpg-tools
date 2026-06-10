import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { describe, expect, it } from 'vitest';

import { parseCompletedRequestsPaste } from './parseCompletedRequestsPaste';

function readFixture(filename: string): string {
  return readFileSync(join(process.cwd(), 'src', 'lib', 'fixtures', filename), 'utf8');
}

describe('parseCompletedRequestsPaste', () => {
  it('parses completed request rows from the focused fixture', () => {
    const result = parseCompletedRequestsPaste(readFixture('completedRequests.focused.sample.txt'));

    expect(result.summary).toMatchObject({
      reportedCompletedCount: 2257,
      completedRowsCount: 7,
      activeRowsCount: 0,
      warningCount: 0,
    });
    expect(result.completedRequests[0]).toEqual({
      questKey: 'steam powered 2: episode 2',
      questName: 'Steam Powered 2: Episode 2',
      npc: 'Jill',
      requestKind: null,
      completedAt: '2026-06-03T11:19:14',
      completedAtRaw: '2026-06-03 11:19:14',
      playerCount: 7836,
      completionPercent: 0.69,
    });
    expect(result.completedRequests[1]).toMatchObject({
      questName: "Crates Unlocked for Buddy's Enrichment VI",
      npc: 'Buddy',
      requestKind: 'side',
      playerCount: 4814,
    });
    expect(result.completedRequests.at(-1)).toMatchObject({
      questName: 'Feathers II',
      npc: '???',
      playerCount: 285937,
      completionPercent: 25.33,
    });
  });

  it('ignores active requests, request totals, meals, and other page cruft in the noisy fixture', () => {
    const result = parseCompletedRequestsPaste(readFixture('completedRequests.noisy.sample.txt'));

    expect(result.summary.completedRowsCount).toBe(13);
    expect(result.summary.activeRowsCount).toBe(2);
    expect(result.activeRequests.map((request) => request.questName)).toEqual([
      'Distant Illusions XIII',
      'Pirates Start Arriving XVI',
    ]);
    expect(result.completedRequests.map((request) => request.questName)).toContain('Distant Illusions XII');
    expect(result.completedRequests.map((request) => request.questName)).not.toContain('Cabbage Stew');
    expect(result.completedRequests.map((request) => request.questName)).not.toContain('Special Project');
  });

  it('keeps malformed rows non-fatal and reports warnings', () => {
    const result = parseCompletedRequestsPaste(`
Completed Requests (2)
Odd Quest
Request from Buddy - Main Quest
Yesterday-ish
many players completed
check
`);

    expect(result.completedRequests).toEqual([
      expect.objectContaining({
        questName: 'Odd Quest',
        npc: 'Buddy',
        requestKind: 'main',
        completedAt: null,
        playerCount: null,
        completionPercent: null,
      }),
    ]);
    expect(result.warnings).toEqual([
      'Could not parse completion timestamp for "Odd Quest".',
      'Could not parse completion population for "Odd Quest".',
    ]);
  });
});
