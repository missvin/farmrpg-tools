import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  T300_POSTER_PNG_HEIGHT,
  T300_POSTER_PNG_WIDTH,
  serializeT300Poster,
} from '../features/t300Race/t300RaceExports';
import { T300RaceStoryPage } from './T300RaceStoryPage';

vi.mock('../lib/itemIconManifest', () => ({
  getItemIcon: vi.fn().mockImplementation((canonicalKey: string) => ({
    canonicalKey,
    itemName: canonicalKey,
    src: `/icons/${canonicalKey}.png`,
  })),
}));

describe('T300RaceStoryPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('presents the campaign, final race, methodology, and public exports', () => {
    render(<T300RaceStoryPage />);

    expect(screen.getByRole('heading', { name: 'The Race to T300' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'One hundred floors. 169 MM requirements.' })).toBeInTheDocument();
    expect(screen.getByText('Three masteries. Three different grinds.')).toBeInTheDocument();
    expect(screen.getAllByText(/LN means Large Net/)).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Download SVG' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download PNG' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download JSON' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download CSV' })).toBeInTheDocument();
  });

  it('moves only among observed campaign checkpoints', () => {
    render(<T300RaceStoryPage />);

    const scrubber = screen.getByRole('slider', { name: 'Campaign checkpoint' });
    fireEvent.change(scrubber, { target: { value: '0' } });

    expect(screen.getByText(/147\/169 MM/)).toBeInTheDocument();
    expect(screen.getByText(/Mar 14, 2026/)).toBeInTheDocument();
  });

  it('supports keyboard inspection of Tower levels and approximate points', async () => {
    const user = userEvent.setup();
    render(<T300RaceStoryPage />);

    const towerLevel = screen.getByRole('button', { name: /Tower 201,/ });
    await user.click(towerLevel);
    await user.keyboard('{Enter}');

    expect(screen.getByText('T201')).toBeInTheDocument();

    const approximatePoint = screen.getAllByRole('button', { name: /approximate/ })[0];
    await user.click(approximatePoint);
    expect(screen.getByText(/approximate/)).toBeInTheDocument();
  });

  it('uses publication dimensions and embeds finalist icons in serialized SVG', async () => {
    render(<T300RaceStoryPage />);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['icon'], { type: 'image/png' })),
    }));

    const poster = document.querySelector<SVGSVGElement>('.t300-poster');
    expect(poster).not.toBeNull();
    expect(poster).toHaveAttribute('width', '1600');
    expect(poster).toHaveAttribute('height', '2400');
    expect(poster?.querySelectorAll('image')).toHaveLength(3);
    expect(T300_POSTER_PNG_WIDTH).toBe(3200);
    expect(T300_POSTER_PNG_HEIGHT).toBe(4800);

    const serialized = await serializeT300Poster(poster!);
    expect(serialized).toContain('width="1600"');
    expect(serialized).toContain('height="2400"');
    expect(serialized.match(/data:image\/png;base64,/g)).toHaveLength(3);
  });
});
