import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CAPTURE_CHANNEL, CAPTURE_SENDER, CAPTURE_TRACKER_ORIGIN, startCaptureBridge, type CaptureBridgeStatus } from './captureBridge';
import type { LocalItemReferenceLookup } from './localItemReferenceLookup';

const secret = 'ab'.repeat(32);
const body = JSON.stringify({ requestId: 'request-1', capture: { section: 'inventory', captureId: 'capture-1' } });
const stops: Array<() => void> = [];
beforeEach(() => vi.stubGlobal('crypto', webcrypto));
afterEach(() => { stops.splice(0).forEach((stop) => stop()); vi.unstubAllGlobals(); });

async function signed(text = body, keyHex = secret) {
  const key = await crypto.subtle.importKey('raw', new Uint8Array(keyHex.match(/../g)!.map((pair) => Number.parseInt(pair, 16))), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`1\n${CAPTURE_SENDER}\n${text}`));
  return { channel: CAPTURE_CHANNEL, version: 1, sender: CAPTURE_SENDER, body: text, signature: Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('') };
}
function setup(origin = CAPTURE_TRACKER_ORIGIN, framed = false) {
  const target = Object.assign(new EventTarget(), { location: { origin }, postMessage: vi.fn(), top: null as unknown }) as unknown as Window;
  Object.defineProperty(target, 'top', { value: framed ? window : target });
  const statuses: CaptureBridgeStatus[] = [];
  const apply = vi.fn().mockResolvedValue({ ok: true, receipt: { section: 'inventory', captureId: 'capture-1', observedAt: '2026-10-10T12:00:00.000Z' }, warnings: [] });
  const loadLookup = vi.fn().mockResolvedValue({} as LocalItemReferenceLookup);
  const notify = vi.fn();
  let pairing: string | null = secret;
  stops.push(startCaptureBridge(target, { onStatus: (status) => statuses.push(status), apply, loadLookup, notify, readKey: () => pairing }));
  const send = (data: unknown, eventOrigin = CAPTURE_TRACKER_ORIGIN, source: MessageEventSource | null = target) => {
    target.dispatchEvent(new MessageEvent('message', { data, origin: eventOrigin, source }));
  };
  return { target, statuses, apply, loadLookup, notify, send, disconnect: () => { pairing = null; } };
}

