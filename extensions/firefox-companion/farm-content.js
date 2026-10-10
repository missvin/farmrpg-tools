// Manual busy guard and watchdog adapted from upstream farm-content.js.
(() => {
  "use strict";
  let busy = false;
  browser.runtime.onMessage.addListener((message, sender) => {
    if (sender.id !== browser.runtime.id || sender.url !== browser.runtime.getURL("_generated_background_page.html") || message?.type !== "capture-active-page" || window.top !== window) return;
    if (busy) return Promise.resolve({ok: false, error: "A page capture is already running."});
    busy = true;
    return globalThis.FarmExtractor.stableCapture(document, window)
      .then(capture => ({ok: true, capture}))
      .catch(error => ({ok: false, error: error instanceof Error ? error.message : "Current page could not be captured completely. Nothing replaced."}))
      .finally(() => { busy = false; });
  });
})();
