import { applyCapture, type CaptureApplicationResult } from './captureApplication';
import { loadLocalItemReferenceLookup, type LocalItemReferenceLookup } from './localItemReferenceLookup';
import { notifyPlayerDataChanged } from './playerDataNotifications';

export const CAPTURE_TRACKER_ORIGIN = 'https://farmrpg-tools.vercel.app';
export const CAPTURE_PAIRING_KEY = 'farmrpg-tools.capture-pairing.v1';
export const CAPTURE_CHANNEL = 'farmrpg-tools.capture';
export const CAPTURE_SENDER = 'farmrpg-tools-firefox';
export const CAPTURE_REQUIRED_SECTIONS = {
  inventory: ['Everything'],
  mastery: ['10', '1000', '10000', '100000', '1000000', 'INF'],
} as const;
export type CaptureBridgeStatus = {
  state: 'waiting' | 'applying' | 'applied' | 'duplicate' | 'rejected';
  message: string;
  requestId?: string;
};

export function readCapturePairingKey(): string | null {
  const key = localStorage.getItem(CAPTURE_PAIRING_KEY);
  return key && /^[a-f0-9]{64}$/.test(key) ? key : null;
}

export function createCapturePairingKey(): string {
  const key = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join('');
  localStorage.setItem(CAPTURE_PAIRING_KEY, key);
  return key;
}

async function verify(body: string, signature: string, secret: string): Promise<boolean> {
  const bytes = (hex: string) => new Uint8Array(hex.match(/../g)!.map((pair) => Number.parseInt(pair, 16)));
  const key = await crypto.subtle.importKey('raw', bytes(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', key, bytes(signature), new TextEncoder().encode(`1\n${CAPTURE_SENDER}\n${body}`));
}

type BridgeOptions = {
  onStatus: (status: CaptureBridgeStatus) => void;
  readKey?: () => string | null;
  loadLookup?: () => Promise<LocalItemReferenceLookup>;
  apply?: typeof applyCapture;
  notify?: () => void;
};

/** HMAC-authenticated, same top-level window only; never fetches game pages. */
export function startCaptureBridge(target: Window, options: BridgeOptions): () => void {
  if (target.location.origin !== CAPTURE_TRACKER_ORIGIN || target.top !== target) {
    options.onStatus({ state: 'rejected', message: 'Capture is available only on the approved tracker address in a top-level tab.' });
    return () => undefined;
  }
  const readKey = options.readKey ?? readCapturePairingKey;
  let active = true;
  let busy = false;
  let lookup: Promise<LocalItemReferenceLookup> | undefined;
  const status = (value: CaptureBridgeStatus) => { if (active) options.onStatus(value); };
  const reply = (requestId: string, state: CaptureBridgeStatus['state'], message: string, extra = {}) => {
    try {
      target.postMessage({ channel: CAPTURE_CHANNEL, version: 1, sender: 'farmrpg-tools-tracker', type: 'ack', requestId, state, message, ...extra }, CAPTURE_TRACKER_ORIGIN);
    } catch {
      status({ requestId, state: state === 'applied' ? 'applied' : 'rejected', message: state === 'applied'
        ? 'Capture saved locally, but acknowledgment could not be sent. Retry from the companion.'
        : 'Unable to send companion acknowledgment. No application confirmation sent.' });
      return;
    }
    status({ requestId, state, message });
  };
  status({ state: 'waiting', message: 'Pairing enabled. Waiting for a capture from the Firefox companion.' });

  async function receive(event: MessageEvent) {
    if (!active || event.origin !== CAPTURE_TRACKER_ORIGIN || event.source !== target || target.top !== target) return;
    const envelope = event.data;
    if (!envelope || envelope.channel !== CAPTURE_CHANNEL || envelope.sender === 'farmrpg-tools-tracker') return;
    if (envelope.version !== 1 || envelope.sender !== CAPTURE_SENDER || typeof envelope.body !== 'string' ||
      envelope.body.length > 5_000_000 || new TextEncoder().encode(envelope.body).length > 5_000_000 ||
      typeof envelope.signature !== 'string' || !/^[a-f0-9]{64}$/.test(envelope.signature)) {
      status({ state: 'rejected', message: 'Malformed companion message. Previous data retained.' }); return;
    }
    const secret = readKey();
    if (!secret) { status({ state: 'rejected', message: 'Pair the companion before receiving captures.' }); return; }
    let authenticated = false;
    try {
      if (!await verify(envelope.body, envelope.signature, secret)) {
        status({ state: 'rejected', message: 'Companion authentication failed. Previous data retained.' }); return;
      }
      if (!active || secret !== readKey()) return;
      authenticated = true;
      const request = JSON.parse(envelope.body);
      if (!request || typeof request.requestId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(request.requestId)) {
        status({ state: 'rejected', message: 'Invalid capture request. Previous data retained.' }); return;
      }
      if (!request.capture || !['inventory', 'mastery'].includes(request.capture.section)) {
        reply(request.requestId, 'rejected', 'Invalid capture request. Previous data retained.'); return;
      }
      const { requestId, capture } = request;
      if (busy) { reply(requestId, 'waiting', 'Another capture is being saved. Retry this capture after its acknowledgment.'); return; }
      busy = true;
      try {
        reply(requestId, 'waiting', 'Loading local item references. Capture has not been applied.');
        lookup ??= (options.loadLookup ?? loadLocalItemReferenceLookup)().catch((error) => { lookup = undefined; throw error; });
        const references = await lookup;
        if (!active || secret !== readKey()) { reply(requestId, 'rejected', 'Capture pairing was disconnected. Previous data retained.'); return; }
        reply(requestId, 'applying', 'Saving capture locally. Waiting for durable completion.');
        const result: CaptureApplicationResult = await (options.apply ?? applyCapture)(capture, {
          lookup: references,
          requiredSections: CAPTURE_REQUIRED_SECTIONS[capture.section as 'inventory' | 'mastery'],
          isAuthorized: () => active && secret === readKey(),
        });
        if (result.ok) {
          const warnings = [...result.warnings];
          try { (options.notify ?? notifyPlayerDataChanged)(); }
          catch { warnings.push('Saved successfully, but open views could not refresh. Reload the tracker.'); }
          reply(requestId, 'applied', 'Capture saved locally.', { receipt: result.receipt, warnings });
        } else {
          reply(requestId, result.reason.startsWith('Duplicate capture;') ? 'duplicate' : 'rejected', result.reason);
        }
      } finally { busy = false; }
    } catch (error) {
      status({ state: 'rejected', message: error instanceof Error ? error.message : 'Unable to receive capture. Previous data retained.' });
      // Authenticated requests receive failure acknowledgments below; malformed
      // or untrusted messages never get an application receipt.
      try {
        const request = JSON.parse(envelope.body);
        if (authenticated && typeof request?.requestId === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(request.requestId)) {
          reply(request.requestId, 'rejected', error instanceof Error ? error.message : 'Capture failed.');
        }
      } catch { /* Invalid JSON has no trustworthy request identity. */ }
    }
  }
  const listener = (event: MessageEvent) => { void receive(event); };
  target.addEventListener('message', listener);
  return () => { active = false; target.removeEventListener('message', listener); };
}
