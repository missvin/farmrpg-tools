import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ACQUISITION_PLANNER_STATE_STORAGE_KEY,
  loadAcquisitionPlannerInputState,
} from '../lib/acquisitionPlannerState';
import { LocksmithImportPage } from './LocksmithImportPage';

const loadLocalItemReferenceLookupMock = vi.fn();

vi.mock('../lib/localItemReferenceLookup', async () => {
  const actual = await vi.importActual<typeof import('../lib/localItemReferenceLookup')>(
    '../lib/localItemReferenceLookup',
  );

  return {
    ...actual,
    loadLocalItemReferenceLookup: (...args: unknown[]) => loadLocalItemReferenceLookupMock(...args),
  };
});

function mockLookup(): void {
  loadLocalItemReferenceLookupMock.mockResolvedValue({
    itemCatalog: {
      entries: [],
      byCanonicalKey: {
        'large chest': {
          itemName: 'Large Chest',
          canonicalKey: 'large chest',
          masteryPossible: 'unknown',
          farmrpgItemId: null,
          buddySlug: null,
          sourceDatasets: ['test'],
          notes: null,
        },
        'small chest': {
          itemName: 'Small Chest',
          canonicalKey: 'small chest',
          masteryPossible: 'unknown',
          farmrpgItemId: null,
          buddySlug: null,
          sourceDatasets: ['test'],
          notes: null,
        },
      },
    },
    aliases: {
      entries: [],
      byAliasKey: {},
      approvedByAliasKey: {},
    },
    museumCoverage: {
      entries: [],
      byCanonicalKey: {},
    },
    museumCanon: {
      entries: [],
      byCategoryKey: {},
    },
  });
}

describe('LocksmithImportPage', () => {
  afterEach(() => {
    window.localStorage.removeItem(ACQUISITION_PLANNER_STATE_STORAGE_KEY);
    loadLocalItemReferenceLookupMock.mockReset();
  });

  it('imports openable stockpiles as container owned-now entries', async () => {
    const user = userEvent.setup();
    mockLookup();

    render(<LocksmithImportPage />);

    await waitFor(() => expect(loadLocalItemReferenceLookupMock).toHaveBeenCalled());
    await user.type(screen.getByLabelText('Paste Locksmith stockpiles'), 'Large Chest x12{enter}Small Chest, 4');
    await user.click(screen.getByRole('button', { name: 'Import Locksmith Stockpiles' }));

    expect(await screen.findByText('Imported 2 Locksmith stockpile entries.')).toBeInTheDocument();
    expect(loadAcquisitionPlannerInputState().ownedNow.entries).toEqual([
      {
        canonicalItemKey: 'large chest',
        itemName: 'Large Chest',
        ownedCount: 12,
        sourceCategory: 'container',
      },
      {
        canonicalItemKey: 'small chest',
        itemName: 'Small Chest',
        ownedCount: 4,
        sourceCategory: 'container',
      },
    ]);
    expect(within(screen.getByRole('region', { name: 'Saved openable stockpiles' })).getByText('Large Chest')).toBeInTheDocument();
  });

  it('keeps manual stockpile items when replacing openable imports', async () => {
    const user = userEvent.setup();
    mockLookup();
    window.localStorage.setItem(
      ACQUISITION_PLANNER_STATE_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        ownedNow: {
          entries: [
            {
              canonicalItemKey: 'mystery bag',
              itemName: 'Mystery Bag',
              ownedCount: 3,
              sourceCategory: 'stockpile',
            },
            {
              canonicalItemKey: 'old chest',
              itemName: 'Old Chest',
              ownedCount: 9,
              sourceCategory: 'container',
            },
          ],
        },
      }),
    );

    render(<LocksmithImportPage />);

    await waitFor(() => expect(loadLocalItemReferenceLookupMock).toHaveBeenCalled());
    await user.type(screen.getByLabelText('Paste Locksmith stockpiles'), 'Large Chest x12');
    await user.click(screen.getByRole('button', { name: 'Import Locksmith Stockpiles' }));

    expect(loadAcquisitionPlannerInputState().ownedNow.entries).toEqual([
      {
        canonicalItemKey: 'large chest',
        itemName: 'Large Chest',
        ownedCount: 12,
        sourceCategory: 'container',
      },
      {
        canonicalItemKey: 'mystery bag',
        itemName: 'Mystery Bag',
        ownedCount: 3,
        sourceCategory: 'stockpile',
      },
    ]);
  });
});
