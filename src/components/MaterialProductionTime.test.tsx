import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearTowerProductionRates, saveTowerProductionRates } from '../lib/towerProductionRates';
import { MaterialProductionTime } from './MaterialProductionTime';

beforeEach(() => clearTowerProductionRates());

describe('shared material production time', () => {
  it('uses the supplied burden or shortfall and recomputes when the quantity changes', () => {
    saveTowerProductionRates({ schemaVersion: 1, steelPerHour: 100, steelWirePerHour: 200, oakPerHour: 750 });
    const view = render(<MemoryRouter><MaterialProductionTime canonicalKey="oak" quantity={18001} /></MemoryRouter>);
    expect(screen.getByText(/1d 1h production/)).toHaveAttribute('title', expect.stringContaining('750/hour'));
    expect(screen.getByRole('link', { name: 'Edit rate' })).toHaveAttribute('href', '/tower?productionRates=edit#tower-production-rates');
    view.rerender(<MemoryRouter><MaterialProductionTime canonicalKey="oak" quantity={750} /></MemoryRouter>);
    expect(screen.getByText(/1h production/)).toBeInTheDocument();
  });

  it('exposes missing rates and hides unrelated materials', () => {
    const view = render(<MemoryRouter><MaterialProductionTime canonicalKey="oak" quantity={100} /></MemoryRouter>);
    expect(screen.getByText(/Production hours unknown/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Set rate' })).toBeInTheDocument();
    view.rerender(<MemoryRouter><MaterialProductionTime canonicalKey="corn" quantity={100} /></MemoryRouter>);
    expect(view.container).toBeEmptyDOMElement();
  });
});
