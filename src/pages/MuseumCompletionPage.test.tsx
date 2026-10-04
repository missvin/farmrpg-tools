import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MUSEUM_COMPLETION_STATE_STORAGE_KEY } from '../lib/museumCompletionState';
import { MuseumCompletionPage } from './MuseumCompletionPage';

vi.mock('../lib/museumAcquisitionContext', async (importOriginal) => ({
  ...await importOriginal<typeof import('../lib/museumAcquisitionContext')>(),
  loadMuseumAcquisitionReferences: async () => ({
    drops: { corn: [{ sourceType: 'Farming', sourceName: 'Corn Seeds' }] },
    pets: {}, openables: {}, hints: {}, recipes: {}, incomplete: false,
  }),
}));

const PERSONAL_MUSEUM_EXPORT = `Collection Progress
Crops (1 / 2)
Beet
-
Items (1 / 2)
-
Ant Apple
Consume a meal
Mushroom Stew`;

describe('MuseumCompletionPage', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('previews museum completion, tracks reviewed missing items, and saves progress locally', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <MuseumCompletionPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('My museum export'), PERSONAL_MUSEUM_EXPORT);
    await user.click(screen.getByRole('button', { name: 'Preview Progress' }));

    const progressSection = screen.getByRole('heading', { name: 'Progress' }).closest('section');
    expect(progressSection).not.toBeNull();
    expect(within(progressSection as HTMLElement).getByText('2 / 4')).toBeInTheDocument();
    expect(within(progressSection as HTMLElement).getByText('50.0% complete')).toBeInTheDocument();
    expect(within(progressSection as HTMLElement).getByText('No reviewed missing item names yet.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Item name'), 'Corn');
    await user.click(screen.getByRole('button', { name: 'Add Reviewed Item' }));

    expect(within(progressSection as HTMLElement).getByRole('link', { name: 'Corn' })).toHaveAttribute(
      'href',
      '/items/corn',
    );
    expect(within(progressSection as HTMLElement).getByText('1 unnamed missing slot')).toBeInTheDocument();
    await user.click(within(progressSection as HTMLElement).getByText('How to get it · 1 local source'));
    expect(within(progressSection as HTMLElement).getByText('Farming: Corn Seeds')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save Progress' }));

    expect(window.localStorage.getItem(MUSEUM_COMPLETION_STATE_STORAGE_KEY)).toContain('"itemName":"Corn"');
    expect(screen.getByText('Museum completion progress saved locally.')).toBeInTheDocument();
  });

  it('keeps missing source coverage as an ordinary empty state with a working item link', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><MuseumCompletionPage /></MemoryRouter>);
    await user.type(screen.getByLabelText('My museum export'), PERSONAL_MUSEUM_EXPORT);
    await user.type(screen.getByLabelText('Item name'), 'Uncovered Item');
    await user.click(screen.getByRole('button', { name: 'Add Reviewed Item' }));
    const section = screen.getByRole('heading', { name: 'Progress' }).closest('section') as HTMLElement;
    expect(await within(section).findByText('No local source information yet.')).toBeInTheDocument();
    expect(within(section).getByRole('link', { name: 'Uncovered Item' })).toHaveAttribute('href', '/items/uncovered%20item');
  });
});
