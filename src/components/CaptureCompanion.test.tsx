import { webcrypto } from 'node:crypto';
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CaptureCompanion } from './CaptureCompanion';
import { CAPTURE_PAIRING_KEY, CAPTURE_TRACKER_ORIGIN, type CaptureBridgeStatus } from '../lib/captureBridge';

const bridge = vi.hoisted(() => ({ start: vi.fn(), stop: vi.fn() }));
vi.mock('../lib/captureBridge', async (original) => ({
  ...await original<typeof import('../lib/captureBridge')>(),
  startCaptureBridge: (...args: unknown[]) => { bridge.start(...args); return bridge.stop; },
}));
beforeEach(() => {
  localStorage.clear(); bridge.start.mockClear(); bridge.stop.mockClear();
  vi.stubGlobal('crypto', webcrypto); vi.stubGlobal('location', { origin: CAPTURE_TRACKER_ORIGIN });
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: vi.fn() } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined }); });

describe('capture companion pairing and visible status', () => {
  it('requires opt-in, stores a private local key and disconnects its listener', () => {
    render(<CaptureCompanion />);
    expect(bridge.start).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Pair Firefox companion', hidden: true }));
    expect(localStorage.getItem(CAPTURE_PAIRING_KEY)).toMatch(/^[a-f0-9]{64}$/);
    expect(screen.getByLabelText('Companion pairing key')).toHaveAttribute('type', 'password');
    expect(bridge.start).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect companion', hidden: true }));
    expect(localStorage.getItem(CAPTURE_PAIRING_KEY)).toBeNull(); expect(bridge.stop).toHaveBeenCalledOnce();
  });

  it('shows waiting, applied, duplicate and failed-save messages without developer tools', () => {
    localStorage.setItem(CAPTURE_PAIRING_KEY, 'ab'.repeat(32)); render(<CaptureCompanion />);
    const callback = bridge.start.mock.calls[0][1].onStatus as (value: CaptureBridgeStatus) => void;
    for (const state of ['waiting', 'applied', 'duplicate', 'rejected'] as const) {
      act(() => callback({ state, message: `${state} details` }));
      expect(screen.getByRole(state === 'rejected' ? 'alert' : 'status')).toHaveTextContent(`${state} details`);
    }
  });

  it('keeps pairing disabled off the exact approved origin', () => {
    vi.stubGlobal('location', { origin: 'http://localhost:5173' }); render(<CaptureCompanion />);
    expect(screen.getByRole('button', { name: 'Pair Firefox companion', hidden: true })).toBeDisabled();
    expect(bridge.start).not.toHaveBeenCalled();
  });

  it('shows local save failure without installing a receiver or reporting pairing success', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota exceeded'); });
    render(<CaptureCompanion />); fireEvent.click(screen.getByRole('button', { name: 'Pair Firefox companion', hidden: true }));
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to save local companion pairing');
    expect(bridge.start).not.toHaveBeenCalled();
  });
});
