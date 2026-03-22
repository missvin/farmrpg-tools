import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MuseumToolsPage } from './MuseumToolsPage';

const MASTERY_CSV = `item_name,difficulty,method,notes,tags,passive_craftworks_info,farmrpg_item_id,buddy_item_id,buddy_slug,source_sheet,source_row
Bamboo Trellis,1,,,,,,,bamboo-trellis,,
Barracuda,1,Fishing,,,,,,,,
Fancy Pipe,1,Crafting,,,,,,,,
`;

const TOWER_CSV = `tower_level,tower_level_range,slot_index,item_name,farmrpg_item_id,mastery_level_needed,buddy_slug,notes,source_sheet,source_row
250,201-300,1,Fancy Pipe,,MM,,,,
`;

const RECIPES_CSV = `output_item_name,output_canonical_key,recipe_type,recipe_book_item_name,recipe_book_canonical_key,cooking_level,base_time,source_buddy_url
Fancy Pipe,fancy pipe,craft,,,,,https://buddy.farm/i/fancy-pipe/`;

const RECIPE_INPUTS_CSV = `output_canonical_key,output_item_name,input_order,input_item_name,input_canonical_key,quantity
fancy pipe,Fancy Pipe,1,Wood,wood,10`;

describe('MuseumToolsPage', () => {
  beforeEach(() => {
    window.localStorage.clear();

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.endsWith('/data/mastery_difficulty.csv')) {
          return new Response(MASTERY_CSV, { status: 200 });
        }

        if (url.endsWith('/data/tower_requirements.csv')) {
          return new Response(TOWER_CSV, { status: 200 });
        }

        if (url.endsWith('/data/recipes.csv')) {
          return new Response(RECIPES_CSV, { status: 200 });
        }

        if (url.endsWith('/data/recipe_inputs.csv')) {
          return new Response(RECIPE_INPUTS_CSV, { status: 200 });
        }

        return new Response('', { status: 404 });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows truthful bootstrap summary buckets instead of blunt missing totals', async () => {
    const user = userEvent.setup();

    render(<MuseumToolsPage />);

    const bootstrapButton = await screen.findByRole('button', { name: 'Run Bootstrap Pass' });
    expect(bootstrapButton).toBeEnabled();

    await user.type(
      screen.getByLabelText('Raw museum export'),
      `Items Count = 3
Bamboo Trellis Bamboo Trellis
Fancy Pipe Fancy Pipe
Barracuda Barracuda`,
    );

    await user.click(bootstrapButton);

    const reportSection = screen
      .getByRole('heading', { name: 'Bootstrap Workflow Report' })
      .closest('section') as HTMLElement;

    expect(within(reportSection).getByText('Known items with buddy slug coverage')).toBeInTheDocument();
    expect(within(reportSection).getByText('Expected recipe coverage missing')).toBeInTheDocument();
    expect(within(reportSection).getByText('Truly actionable follow-up')).toBeInTheDocument();
    expect(within(reportSection).getAllByText('No recipe expected').length).toBeGreaterThan(0);

    const actionableSection = screen
      .getByRole('heading', { name: 'Bootstrap Follow-Up Items' })
      .closest('section') as HTMLElement;

    const barracudaRow = within(actionableSection).getByText('Barracuda').closest('tr') as HTMLElement;
    expect(barracudaRow).toBeInTheDocument();
    expect(within(barracudaRow).getByText('No recipe expected')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save Bootstrap Baseline' }));

    expect(screen.getByText(/Current museum item set saved as the local bootstrap baseline\./)).toBeInTheDocument();
    expect(screen.getByText(/Saved baseline: 3 items as of/i)).toBeInTheDocument();
  });

  it('keeps non-craftable known items out of actionable follow-up while surfacing unresolved new-item cases', async () => {
    const user = userEvent.setup();

    window.localStorage.setItem(
      'farmrpg-tools.museum-known-baseline.v1',
      JSON.stringify({
        savedAt: '2026-03-22T12:00:00.000Z',
        items: [
          {
            museumCategory: 'Items',
            category: 'Item',
            itemName: 'Bamboo Trellis',
            canonicalKey: 'bamboo trellis',
            obtainable: true,
            generatedBuddySlug: 'bamboo-trellis',
            alternateBuddySlug: null,
          },
          {
            museumCategory: 'Items',
            category: 'Item',
            itemName: 'Fancy Pipe',
            canonicalKey: 'fancy pipe',
            obtainable: true,
            generatedBuddySlug: 'fancy-pipe',
            alternateBuddySlug: null,
          },
          {
            museumCategory: 'Fish',
            category: 'Fish',
            itemName: 'Barracuda',
            canonicalKey: 'barracuda',
            obtainable: true,
            generatedBuddySlug: 'barracuda',
            alternateBuddySlug: null,
          },
        ],
      }),
    );

    render(<MuseumToolsPage />);

    const incrementalButton = await screen.findByRole('button', { name: 'Run Incremental Refresh' });
    expect(incrementalButton).toBeEnabled();

    await user.type(
      screen.getByLabelText('Raw museum export'),
      `Items Count = 4
Bamboo Trellis Bamboo Trellis
Fancy Pipe Fancy Pipe
Barracuda Barracuda
PiÃƒÂ±ata Whop Stick PiÃƒÂ±ata Whop Stick`,
    );

    await user.click(incrementalButton);

    expect(screen.getByText('Incremental Refresh Report')).toBeInTheDocument();
    expect(screen.getByText('Buddy slug status unresolved')).toBeInTheDocument();

    const actionableSection = screen
      .getByRole('heading', { name: 'New Or Uncovered Items' })
      .closest('section') as HTMLElement;

    expect(within(actionableSection).getByText('Barracuda')).toBeInTheDocument();
    expect(within(actionableSection).queryByText('Bamboo Trellis')).not.toBeInTheDocument();
    expect(within(actionableSection).getByText('PiÃƒÂ±ata Whop Stick')).toBeInTheDocument();
    expect(within(actionableSection).getByText(/Generated buddy candidate needs review/i)).toBeInTheDocument();
    expect(within(actionableSection).getByText('Status unresolved')).toBeInTheDocument();
    expect(within(actionableSection).getByText('Expectation unresolved')).toBeInTheDocument();
  });
});
