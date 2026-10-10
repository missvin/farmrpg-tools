import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CurrentInventoryImportPanel } from './InventoryImportPanels';
import { createDefaultAcquisitionPlannerInputState, loadAcquisitionPlannerInputState } from '../lib/acquisitionPlannerState';

afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

function setup() {
  const onChange = vi.fn();
  render(<CurrentInventoryImportPanel
    acquisitionPlannerState={createDefaultAcquisitionPlannerInputState()}
    onAcquisitionPlannerStateChange={onChange}
    localItemLookup={null}
    headingId="inventory-test"
  />);
  fireEvent.change(screen.getByLabelText('Paste current inventory'), { target: { value: 'Steel, 10' } });
  return onChange;
}

describe('current inventory import persistence', () => {
  it('saves through the shared service and notifies the open view', () => {
    const onChange = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Import Current Inventory' }));
    expect(onChange).toHaveBeenCalledWith(loadAcquisitionPlannerInputState());
    expect(screen.getByText('Imported 1 current inventory entries.')).toBeInTheDocument();
    expect(loadAcquisitionPlannerInputState().inventory.entries).toEqual([
      { canonicalItemKey: 'steel', itemName: 'Steel', inventoryCount: 10 },
    ]);
  });

  it('shows storage failure and retains paste without reporting success or notifying a false state', () => {
    const onChange = setup();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Local storage full'); });
    fireEvent.click(screen.getByRole('button', { name: 'Import Current Inventory' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Local storage full');
    expect(screen.getByLabelText('Paste current inventory')).toHaveValue('Steel, 10');
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByText(/Imported 1/)).not.toBeInTheDocument();
  });
});
