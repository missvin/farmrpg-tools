import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { notifyPlayerDataChanged, usePlayerDataRevision } from './playerDataNotifications';
import { useObservedInventoryState } from './useObservedInventoryState';
import { createDefaultAcquisitionPlannerInputState, saveAcquisitionPlannerInputState } from './acquisitionPlannerState';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); });

class TestChannel {
  static instances: TestChannel[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  close = vi.fn();
  postMessage = vi.fn();
  constructor(readonly name: string) { TestChannel.instances.push(this); }
}
function View() {
  const revision = usePlayerDataRevision();
  const [state, setState] = useObservedInventoryState(createDefaultAcquisitionPlannerInputState);
  return <>
    <output aria-label="Revision">{revision}</output>
    <output aria-label="Inventory">{state.inventory.entries[0]?.inventoryCount ?? 0}</output>
    <input aria-label="Draft assumption" value={state.explore.availableStamina} onChange={(event) => setState((current) => ({ ...current, explore: { ...current.explore, availableStamina: Number(event.target.value) } }))} />
  </>;
}

describe('player data refresh notifications', () => {
  it('refreshes local observed stock, preserves draft inputs, and broadcasts only a hint', () => {
    TestChannel.instances = []; vi.stubGlobal('BroadcastChannel', TestChannel);
    render(<View />);
    fireEvent.change(screen.getByLabelText('Draft assumption'), { target: { value: '123' } });
    const state = createDefaultAcquisitionPlannerInputState();
    state.inventory.entries = [{ canonicalItemKey: 'steel', itemName: 'Steel', inventoryCount: 42 }];
    saveAcquisitionPlannerInputState(state);
    act(() => notifyPlayerDataChanged());
    expect(screen.getByLabelText('Inventory')).toHaveTextContent('42');
    expect(screen.getByLabelText('Draft assumption')).toHaveValue('123');
    expect(TestChannel.instances[0].postMessage).toHaveBeenLastCalledWith({ type: 'player-data-changed', version: 1 });
  });

  it('refreshes another tab without echoing its notification and closes the channel', () => {
    TestChannel.instances = []; vi.stubGlobal('BroadcastChannel', TestChannel);
    const { unmount } = render(<View />);
    const channel = TestChannel.instances[0]; const before = screen.getByLabelText('Revision').textContent;
    act(() => channel.onmessage?.({ data: { type: 'unknown' } } as MessageEvent));
    expect(screen.getByLabelText('Revision')).toHaveTextContent(before!);
    act(() => channel.onmessage?.({ data: { type: 'player-data-changed', version: 1 } } as MessageEvent));
    expect(screen.getByLabelText('Revision').textContent).not.toBe(before);
    expect(channel.postMessage).not.toHaveBeenCalled();
    unmount(); expect(channel.close).toHaveBeenCalledOnce();
  });
});
