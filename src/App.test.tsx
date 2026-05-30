import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import { APP_THEME_STORAGE_KEY } from './lib/themePreference';

vi.mock('./lib/storage/masterySnapshots', () => ({
  getLatestSnapshot: vi.fn().mockResolvedValue(null),
}));

vi.mock('./lib/loadMasteryDifficulty', () => ({
  loadMasteryDifficulty: vi.fn().mockResolvedValue({
    entries: [],
    byCanonicalKey: {},
  }),
}));

vi.mock('./lib/loadTowerRequirements', () => ({
  loadTowerRequirements: vi.fn().mockResolvedValue({
    entries: [],
    byCanonicalKey: {},
  }),
}));

vi.mock('./lib/loadItemCatalog', () => ({
  loadItemCatalog: vi.fn().mockResolvedValue({
    entries: [
      {
        itemName: 'Red Dye',
        canonicalKey: 'red dye',
        masteryPossible: 'yes',
        farmrpgItemId: null,
        buddySlug: null,
        sourceDatasets: ['test'],
        notes: null,
      },
    ],
    byCanonicalKey: {},
  }),
}));

vi.mock('./lib/loadRecipeGraph', () => ({
  loadRecipeGraph: vi.fn().mockResolvedValue({
    recipes: [],
    byOutputCanonicalKey: {},
    byInputCanonicalKey: {},
    craftRecipes: [],
    cookingRecipes: [],
  }),
}));

import App from './App';

