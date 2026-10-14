// Event-page listeners register at load. Persistent state uses extension-local storage.
(() => {
  "use strict";
  const F = globalThis.FarmCapture;
  const STORE = "companion-v1";
  let tail = Promise.resolve();
  let passiveBusy = false;
  let passiveQueued;
  let pauseRequested = false;
  const serial = action => {
    const next = tail.then(action, action);
    tail = next.catch(() => {});
    return next;
  };
  const load = async () => (await browser.storage.local.get(STORE))[STORE] || {captures: {}, status: {state: "idle", message: "Pair with your tracker, then capture a full game page."}};
  const save = state => browser.storage.local.set({[STORE]: state});
  const timeout = async promise => {
    let timer;
    try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Browser transfer timed out; application is not confirmed. Retry saved capture.")), 25000); })]); }
    finally { clearTimeout(timer); }
  };
  function safeStatus(state) {
    return {paired: /^[a-f0-9]{64}$/.test(state.pairingKey || ""), paused: state.paused === true, status: state.status, lastAppliedAt: state.lastAppliedAt || null, captures: Object.entries(state.captures).map(([section, capture]) => ({section, observedAt: capture.observedAt, rows: capture.rows.length}))};
  }
  async function deliver(state, capture) {
    F.validate(capture);
    if (!state.pairingKey) throw new Error("Pair with the tracker before sending this saved capture.");
    const trackers = (await browser.tabs.query({url: F.TRACKER + "/*"})).filter(tab => {
      try { return new URL(tab.url).origin === F.TRACKER; } catch { return false; }
    });
    if (trackers.length !== 1) {
      state.status = {state: "waiting", message: trackers.length ? "Keep one tracker tab open, then retry saved capture." : "Captured locally. Open the paired tracker, then retry saved capture."};
      await save(state);
      return safeStatus(state);
    }
    state.status = {state: "waiting", message: "Captured locally. Waiting for durable tracker application."};
    await save(state);
    const envelope = await F.sign(capture, state.pairingKey);
    const result = await timeout(browser.tabs.sendMessage(trackers[0].id, {type: "deliver-capture", envelope}, {frameId: 0}));
    if (!result || !["applied", "duplicate", "rejected", "waiting"].includes(result.state) || typeof result.message !== "string") throw new Error("Tracker returned an invalid acknowledgment.");
    const fresh = await load();
    if (fresh.pairingKey !== state.pairingKey) throw new Error("Pairing changed during transfer; application is not confirmed.");
    state.status = {state: result.state, message: result.message.slice(0, 4000), warnings: result.warnings || []};
    if (result.state === "applied") {
      if (!result.receipt || result.receipt.captureId !== capture.captureId || result.receipt.section !== capture.section || result.receipt.observedAt !== capture.observedAt) throw new Error("Tracker receipt did not match the saved capture.");
      state.lastAppliedAt = new Date().toISOString();
    }
    await save(state);
    return safeStatus(state);
  }
  function contentKey(capture) {
    return JSON.stringify(capture.rows.map(row => [row.itemName.trim().toLowerCase().replace(/\s+/g, " "), row.count, row.targetTier ?? null, row.sectionId]).sort((a, b) => a[0].localeCompare(b[0])));
  }
  async function command(message, passiveTabId) {
    const state = await load();
    if (message.type === "status") return safeStatus(state);
    if (message.type === "set-paused") {
      if (typeof message.paused !== "boolean") throw new Error("Invalid pause setting.");
      state.paused = message.paused;
      state.status = {state: "idle", message: state.paused ? "Automatic capture paused. Manual Capture and Retry remain available." : "Automatic capture enabled. Visit My Inventory or Mastery to capture."};
      await save(state);
      return safeStatus(state);
    }
    if (message.type === "pair") {
      if (typeof message.key !== "string" || !/^[a-f0-9]{64}$/.test(message.key)) throw new Error("Paste the 64-character key from your tracker's Firefox companion control.");
      state.pairingKey = message.key;
      state.status = {state: "idle", message: "Pairing key saved locally. Visit My Inventory or Mastery for automatic capture."};
      await save(state);
      return safeStatus(state);
    }
    if (message.type === "disconnect") {
      delete state.pairingKey;
      state.status = {state: "idle", message: "Disconnected. Saved captures remain local; no automatic transfer."};
      await save(state);
      return safeStatus(state);
    }
    if (message.type === "retry") {
      if (!F.SECTIONS[message.section] || !state.captures[message.section]) throw new Error("No saved capture for that section.");
      return deliver(state, state.captures[message.section]);
    }
    if (message.type !== "capture") throw new Error("Unsupported companion command.");
    const automatic = passiveTabId !== undefined;
    if (automatic && (!state.pairingKey || state.paused || pauseRequested)) return {disabled: true, ...safeStatus(state)};
    if (!state.pairingKey) throw new Error("Pair with your tracker before capturing.");
    const tabs = await browser.tabs.query({active: true, currentWindow: true});
    const tab = tabs[0];
    if (automatic && tab?.id !== passiveTabId) return {disabled: true, ...safeStatus(state)};
    if (!tab || !F.gameUrl(tab.url)) throw new Error("Select your FarmRPG game tab, open My Inventory or full Mastery, and try again.");
    if (!automatic) {
      state.status = {state: "reading", message: "Reading the active game page. Nothing applied yet."};
      await save(state);
    }
    const result = await timeout(browser.tabs.sendMessage(tab.id, {type: "capture-active-page"}, {frameId: 0}));
    if (!result?.ok) throw new Error(result?.error || "Game page reader unavailable. Reload the game tab and retry.");
    const capture = F.validate(result.capture);
    const current = await browser.tabs.get(tab.id);
    if (current.url !== tab.url || capture.sourceUrl !== F.cleanUrl(tab.url)) throw new Error("Game page changed before capture completed. Retry on the settled page.");
    if (automatic) {
      const selected = (await browser.tabs.query({active: true, currentWindow: true}))[0];
      if (pauseRequested || !current.active || selected?.id !== tab.id) return {disabled: true, ...safeStatus(state)};
    }
    const previous = state.captures[capture.section];
    if (automatic && previous && contentKey(previous) === contentKey(capture)) return {unchanged: true, ...safeStatus(await load())};
    if (previous && capture.observedAt <= previous.observedAt) throw new Error("Older or simultaneous observation; last good capture retained.");
    state.captures[capture.section] = capture; // Full proven scope: no shrinkage/row-count heuristic.
    state.lastCapturedAt = capture.observedAt;
    state.status = {state: "captured", message: "Validated capture saved locally. Not yet applied to the tracker."};
    await save(state);
    return deliver(state, capture);
  }
  function run(message, passiveTabId) {
    return serial(async () => {
      try { return {ok: true, ...await command(message, passiveTabId)}; }
      catch (error) {
        // Known extractor errors contain no raw page text. Do not log payloads or keys.
        const reason = error instanceof Error ? error.message : "Capture failed. Previous good data retained.";
        try {
          const state = await load();
          state.status = {state: "rejected", message: reason.slice(0, 4000)};
          await save(state);
          return {ok: false, ...safeStatus(state)};
        } catch { return {ok: false, paired: false, captures: [], status: {state: "rejected", message: "Extension storage failed. Application is not confirmed; previous tracker data is retained unless a prior save was already acknowledged."}}; }
      }
    });
  }
  browser.runtime.onMessage.addListener((message, sender) => {
    if (sender.id !== browser.runtime.id || !message || typeof message.type !== "string") return;
    if (message.type === "observe-page") {
      if (sender.frameId !== 0 || !sender.tab || !Number.isInteger(sender.tab.id) || !F.gameUrl(sender.url) || !F.gameUrl(sender.tab.url) || F.cleanUrl(sender.url) !== F.cleanUrl(sender.tab.url)) return;
      if (passiveBusy) {
        passiveQueued = sender.tab.id;
        return Promise.resolve({ok: true, retry: true});
      }
      passiveBusy = true;
      return run({type: "capture"}, sender.tab.id).finally(async () => {
        try {
          while (passiveQueued !== undefined) {
            const tabId = passiveQueued;
            passiveQueued = undefined;
            await run({type: "capture"}, tabId);
          }
        } finally { passiveBusy = false; }
      });
    }
    if (sender.url !== browser.runtime.getURL("popup.html") || (sender.frameId !== undefined && sender.frameId !== 0)) return;
    if (message.type === "set-paused" && typeof message.paused === "boolean") pauseRequested = message.paused;
    if (message.type === "disconnect") pauseRequested = true;
    if (message.type === "pair") pauseRequested = false;
    return run(message);
  });
})();
