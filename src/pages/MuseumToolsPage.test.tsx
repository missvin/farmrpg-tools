import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MuseumToolsPage } from './MuseumToolsPage';

const MASTERY_CSV = `item_name,difficulty,method,notes,tags,passive_craftworks_info,farmrpg_item_id,buddy_item_id,buddy_slug,source_sheet,source_row
11th Leaf Centerpiece,1,,,,,,,,
Fancy Pipe,1,Crafting,,,,,,,,
Pot of Gold Large,1,,,,,,,,
Barracuda,1,Fishing,,,,,,,,
`;

const TOWER_CSV = `tower_level,tower_level_range,slot_index,item_name,farmrpg_item_id,mastery_level_needed,buddy_slug,notes,source_sheet,source_row
250,201-300,1,Fancy Pipe,,MM,,,,
`;

const RECIPES_CSV = `output_item_name,output_canonical_key,recipe_type,recipe_book_item_name,recipe_book_canonical_key,cooking_level,base_time,source_buddy_url
`;

const RECIPE_INPUTS_CSV = `output_canonical_key,output_item_name,input_order,input_item_name,input_canonical_key,quantity
`;

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

  it('shows auto-derived no-review-needed slugs separately from true missing slug gaps', async () => {
    const user = userEvent.setup();

    render(<MuseumToolsPage />);

    const bootstrapButton = await screen.findByRole('button', { name: 'Run Bootstrap Pass' });

    await user.type(
      screen.getByLabelText('Raw museum export'),
      `Items Count = 3
11th Leaf Centerpiece 11th Leaf Centerpiece
Fancy Pipe Fancy Pipe
Barracuda Barracuda`,
    );

    await user.click(bootstrapButton);

    const reportSection = screen
      .getByRole('heading', { name: 'Bootstrap Workflow Report' })
      .closest('section') as HTMLElement;

    expect(within(reportSection).getByText('Auto-derived buddy slugs ready')).toBeInTheDocument();
    expect(within(reportSection).getByText('Locally covered buddy slugs')).toBeInTheDocument();
    expect(within(reportSection).getByText('Known items missing expected buddy slug')).toBeInTheDocument();

    const actionableSection = screen
      .getByRole('heading', { name: 'Bootstrap Follow-Up Items' })
      .closest('section') as HTMLElement;

    expect(within(actionableSection).queryByText('11th Leaf Centerpiece')).not.toBeInTheDocument();
    expect(within(actionableSection).getByText('Fancy Pipe')).toBeInTheDocument();
    expect(within(actionableSection).getByText('Auto-derived candidate ready')).toBeInTheDocument();
    expect(within(actionableSection).getByText('No review needed')).toBeInTheDocument();
  });

  it('surfaces unresolved reconciliation hints and lets unresolved rows be triaged locally', async () => {
    const user = userEvent.setup();

    render(<MuseumToolsPage />);

    const bootstrapButton = await screen.findByRole('button', { name: 'Run Bootstrap Pass' });

    await user.type(
      screen.getByLabelText('Raw museum export'),
      `Items Count = 2
Pot of Gold (Large) Pot of Gold (Large)
Mystery Goo Mystery Goo`,
    );

    await user.click(bootstrapButton);

    const unresolvedSection = screen
      .getByRole('heading', { name: 'Unresolved Reconciliation Queue' })
      .closest('div') as HTMLElement;

    const potOfGoldRow = within(unresolvedSection).getByText('Pot of Gold (Large)').closest('tr') as HTMLElement;
    expect(potOfGoldRow).toBeInTheDocument();
    expect(within(potOfGoldRow).getByText('Likely naming mismatch')).toBeInTheDocument();
    expect(within(unresolvedSection).getByText(/Pot of Gold Large \[mastery\]/i)).toBeInTheDocument();
    const mysteryGooRow = within(unresolvedSection).getByText('Mystery Goo').closest('tr') as HTMLElement;
    expect(mysteryGooRow).toBeInTheDocument();
    expect(within(mysteryGooRow).getByText('Missing local reference')).toBeInTheDocument();

    await user.click(within(potOfGoldRow).getByRole('button', { name: 'Mark Triaged' }));

    expect(screen.getByText(/unresolved triage marks? saved locally/i)).toBeInTheDocument();
    expect(within(unresolvedSection).getAllByRole('button', { name: 'Mark Triaged' })).toHaveLength(1);

    const triagedSection = screen.getByRole('heading', { name: 'Locally Triaged Unresolved Rows' }).closest('div') as HTMLElement;
    expect(within(triagedSection).getByText('Pot of Gold (Large)')).toBeInTheDocument();
    expect(within(triagedSection).getByRole('button', { name: 'Remove Triage Mark' })).toBeInTheDocument();

    const reportSection = screen
      .getByRole('heading', { name: 'Bootstrap Workflow Report' })
      .closest('section') as HTMLElement;

    expect(within(reportSection).getByText('Active unresolved triage rows')).toBeInTheDocument();
    expect(within(reportSection).getByText('Triaged unresolved rows')).toBeInTheDocument();
  });

  it('supports unresolved case filtering and bulk-marking the visible unresolved rows as triaged', async () => {
    const user = userEvent.setup();

    render(<MuseumToolsPage />);

    const bootstrapButton = await screen.findByRole('button', { name: 'Run Bootstrap Pass' });

    await user.type(
      screen.getByLabelText('Raw museum export'),
      `Items Count = 3
Pot of Gold (Large) Pot of Gold (Large)
Fancy Pipe! Fancy Pipe!
Mystery Goo Mystery Goo`,
    );

    await user.click(bootstrapButton);

    await user.selectOptions(screen.getByLabelText('Filter unresolved case'), 'likely_name_mismatch');

    const unresolvedSection = screen
      .getByRole('heading', { name: 'Unresolved Reconciliation Queue' })
      .closest('div') as HTMLElement;

    expect(within(unresolvedSection).getByText('Pot of Gold (Large)')).toBeInTheDocument();
    expect(within(unresolvedSection).queryByText('Mystery Goo')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mark Visible Triaged' }));

    expect(screen.getByText(/unresolved triage marks? saved locally/i)).toBeInTheDocument();
    expect(within(unresolvedSection).getByText(/No active unresolved rows match the current case filter/i)).toBeInTheDocument();

    const triagedSection = screen.getByRole('heading', { name: 'Locally Triaged Unresolved Rows' }).closest('div') as HTMLElement;
    expect(within(triagedSection).getByText('Pot of Gold (Large)')).toBeInTheDocument();
  });
});
