import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CurrentInventoryImportPanel } from './InventoryImportPanels';
import { createDefaultAcquisitionPlannerInputState, loadAcquisitionPlannerInputState } from '../lib/acquisitionPlannerState';

afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

function setup(state = createDefaultAcquisitionPlannerInputState()) {
  const onChange = vi.fn();
  render(<CurrentInventoryImportPanel
    acquisitionPlannerState={state}
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

  it('stamps manual corrections so older full captures can be rejected', () => {
    const onChange = setup();
    fireEvent.change(screen.getByLabelText('Inventory item name'), { target: { value: 'Steel' } });
    fireEvent.change(screen.getByLabelText('Inventory quantity'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Inventory Item' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ inventory: expect.objectContaining({ observation: expect.objectContaining({ source: 'manual', scope: 'item' }) }) }));
  });

  it('stamps removals and exposes failures without publishing changed inventory', () => {
    const state = createDefaultAcquisitionPlannerInputState();
    state.inventory.entries = [{ canonicalItemKey: 'steel', itemName: 'Steel', inventoryCount: 10 }];
    const onChange = setup(state);
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(loadAcquisitionPlannerInputState().inventory).toMatchObject({ entries: [], observation: { source: 'manual', scope: 'item' } });
    onChange.mockClear();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Local storage full'); });
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Local storage full');
    expect(onChange).not.toHaveBeenCalled();
  });
});
