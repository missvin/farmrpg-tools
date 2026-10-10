import { useEffect, useState } from 'react';
import {
  CAPTURE_PAIRING_KEY, CAPTURE_TRACKER_ORIGIN, createCapturePairingKey,
  readCapturePairingKey, startCaptureBridge, type CaptureBridgeStatus,
} from '../lib/captureBridge';

export function CaptureCompanion() {
  const [key, setKey] = useState<string | null>(() => {
    try { return readCapturePairingKey(); } catch { return null; }
  });
  const [status, setStatus] = useState<CaptureBridgeStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!key) return;
    return startCaptureBridge(window, { onStatus: setStatus });
  }, [key]);
  useEffect(() => {
    const update = (event: StorageEvent) => {
      if (event.key === CAPTURE_PAIRING_KEY || event.key === null) {
        try { setKey(readCapturePairingKey()); setStatus(null); }
        catch { setError('Unable to read local companion pairing.'); }
      }
    };
    window.addEventListener('storage', update);
    return () => window.removeEventListener('storage', update);
  }, []);

  const allowed = location.origin === CAPTURE_TRACKER_ORIGIN && window.top === window;
  const supported = allowed && Boolean(crypto.subtle && navigator.locks?.request);
  return (
    <aside aria-label="Firefox capture companion" className="page-card">
      <details>
        <summary>Firefox companion · {key ? status?.state ?? 'waiting' : 'Not paired'}</summary>
        <div className="page-stack page-stack--tight">
          <p>Pair once with the Firefox companion to receive inventory and mastery from pages you visit. Data stays in this browser.</p>
          <p>The Firefox package is not available yet. Pairing controls prepare this tracker for it.</p>
          {!allowed ? <p>Pairing is available at <a href={CAPTURE_TRACKER_ORIGIN}>{CAPTURE_TRACKER_ORIGIN}</a>.</p> : null}
          {allowed && !supported ? <p role="alert">This browser does not support secure capture and cross-tab locking. Manual imports remain available.</p> : null}
          {key ? (
            <>
              <label className="field-label">Companion pairing key
                <input className="text-input" readOnly type="password" value={key} autoComplete="off" />
              </label>
              <div className="button-row">
                <button className="button" type="button" onClick={async () => {
                  try { await navigator.clipboard.writeText(key); setError(null); setStatus({ state: 'waiting', message: 'Key copied. Paste it into your Firefox companion settings.' }); }
                  catch { setError('Unable to copy the pairing key. Select and copy the key field manually.'); }
                }}>Copy pairing key</button>
                <button className="button" type="button" onClick={() => {
                  try { localStorage.removeItem(CAPTURE_PAIRING_KEY); setKey(null); setStatus(null); setError(null); }
                  catch { setError('Unable to disconnect local pairing.'); }
                }}>Disconnect companion</button>
              </div>
              <p>Keep this key private. Disconnecting invalidates it; reconnecting creates a new key.</p>
            </>
          ) : (
            <button className="button" type="button" disabled={!supported} onClick={() => {
              try { setKey(createCapturePairingKey()); setError(null); }
              catch { setError('Unable to save local companion pairing.'); }
            }}>Pair Firefox companion</button>
          )}
        </div>
      </details>
      {key && status ? <p role={status.state === 'rejected' ? 'alert' : 'status'}>{status.message}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
    </aside>
  );
}
