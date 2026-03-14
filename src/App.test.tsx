import { render, screen } from '@testing-library/react';
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
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument();
  });
});
