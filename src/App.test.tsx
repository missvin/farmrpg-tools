import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

vi.mock('./lib/storage/masterySnapshots', () => ({
  getLatestSnapshot: vi.fn().mockResolvedValue(null),
}));

vi.mock('./lib/loadMasteryDifficulty', () => ({
  loadMasteryDifficulty: vi.fn().mockResolvedValue({
    entries: [],
    byCanonicalKey: {},
  }),
}));

import App from './App';

describe('App shell', () => {
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
    expect(screen.getByRole('link', { name: 'Import' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Museum Tools' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Backlog Graph' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ingredient Lookup' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tower Progress' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument();
  });
});