describe('App shell', () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  function setWindowScrollY(value: number): void {
    Object.defineProperty(window, 'scrollY', {
      value,
      writable: true,
      configurable: true,
    });
  }

  it('shows the shared back-to-top control after scrolling and scrolls back to the top', async () => {
    const user = userEvent.setup();
    const scrollToSpy = vi.fn();
    setWindowScrollY(0);
    Object.defineProperty(window, 'scrollTo', {
      value: scrollToSpy,
      writable: true,
      configurable: true,
    });

    render(
      <MemoryRouter
        initialEntries={['/']}
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <App />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: 'Back to top' })).not.toBeInTheDocument();

    await act(async () => {
      setWindowScrollY(120);
      window.dispatchEvent(new Event('scroll'));
    });

    const backToTopButton = await screen.findByRole('button', { name: 'Back to top' });
    await user.click(backToTopButton);

    expect(scrollToSpy).toHaveBeenCalledWith({
      top: 0,
      behavior: 'smooth',
    });
  });

  it('hides the shared back-to-top control again when returning to the top', async () => {
    setWindowScrollY(160);

    render(
      <MemoryRouter
        initialEntries={['/']}
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: 'Back to top' })).toBeInTheDocument();

    await act(async () => {
      setWindowScrollY(0);
      window.dispatchEvent(new Event('scroll'));
    });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Back to top' })).not.toBeInTheDocument();
    });
  });

  it('renders the dashboard and navigation links', async () => {
    const user = userEvent.setup();
    setWindowScrollY(0);

    render(
      <MemoryRouter
        initialEntries={['/']}
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('FarmRPG Planning Tools')).toBeInTheDocument();
    expect(screen.getByText('Local-first progress and material planning.')).toBeInTheDocument();
    expect(screen.getByText('Plan')).toBeInTheDocument();
    expect(screen.getByText('Import')).toBeInTheDocument();
    expect(screen.getByText('Progress')).toBeInTheDocument();
    expect(screen.getByText('Other')).toBeInTheDocument();
    expect(screen.getByText('Data')).toBeInTheDocument();
    expect(screen.getByText('Dev Tools')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Plan' }));
    expect(screen.getByRole('link', { name: 'Ingredient Lookup' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Material Planner' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Mastery Goals' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Museum Tools' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Backlog Graph' })).not.toBeInTheDocument();

    await user.click(screen.getByText('Import'));
    expect(await screen.findByRole('link', { name: 'Import Mastery' })).toBeVisible();
    expect(await screen.findByRole('link', { name: 'Import Inventory' })).toBeVisible();
    expect(await screen.findByRole('link', { name: 'Import Pet Items' })).toBeVisible();
    expect(await screen.findByRole('link', { name: 'Locksmith Import' })).toBeVisible();

    await user.click(screen.getByText('Progress'));
    expect(await screen.findByRole('link', { name: 'Tower Items by Difficulty' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'History' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Compare' })).not.toBeInTheDocument();

    await user.click(screen.getByText('Other'));
    expect(await screen.findByRole('link', { name: "Borgen's Lost and Found" })).toBeVisible();
    expect(await screen.findByRole('link', { name: 'Museum Completion' })).toBeVisible();

    await user.click(screen.getByText('Data'));
    expect(await screen.findByRole('link', { name: 'History' })).toBeVisible();
    expect(await screen.findByRole('link', { name: 'Compare' })).toBeVisible();
    expect(await screen.findByRole('link', { name: 'Settings' })).toBeVisible();

    await user.click(screen.getByText('Dev Tools'));
    expect(await screen.findByRole('link', { name: 'Museum Tools' })).toBeVisible();
    expect(await screen.findByRole('link', { name: 'Backlog Graph' })).toBeVisible();
  });

  it('closes an open dropdown when clicking outside the navigation', async () => {
    const user = userEvent.setup();
    setWindowScrollY(0);

    render(
      <MemoryRouter
        initialEntries={['/']}
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <App />
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: 'Dashboard' });
    await user.click(screen.getByRole('button', { name: 'Dev Tools' }));
    expect(screen.getByRole('link', { name: 'Museum Tools' })).toBeVisible();

    await user.click(screen.getByRole('heading', { name: 'Dashboard' }));

    expect(screen.queryByRole('link', { name: 'Museum Tools' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Backlog Graph' })).not.toBeInTheDocument();
  });

  it('keeps at most one dropdown open at a time and closes on Escape', async () => {
    const user = userEvent.setup();
    setWindowScrollY(0);

    render(
      <MemoryRouter
        initialEntries={['/']}
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <App />
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: 'Dashboard' });
    await user.click(screen.getByRole('button', { name: 'Progress' }));
    expect(screen.getByRole('link', { name: 'Tower Items by Difficulty' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Import' }));
    expect(screen.queryByRole('link', { name: 'Tower Items by Difficulty' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Import Mastery' })).toBeVisible();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('link', { name: 'Import Mastery' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Import Inventory' })).not.toBeInTheDocument();
  });

  it('closes the dropdown after selecting a menu item', async () => {
    const user = userEvent.setup();
    setWindowScrollY(0);

    render(
      <MemoryRouter
        initialEntries={['/']}
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <App />
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: 'Dashboard' });
    await user.click(screen.getByRole('button', { name: 'Import' }));
    await user.click(screen.getByRole('link', { name: 'Import Mastery' }));

    expect(await screen.findByRole('heading', { name: 'Import Mastery Snapshot' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Import Mastery' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Import Inventory' })).not.toBeInTheDocument();
  });

  it('defaults to light theme when no saved preference exists and toggles to dark mode', async () => {
    const user = userEvent.setup();
    setWindowScrollY(0);

    render(
      <MemoryRouter
        initialEntries={['/']}
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(window.localStorage.getItem(APP_THEME_STORAGE_KEY)).toBe('light');

    await user.click(screen.getByRole('button', { name: 'Switch to dark mode' }));

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem(APP_THEME_STORAGE_KEY)).toBe('dark');
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument();
  });

  it('searches pages from the app header', async () => {
    const user = userEvent.setup();
    setWindowScrollY(0);

    render(
      <MemoryRouter
        initialEntries={['/']}
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Search pages and items'), 'tower');

    const searchResults = await screen.findByRole('region', { name: 'Search results' });
    expect(within(searchResults).getByRole('link', { name: /Tower Items by Difficulty/ })).toBeVisible();
    expect(within(searchResults).getByRole('link', { name: /Tower \/tower/ })).toBeVisible();
  });

  it('searches local items from the app header and opens item profiles', async () => {
    const user = userEvent.setup();
    setWindowScrollY(0);

    render(
      <MemoryRouter
        initialEntries={['/']}
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Search pages and items'), 'red');

    const searchResults = await screen.findByRole('region', { name: 'Search results' });
    expect(within(searchResults).getByRole('link', { name: /Red Dye/ })).toHaveAttribute(
      'href',
      '/items/red%20dye',
    );
  });

  it('applies a persisted dark theme preference on initial render', async () => {
    setWindowScrollY(0);
    window.localStorage.setItem(APP_THEME_STORAGE_KEY, 'dark');

    render(
      <MemoryRouter
        initialEntries={['/']}
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument();
  });

  it('falls back safely to light theme for an invalid stored preference', async () => {
    setWindowScrollY(0);
    window.localStorage.setItem(APP_THEME_STORAGE_KEY, 'sepia');

    render(
      <MemoryRouter
        initialEntries={['/']}
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(window.localStorage.getItem(APP_THEME_STORAGE_KEY)).toBe('light');
  });

  it('renders a lazy-loaded route through the app shell', async () => {
    render(
      <MemoryRouter
        initialEntries={['/history']}
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('Loading page')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Snapshot History' })).toBeInTheDocument();
  });
});
