// Explicit reads plus bounded observation of user-visited pages; never navigate or fetch.
(() => {
  "use strict";
  let busy = false;
  let hintBusy = false;
  let dirty = false;
  let timer;
  let retries = 0;
  let observedPage;
  function supportedPage() {
    try {
      if (window.top !== window || document.visibilityState !== "visible") return null;
      const page = globalThis.FarmExtractor.activePage(document);
      if (page.getAttribute("data-page") === "inventory" && location.hash === "#!/inventory.php") return page;
      return /^Mastery(?: In-Progress| Progress)$/im.test(globalThis.FarmExtractor.pageText(page)) ? page : null;
    } catch { return null; }
  }
  function schedule(reset = true) {
    if (reset) retries = 0;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      observedPage = supportedPage();
      if (!observedPage) return;
      if (hintBusy) { dirty = true; return; }
      if (busy) {
        if (retries++ < 2) schedule(false);
        return;
      }
      hintBusy = true;
      try {
        const result = await browser.runtime.sendMessage({type: "observe-page"});
        if ((result?.retry || result?.ok === false) && retries++ < 2) schedule(false);
      } catch { /* Reloaded/unavailable extension: next visit or manual retry can recover. */ }
      finally { hintBusy = false; if (dirty) { dirty = false; schedule(); } }
    }, 400);
  }
  if (window.top === window) {
    const observer = new MutationObserver(records => {
      const page = supportedPage();
      if (page !== observedPage || (page && records.some(record => page.contains(record.target)))) schedule();
    });
    const observation = {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class", "style", "aria-hidden", "aria-busy", "data-page"]};
    observer.observe(document.body, observation);
    window.addEventListener("hashchange", () => schedule());
    window.addEventListener("popstate", () => schedule());
    window.addEventListener("focus", () => schedule());
    document.addEventListener("visibilitychange", () => schedule());
    window.addEventListener("pagehide", () => { clearTimeout(timer); observer.disconnect(); });
    window.addEventListener("pageshow", () => { observer.observe(document.body, observation); schedule(); });
    schedule();
  }
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
