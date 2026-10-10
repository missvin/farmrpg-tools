(() => {
  "use strict";
  const TRACKER = "https://farmrpg-tools.vercel.app";
  const CHANNEL = "farmrpg-tools.capture";
  const SECTIONS = {inventory: ["Everything"], mastery: ["10", "1000", "10000", "100000", "1000000", "INF"]};
  const integer = n => Number.isSafeInteger(n) && n >= 0;
  function gameUrl(raw) {
    try {
      const u = new URL(raw);
      return u.protocol === "https:" && ["farmrpg.com", "www.farmrpg.com"].includes(u.hostname) && !u.port && !u.username && !u.password;
    } catch { return false; }
  }
  function cleanUrl(raw) {
    const u = new URL(raw);
    return u.origin + u.pathname; // No query, fragment, credentials or account identifiers.
  }
  function validate(capture, now = new Date().toISOString()) {
    const fail = message => { throw new Error(message); };
    if (!capture || capture.schemaVersion !== 1 || capture.scope !== "full" || !SECTIONS[capture.section]) fail("Unsupported full capture.");
    if (typeof capture.captureId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(capture.captureId) || !gameUrl(capture.sourceUrl)) fail("Invalid capture identity or game origin.");
    if (!Number.isFinite(Date.parse(capture.observedAt)) || new Date(capture.observedAt).toISOString() !== capture.observedAt || capture.observedAt > now) fail("Invalid observation time.");
    if (new TextEncoder().encode(JSON.stringify(capture)).length > 4_900_000) fail("Capture exceeds the size limit.");
    const coverage = capture.coverage;
    if (!coverage || coverage.activePage !== true || coverage.settled !== true || !Array.isArray(coverage.sections) || !Array.isArray(capture.rows) || !capture.rows.length) fail("Full settled page evidence is missing.");
    const counts = new Map();
    for (const section of coverage.sections) {
      if (!SECTIONS[capture.section].includes(section.id) || section.loaded !== true || !integer(section.expectedRows) || counts.has(section.id)) fail("Invalid section evidence.");
      counts.set(section.id, section.expectedRows);
    }
    if (counts.size !== SECTIONS[capture.section].length) fail("A required section is missing.");
    const seen = new Set();
    for (const row of capture.rows) {
      if (typeof row.itemName !== "string" || !row.itemName.trim() || row.itemName.length > 256 || !integer(row.count) || !counts.has(row.sectionId)) fail("Invalid item or quantity.");
      const key = row.itemName.trim().toLowerCase().replace(/\s+/g, " ");
      if (seen.has(key) || ["__proto__", "constructor", "prototype"].includes(key)) fail("Duplicate or invalid item identity.");
      seen.add(key);
      if (capture.section === "mastery" && (String(row.targetTier) !== row.sectionId || ![10, 1000, 10000, 100000, 1000000, "INF"].includes(row.targetTier))) fail("Invalid mastery target.");
      counts.set(row.sectionId, counts.get(row.sectionId) - 1);
    }
    if ([...counts.values()].some(count => count !== 0)) fail("Section row totals do not match.");
    return capture;
  }
  async function sign(capture, pairingKey, requestId = crypto.randomUUID()) {
    validate(capture);
    if (!/^[a-f0-9]{64}$/.test(pairingKey)) throw new Error("Pair with the tracker first.");
    const body = JSON.stringify({requestId, capture});
    const bytes = Uint8Array.from(pairingKey.match(/../g), hex => parseInt(hex, 16));
    const key = await crypto.subtle.importKey("raw", bytes, {name: "HMAC", hash: "SHA-256"}, false, ["sign"]);
    const result = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("1\nfarmrpg-tools-firefox\n" + body));
    return {channel: CHANNEL, version: 1, sender: "farmrpg-tools-firefox", body, signature: Array.from(new Uint8Array(result), byte => byte.toString(16).padStart(2, "0")).join("")};
  }
  function validAck(value, requestId) {
    return value && value.channel === CHANNEL && value.version === 1 && value.sender === "farmrpg-tools-tracker" && value.type === "ack" && value.requestId === requestId && ["waiting", "applying", "applied", "duplicate", "rejected"].includes(value.state) && typeof value.message === "string" && value.message.length <= 4000;
  }
  globalThis.FarmCapture = {TRACKER, CHANNEL, SECTIONS, gameUrl, cleanUrl, validate, sign, validAck};
})();
