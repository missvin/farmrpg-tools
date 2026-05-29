import { describe, expect, it } from 'vitest';

import {
  clearMemoryHelperSlot,
  createDefaultMemoryHelperState,
  deriveMemoryHelperBoard,
  normalizeMemoryHelperState,
  resetMemoryHelperGame,
  setMemoryHelperPairMatched,
  setMemoryHelperSlotItem,
  undoMemoryHelperAction,
} from './memoryHelperState';

describe('memoryHelperState', () => {
  it('normalizes to a fixed 6x4 board', () => {
    const state = normalizeMemoryHelperState({
      slots: [
        {
          item: {
            itemName: 'Board',
            canonicalKey: 'board',
          },
          matched: true,
        },
      ],
    });

    expect(state.slots).toHaveLength(24);
    expect(state.slots[0]).toMatchObject({
      slotId: 'slot-1',
      row: 1,
      column: 1,
      item: {
        itemName: 'Board',
        canonicalKey: 'board',
      },
      matched: true,
    });
    expect(state.slots[23]).toMatchObject({
      slotId: 'slot-24',
      row: 4,
      column: 6,
      item: null,
      matched: false,
    });
  });

  it('detects and marks pairs by canonical item key', () => {
    let state = createDefaultMemoryHelperState();
    state = setMemoryHelperSlotItem(state, {
      slotId: 'slot-1',
      itemName: 'Board',
      updatedAt: '2026-05-29T00:00:00.000Z',
    });
    state = setMemoryHelperSlotItem(state, {
      slotId: 'slot-8',
      itemName: 'BOARD',
      canonicalKey: 'board',
      updatedAt: '2026-05-29T00:00:01.000Z',
    });

    let derivation = deriveMemoryHelperBoard(state);
    expect(derivation.summary).toMatchObject({
      filledSlots: 2,
      detectedPairs: 1,
      matchedPairs: 0,
      remainingPairs: 12,
    });
    expect(derivation.pairs[0]).toMatchObject({
      canonicalKey: 'board',
      slotIds: ['slot-1', 'slot-8'],
      matched: false,
    });
    expect(derivation.slots[0].status).toBe('detected');

    state = setMemoryHelperPairMatched(state, 'board', true, '2026-05-29T00:00:02.000Z');
    derivation = deriveMemoryHelperBoard(state);

    expect(derivation.summary.matchedPairs).toBe(1);
    expect(derivation.summary.remainingPairs).toBe(11);
    expect(derivation.slots[0].status).toBe('matched');
    expect(derivation.slots[7].status).toBe('matched');
  });

  it('supports clearing reset and one-step undo', () => {
    let state = createDefaultMemoryHelperState();
    state = setMemoryHelperSlotItem(state, {
      slotId: 'slot-1',
      itemName: 'Gold Cucumber',
      updatedAt: '2026-05-29T00:00:00.000Z',
    });
    state = clearMemoryHelperSlot(state, 'slot-1', '2026-05-29T00:00:01.000Z');

    expect(deriveMemoryHelperBoard(state).summary.filledSlots).toBe(0);
    state = undoMemoryHelperAction(state, '2026-05-29T00:00:02.000Z');
    expect(deriveMemoryHelperBoard(state).summary.filledSlots).toBe(1);
    expect(state.slots[0].item?.itemName).toBe('Gold Cucumber');

    state = resetMemoryHelperGame(state, '2026-05-29T00:00:03.000Z');
    expect(deriveMemoryHelperBoard(state).summary.filledSlots).toBe(0);
    state = undoMemoryHelperAction(state, '2026-05-29T00:00:04.000Z');
    expect(deriveMemoryHelperBoard(state).summary.filledSlots).toBe(1);
  });

  it('warns when more than two slots contain the same item', () => {
    let state = createDefaultMemoryHelperState();

    for (const slotId of ['slot-1', 'slot-2', 'slot-3']) {
      state = setMemoryHelperSlotItem(state, {
        slotId,
        itemName: 'Board',
        updatedAt: '2026-05-29T00:00:00.000Z',
      });
    }

    expect(deriveMemoryHelperBoard(state).warnings).toEqual([
      'Board appears in 3 cells; the mini-game should only have one pair.',
    ]);
  });
});
