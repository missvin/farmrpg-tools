// Scoped text walk adapted from the pinned upstream getVisibleText(root, includeHidden).
(() => {
  "use strict";
  const F = globalThis.FarmCapture;
  const U = globalThis.CaptureUpstream;
  function activePage(doc) {
    const pages = [...doc.querySelectorAll(".page.page-current")].filter(page => !page.closest(".view-inactive, [aria-hidden='true']"));
    if (pages.length !== 1) throw new Error("Cannot identify one active game page. Open the full page and retry.");
    const page = pages[0];
    for (let el = page; el; el = el.parentElement) {
      const style = doc.defaultView.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") throw new Error("The current game page is hidden. Select it and retry.");
    }
    if (page.matches(".page-transitioning, .page-on-left, .page-on-right") || page.querySelector(".preloader, .infinite-scroll-preloader, [aria-busy='true']")) throw new Error("Page is loading or transitioning. Wait and retry.");
    return page;
  }
  function pageText(page) {
    const skip = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "IFRAME", "INPUT", "SELECT", "TEXTAREA", "OPTION", "FORM", "BUTTON"]);
    const chunks = [];
    const walker = page.ownerDocument.createTreeWalker(page, NodeFilter.SHOW_TEXT, {acceptNode(node) {
      for (let el = node.parentElement; el; el = el.parentElement) {
        if (skip.has(el.tagName) || el.classList.contains("tw-badge") || el.matches(".chat, #chat, .navbar, .toolbar")) return NodeFilter.FILTER_REJECT;
        if (el === page) break;
      }
      return node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }});
    let node;
    while ((node = walker.nextNode())) chunks.push(node.nodeValue.trim());
    const text = chunks.join("\n");
    if (text.length > 500000) throw new Error("Page text exceeds the safe read limit.");
    return text;
  }
  function exactCount(raw) {
    if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(raw.trim())) throw new Error("Quantity is missing, rounded or malformed.");
    const parsed = U.parseQty(raw);
    if (!parsed || parsed.approximate || !Number.isSafeInteger(parsed.value) || parsed.value < 0) throw new Error("Quantity is outside the exact supported range.");
    return parsed.value;
  }
  function inventory(page, text) {
    if (!/^Everything$/im.test(text)) throw new Error("Open the full Everything inventory, not a filtered category.");
    const summary = text.match(/inventory contains\s*([\d,]+)\s*unique items and\s*([\d,]+)\s*items in total/i);
    if (!summary) throw new Error("Everything totals are missing; full inventory coverage cannot be proven.");
    const rows = [];
    for (const entry of page.querySelectorAll(".item-content")) {
      if (!entry.querySelector("img.itemimg")) continue;
      const title = entry.querySelector(".item-title strong, strong");
      const quantity = entry.querySelector(".item-after");
      if (!title || !quantity) throw new Error("An inventory row is missing its name or quantity.");
      const copy = title.cloneNode(true);
      copy.querySelectorAll(".tw-badge, i").forEach(badge => badge.remove());
      rows.push({itemName: copy.textContent.trim(), count: exactCount(quantity.textContent), sectionId: "Everything"});
    }
    if (rows.filter(row => row.count > 0).length !== exactCount(summary[1]) || rows.reduce((sum, row) => sum + row.count, 0) !== exactCount(summary[2])) throw new Error("Inventory rows disagree with full-page totals. Nothing was replaced.");
    return {section: "inventory", rows, sections: [{id: "Everything", loaded: true, expectedRows: rows.length}]};
  }
  function mastery(text) {
    const lines = text.split("\n");
    const headings = {"tier i": "10", "tier ii": "1000", "tier iii (m)": "10000", "tier iv (gm)": "100000", "tier v (mm)": "1000000", "mega mastered": "INF"};
    const blocks = new Map();
    let block;
    for (const line of lines) {
      const heading = line.replace(/\s+chevron_\w+$/, "").trim().toLowerCase();
      if (headings[heading]) {
        block = headings[heading];
        if (blocks.has(block)) throw new Error("Duplicate mastery section.");
        blocks.set(block, []);
      } else if (block) blocks.get(block).push(line);
    }
    if (blocks.size !== 6) throw new Error("All six mastery tiers must be loaded, including empty tiers.");
    const parsed = U.parseMasteryPage(lines, text);
    const progressCount = lines.filter(line => /\/.*Progress$/i.test(line)).length;
    if (!parsed.masteries.length || parsed.masteries.length !== progressCount) throw new Error("Some mastery progress rows could not be read exactly.");
    const rows = parsed.masteries.map(row => {
      const targetTier = row.progressTarget === null ? "INF" : exactCount(row.progressTarget);
      return {itemName: row.itemName, count: exactCount(row.masteryCount), targetTier, sectionId: String(targetTier)};
    });
    const sections = [];
    for (const [id, content] of blocks) {
      const expectedRows = content.filter(line => /\/.*Progress$/i.test(line)).length;
      if (expectedRows === 0 && !content.some(line => /^(?:No items|No items in this tier|0 items)[.!]?$/i.test(line))) throw new Error("Empty mastery tier " + id + " has no explicit loaded-empty evidence.");
      if (rows.filter(row => row.sectionId === id).length !== expectedRows) throw new Error("Mastery heading and progress target disagree.");
      sections.push({id, loaded: true, expectedRows});
    }
    // Summary totals are an independent check against missing completed rows.
    for (const [name, threshold] of [["mastered", 10000], ["grandMastered", 100000], ["megaMastered", 1000000]]) {
      if (parsed.stats[name] === null || exactCount(parsed.stats[name]) !== rows.filter(row => row.count >= threshold).length) throw new Error("Mastery rows disagree with the page's summary totals.");
    }
    return {section: "mastery", rows, sections};
  }
  function extract(doc, sourceUrl, observedAt = new Date().toISOString(), captureId = crypto.randomUUID()) {
    if (!F.gameUrl(sourceUrl)) throw new Error("Unsupported game origin.");
    const page = activePage(doc);
    const text = pageText(page);
    const data = /^Mastery(?: In-Progress| Progress)$/im.test(text) ? mastery(text) : inventory(page, text);
    return F.validate({schemaVersion: 1, captureId, scope: "full", section: data.section, sourceUrl: F.cleanUrl(sourceUrl), observedAt, coverage: {activePage: true, settled: true, sections: data.sections}, rows: data.rows});
  }
  async function stableCapture(doc, win, delay = ms => new Promise(resolve => setTimeout(resolve, ms))) {
    if (win.top !== win || doc.visibilityState !== "visible") throw new Error("Capture requires the visible top-level game tab.");
    const page = activePage(doc);
    const before = pageText(page);
    const url = win.location.href;
    let changed = false;
    const observer = new MutationObserver(() => { changed = true; });
    observer.observe(page, {subtree: true, childList: true, characterData: true, attributes: true});
    try {
      await delay(700);
      if (changed || page !== activePage(doc) || win.location.href !== url || doc.visibilityState !== "visible" || before !== pageText(page)) throw new Error("Page changed during capture. Wait until it settles and retry.");
      return extract(doc, url);
    } finally { observer.disconnect(); }
  }
  globalThis.FarmExtractor = {extract, stableCapture, activePage, pageText};
})();
