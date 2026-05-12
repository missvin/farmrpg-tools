import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { MUSEUM_COMPLETION_STATE_STORAGE_KEY } from '../lib/museumCompletionState';
import { MuseumCompletionPage } from './MuseumCompletionPage';

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

    await user.click(screen.getByRole('button', { name: 'Save Progress' }));

    expect(window.localStorage.getItem(MUSEUM_COMPLETION_STATE_STORAGE_KEY)).toContain('"itemName":"Corn"');
    expect(screen.getByText('Museum completion progress saved locally.')).toBeInTheDocument();
  });
});
