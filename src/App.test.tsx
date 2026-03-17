import { render, screen } from '@testing-library/react';
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
  it('renders a shared back-to-top control that scrolls the page', async () => {
    const user = userEvent.setup();
    const scrollToSpy = vi.fn();
    Object.defineProperty(window, 'scrollTo', {
      value: scrollToSpy,
      writable: true,
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

    await user.click(screen.getByRole('button', { name: 'Back to top' }));

    expect(scrollToSpy).toHaveBeenCalledWith({
      top: 0,
      behavior: 'smooth',
    });
  });

  it('renders the dashboard and navigation links', async () => {
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
    expect(screen.getByRole('link', { name: 'Tower Progress' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument();
  });
});
