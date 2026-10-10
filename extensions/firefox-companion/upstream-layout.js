// Adapted from alikdash1 Farm RPG Calculator Account Sync 1.13.1.
// Pinned artifact, permission basis and modifications: ATTRIBUTION.md.
(() => {
  "use strict";
  const SUFFIX_EXP = { K: 3, M: 6, B: 9, T: 12 };
  const MAX_SAFE_BIG = BigInt(Number.MAX_SAFE_INTEGER);
  const NAME_RE = /^(?=.*\p{L})[\p{L}\p{N}][\p{L}\p{N} .'’&+\-()]{1,50}$/u;
  const NOISE_LINES = new Set([
    "heart_fill", "heart", "chevron_down", "chevron_up", "chevron_left", "chevron_right",
    "star", "star_border", "star_fill", "star_half", "lock", "lock_open", "search",
    "in craftworks", "favorite items", "craftable items", "sort options:", "item name",
    "quantity (asc)", "quantity (desc)", "adjust order", "buy more materials",
    "view / edit craftable items", "go to craftworks", "back", ",",
    "fish & bait", "crops", "seeds", "loot & treasure", "runestones", "books",
    "cards", "super rares", "inventory stats", "unique items and", "mastery progress",
  ]);

  // Material icons print their own names in lower case ("star", "heart").
  // "Star" with a capital is the item, so an icon name only counts as noise
  // when it is written exactly as the icon.
  const ICON_WORDS = new Set(["heart_fill", "heart", "star", "star_border", "star_fill", "star_half", "lock", "lock_open", "search", "back"]);

  function parseQty(input) {
    if (input === null || input === undefined) return null;
    const raw = String(input).trim();
    if (!raw) return null;
    const m = raw.match(/^(-?)\s*\$?\s*([\d,]+(?:\.\d+)?)\s*([KMBT])?$/i);
    if (!m) return null;
    const neg = m[1] === "-";
    const mantissa = m[2].replace(/,/g, "");
    const exp = m[3] ? SUFFIX_EXP[m[3].toUpperCase()] : 0;
    const dot = mantissa.indexOf(".");
    const intDigits = dot === -1 ? mantissa : mantissa.slice(0, dot);
    const fracDigits = dot === -1 ? "" : mantissa.slice(dot + 1);
    let num;
    try { num = BigInt((intDigits || "0") + fracDigits); } catch (err) { return null; }
    const den = 10n ** BigInt(fracDigits.length);
    const mult = 10n ** BigInt(exp);
    const scaled = num * mult;
    let valueBig;
    let approximate = false;
    if (scaled % den === 0n) {
      valueBig = scaled / den;
    } else {
      const f = (Number(mantissa) || 0) * Math.pow(10, exp);
      if (!Number.isFinite(f)) return null;
      if (Math.abs(f) <= Number.MAX_SAFE_INTEGER) return { raw, value: neg ? -f : f, approximate: true };
      valueBig = BigInt(Math.round(f));
      approximate = true;
    }
    if (neg) valueBig = -valueBig;
    const abs = valueBig < 0n ? -valueBig : valueBig;
    return abs <= MAX_SAFE_BIG
      ? { raw, value: Number(valueBig), approximate }
      : { raw, value: valueBig.toString(), approximate };
  }
  function isNoise(line) {
    const text = line.trim();
    if (ICON_WORDS.has(text.toLowerCase())) return text === text.toLowerCase();
    return NOISE_LINES.has(text.toLowerCase());
  }

  function parseMasteryPage(lines, text) {
    const clean = lines.map((line) => line.trim()).filter(Boolean);
    const out = { stats: { mastered: null, grandMastered: null, megaMastered: null }, masteries: [] };
    const summary = text.match(/So far, you have\s*([\d,]+)\s*items Mastered,\s*([\d,]+)\s*items Grand Mastered and\s*([\d,]+)\s*items Mega Mastered/i);
    if (summary) {
      out.stats.mastered = summary[1];
      out.stats.grandMastered = summary[2];
      out.stats.megaMastered = summary[3];
    }
    const start = clean.findIndex((line) => /^Mastery(?: In-Progress| Progress)$/i.test(line));
    if (start < 0) return out;
    let tier = null;
    const seen = new Set();
    for (let i = start + 1; i < clean.length; i++) {
      const heading = clean[i].match(/^(Tier V \(MM\)|Tier IV \(GM\)|Tier III \(M\)|Tier II|Tier I|No Tier|Mega Mastered)(?:\s+chevron_\w+)?$/i);
      if (heading) { tier = heading[1]; continue; }
      const progress = clean[i].match(/^([\d,.]+\s*[KMBT]?)\s*\/\s*([\d,.]+\s*[KMBT]?|∞)\s*Progress$/i);
      if (!progress || i === 0) continue;
      let nameIndex = i - 1;
      while (nameIndex > start && (/^chevron_/i.test(clean[nameIndex]) || /^\d+(?:\.\d+)?%$/.test(clean[nameIndex]))) nameIndex--;
      const name = clean[nameIndex].trim();
      if (!NAME_RE.test(name) || isNoise(name) || seen.has(name.toLowerCase())) continue;
      const currentParsed = parseQty(progress[1]);
      const targetParsed = progress[2] === "∞" ? null : parseQty(progress[2]);
      const currentNumber = currentParsed ? Number(currentParsed.value) : NaN;
      const targetNumber = targetParsed ? Number(targetParsed.value) : null;
      if (!Number.isFinite(currentNumber) || (targetNumber !== null && !Number.isFinite(targetNumber))) continue;
      const mega = progress[2] === "∞" || currentNumber >= 1000000;
      const grand = mega || currentNumber >= 100000;
      const mastered = grand || currentNumber >= 10000;
      seen.add(name.toLowerCase());
      out.masteries.push({
        itemName: name, masteryCount: progress[1], masteryLevel: tier,
        mastered, grandMastery: grand, megaMastery: mega, completed: mega,
        progressCurrent: progress[1], progressTarget: targetNumber === null ? null : progress[2],
        progressPercent: targetNumber ? (currentNumber / targetNumber) * 100 : null,
        confidence: "visible-label",
      });
    }
    return out;
  }
  globalThis.CaptureUpstream = { parseQty, parseMasteryPage };
})();
