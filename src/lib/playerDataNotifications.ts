import { useSyncExternalStore } from 'react';

const CHANNEL = 'farmrpg-tools.player-data-changed.v1';
let revision = 0;
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;

function changed() {
  revision += 1;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!channel && typeof BroadcastChannel !== 'undefined') {
    try {
      channel = new BroadcastChannel(CHANNEL);
      channel.onmessage = (event: MessageEvent) => {
        if (event.data?.type === 'player-data-changed' && event.data?.version === 1) changed();
      };
    } catch { channel = null; } // A blocked channel must not break normal manual pages.
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) { channel?.close(); channel = null; }
  };
}

/** A refresh hint only. No personal data or application receipt crosses tabs. */
export function notifyPlayerDataChanged() {
  changed();
  if (typeof BroadcastChannel === 'undefined') return;
  const outgoing = channel ?? new BroadcastChannel(CHANNEL);
  try { outgoing.postMessage({ type: 'player-data-changed', version: 1 }); }
  finally { if (outgoing !== channel) outgoing.close(); }
}

export function usePlayerDataRevision() {
  return useSyncExternalStore(subscribe, () => revision, () => 0);
}
