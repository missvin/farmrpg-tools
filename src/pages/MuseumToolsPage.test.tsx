import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { MuseumToolsPage } from './MuseumToolsPage';

describe('MuseumToolsPage', () => {
  it('parses pasted museum text and shows validation details', async () => {
    const user = userEvent.setup();

    render(<MuseumToolsPage />);

    await user.type(
      screen.getByLabelText('Raw museum export'),
      `Farm RPG
Back
Museum

Fish (2 / 3)
Blue Catfish
Blue Catfish
Yellow Perch`,
    );

    await user.click(screen.getByRole('button', { name: 'Parse Museum Export' }));

    expect(screen.getByText('Categories parsed')).toBeInTheDocument();
    expect(screen.getByText('Unique seed items')).toBeInTheDocument();
    expect(screen.getByText('Fish')).toBeInTheDocument();
    expect(screen.getByText('Matches owned count only')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Fish: parsed 2 items, which matches the owned count but not the total count of 3.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('blue catfish')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export JSON' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeEnabled();
  });

  it('exports JSON and CSV after parsing', async () => {
    const user = userEvent.setup();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const originalCreateElement = document.createElement.bind(document);
    const clickSpy = vi.fn();

    Object.defineProperty(URL, 'createObjectURL', {
      value: vi.fn(() => 'blob:seed'),
      writable: true,
      configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: vi.fn(),
      writable: true,
      configurable: true,
    });

    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName.toLowerCase() === 'a') {
        return {
          click: clickSpy,
          set href(_: string) {},
          set download(_: string) {},
        } as unknown as HTMLAnchorElement;
      }

      return originalCreateElement(tagName);
    });

    render(<MuseumToolsPage />);

    await user.type(
      screen.getByLabelText('Raw museum export'),
      `Artifacts (1 / 1)
Chef's Hat 2`,
    );
    await user.click(screen.getByRole('button', { name: 'Parse Museum Export' }));
    await user.click(screen.getByRole('button', { name: 'Export JSON' }));
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));

    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    expect(clickSpy).toHaveBeenCalledTimes(2);

    createElementSpy.mockRestore();
    Object.defineProperty(URL, 'createObjectURL', {
      value: originalCreateObjectURL,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: originalRevokeObjectURL,
      writable: true,
      configurable: true,
    });
  });
});