describe('authenticated tracker capture bridge', () => {
  it('acknowledges only after persistence completes, then notifies open views', async () => {
    const test = setup();
    let finish!: (value: unknown) => void;
    test.apply.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    test.send(await signed());
    await vi.waitFor(() => expect(test.apply).toHaveBeenCalledOnce());
    expect(test.statuses.at(-1)?.state).toBe('applying');
    expect(test.target.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ state: 'applied' }), expect.anything());
    expect(test.notify).not.toHaveBeenCalled();
    finish({ ok: true, receipt: { captureId: 'capture-1', section: 'inventory', observedAt: '2026-10-10T12:00:00.000Z' }, warnings: ['Unknown item retained'] });
    await vi.waitFor(() => expect(test.statuses.at(-1)?.state).toBe('applied'));
    expect(test.target.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ requestId: 'request-1', state: 'applied', warnings: ['Unknown item retained'] }), CAPTURE_TRACKER_ORIGIN);
    expect(test.apply.mock.calls[0][1].requiredSections).toEqual(['Everything']);
    expect(test.notify).toHaveBeenCalledOnce();
  });

  it.each(['https://evil.example', 'https://farmrpg-tools.vercel.app.evil.example', 'http://farmrpg-tools.vercel.app', 'https://farmrpg-tools.vercel.app:8443', 'null'])('ignores a message from %s', async (origin) => {
    const test = setup(); test.send(await signed(), origin);
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(test.apply).not.toHaveBeenCalled(); expect(test.target.postMessage).not.toHaveBeenCalled();
  });

  it.each(['null', 'other window'])('ignores non-self source %s', async (source) => {
    const test = setup(); test.send(await signed(), CAPTURE_TRACKER_ORIGIN, source === 'null' ? null : window);
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(test.apply).not.toHaveBeenCalled();
  });

  it.each([['https://unapproved.vercel.app', false], [CAPTURE_TRACKER_ORIGIN, true]] as const)('refuses receiver installation on wrong origin/frame', async (origin, frame) => {
    const test = setup(origin, frame); test.send(await signed());
    expect(test.statuses.at(-1)?.state).toBe('rejected'); expect(test.apply).not.toHaveBeenCalled();
  });

  it.each([
    ['version', { version: 2 }], ['sender', { sender: 'other-extension' }],
    ['signature', { signature: 'bad' }], ['size', { body: 'x'.repeat(5_000_001) }],
  ])('rejects malformed envelope %s', async (_label, patch) => {
    const test = setup(); test.send({ ...await signed(), ...patch });
    await vi.waitFor(() => expect(test.statuses.at(-1)?.state).toBe('rejected'));
    expect(test.apply).not.toHaveBeenCalled(); expect(test.target.postMessage).not.toHaveBeenCalled();
  });

  it('rejects a wrong key, changed signed body and malformed authenticated JSON', async () => {
    const test = setup();
    test.send(await signed(body, 'cd'.repeat(32)));
    await vi.waitFor(() => expect(test.statuses.at(-1)?.message).toContain('authentication failed'));
    test.send({ ...await signed(), body: body.replace('request-1', 'request-2') });
    await vi.waitFor(() => expect(test.statuses.filter((status) => status.state === 'rejected')).toHaveLength(2));
    test.send(await signed('{broken'));
    await vi.waitFor(() => expect(test.statuses.filter((status) => status.state === 'rejected')).toHaveLength(3));
    expect(test.apply).not.toHaveBeenCalled();
  });

  it.each(['Quota exceeded', 'Duplicate capture; previous data retained.', 'Older or simultaneous capture; previous data retained.'])('returns an accurate acknowledgment for %s', async (reason) => {
    const test = setup(); test.apply.mockResolvedValue({ ok: false, reason }); test.send(await signed());
    const state = reason.startsWith('Duplicate') ? 'duplicate' : 'rejected';
    await vi.waitFor(() => expect(test.target.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ state, message: reason }), CAPTURE_TRACKER_ORIGIN));
    expect(test.notify).not.toHaveBeenCalled();
    expect(test.statuses.some((status) => status.state === 'applied')).toBe(false);
  });

  it('exposes waiting during another capture instead of dropping or claiming application', async () => {
    const test = setup(); test.apply.mockImplementation(() => new Promise(() => undefined));
    test.send(await signed()); await vi.waitFor(() => expect(test.apply).toHaveBeenCalledOnce());
    test.send(await signed(body.replace('request-1', 'request-2')));
    await vi.waitFor(() => expect(test.statuses.at(-1)).toMatchObject({ requestId: 'request-2', state: 'waiting' }));
    expect(test.apply).toHaveBeenCalledOnce();
  });

  it('reports lookup failure and retries loading on the next authenticated request', async () => {
    const test = setup(); test.loadLookup.mockRejectedValueOnce(new Error('Reference load failed'));
    test.send(await signed());
    await vi.waitFor(() => expect(test.target.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ state: 'rejected', message: 'Reference load failed' }), CAPTURE_TRACKER_ORIGIN));
    test.send(await signed()); await vi.waitFor(() => expect(test.statuses.at(-1)?.state).toBe('applied'));
    expect(test.loadLookup).toHaveBeenCalledTimes(2);
  });

  it('invalidates pairing while waiting for references or the application lock', async () => {
    const test = setup(); let resolve!: (value: LocalItemReferenceLookup) => void;
    test.loadLookup.mockImplementation(() => new Promise((done) => { resolve = done; }));
    test.send(await signed()); await vi.waitFor(() => expect(resolve).toBeTypeOf('function'));
    test.disconnect(); resolve({} as LocalItemReferenceLookup);
    await vi.waitFor(() => expect(test.statuses.at(-1)?.state).toBe('rejected')); expect(test.apply).not.toHaveBeenCalled();
    const other = setup(); other.send(await signed()); await vi.waitFor(() => expect(other.apply).toHaveBeenCalled());
    const guard = other.apply.mock.calls[0][1].isAuthorized;
    expect(guard()).toBe(true); other.disconnect(); expect(guard()).toBe(false);
  });

  it('does not turn a successful save into a false persistence failure when refresh signaling fails', async () => {
    const test = setup(); test.notify.mockImplementation(() => { throw new Error('Channel closed'); });
    test.send(await signed()); await vi.waitFor(() => expect(test.statuses.at(-1)?.state).toBe('applied'));
    expect(test.target.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ state: 'applied', warnings: [expect.stringContaining('could not refresh')] }), CAPTURE_TRACKER_ORIGIN);
  });

  it('reports a committed save accurately even if acknowledgment publication fails', async () => {
    const test = setup(); vi.mocked(test.target.postMessage).mockImplementation(() => { throw new Error('Window closed'); });
    test.send(await signed());
    await vi.waitFor(() => expect(test.statuses.at(-1)).toMatchObject({ state: 'applied', message: expect.stringContaining('acknowledgment could not be sent') }));
    expect(test.apply).toHaveBeenCalledOnce();
  });

  it('removes its listener on cleanup and ignores its own acknowledgments', async () => {
    const test = setup(); test.send({ channel: CAPTURE_CHANNEL, sender: 'farmrpg-tools-tracker' });
    stops.pop()!(); test.send(await signed());
    expect(test.apply).not.toHaveBeenCalled(); expect(test.target.postMessage).not.toHaveBeenCalled();
  });
});
