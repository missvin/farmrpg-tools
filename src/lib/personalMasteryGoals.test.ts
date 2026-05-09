import { describe, expect, it } from 'vitest';

import {
  loadPersonalMasteryGoalsState,
  normalizePersonalMasteryGoalsState,
  savePersonalMasteryGoalsState,
  upsertPersonalMasteryGoal,
  removePersonalMasteryGoal,
} from './personalMasteryGoals';

describe('personalMasteryGoals', () => {
  it('normalizes and dedupes saved goals by item and target tier', () => {
    expect(
      normalizePersonalMasteryGoalsState({
        goals: [
          {
            goalId: 'one',
            itemName: 'Gold Cucumber',
            canonicalKey: 'gold cucumber',
            targetTier: 'MM',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
          {
            goalId: 'two',
            itemName: 'Gold  Cucumber',
            targetTier: 'MM',
            createdAt: '2026-01-02T00:00:00.000Z',
            updatedAt: '2026-01-02T00:00:00.000Z',
          },
        ],
      }).goals,
    ).toHaveLength(1);
  });

  it('upserts and removes goals', () => {
    const initialState = upsertPersonalMasteryGoal(
      { schemaVersion: 1, goals: [] },
      {
        itemName: 'Board',
        targetTier: 'GM',
        now: '2026-01-01T00:00:00.000Z',
      },
    );
    const goal = initialState.goals[0];

    expect(goal).toMatchObject({
      itemName: 'Board',
      canonicalKey: 'board',
      targetTier: 'GM',
    });

    expect(removePersonalMasteryGoal(initialState, goal.goalId).goals).toHaveLength(0);
  });

  it('saves and loads goals from local storage', () => {
    const storage = window.localStorage;
    storage.clear();

    const savedState = savePersonalMasteryGoalsState(
      upsertPersonalMasteryGoal(
        { schemaVersion: 1, goals: [] },
        {
          itemName: 'Spoon',
          targetTier: 'MM',
          now: '2026-01-01T00:00:00.000Z',
        },
      ),
      storage,
    );

    expect(loadPersonalMasteryGoalsState(storage)).toEqual(savedState);
  });
});
