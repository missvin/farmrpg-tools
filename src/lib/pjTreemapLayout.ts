export type PJTreemapTile = {
  key: string;
  value: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

// Ordered binary partition: retain canonical ordering, splitting along the longer
// side. Coordinates are percentages; empty fixed-scale space is a real weight.
export function layoutPJTreemap(
  entries: { key: string; value: number }[],
  baseline: number,
): PJTreemapTile[] {
  const weights = entries.filter((entry) => Number.isFinite(entry.value) && entry.value > 0)
    .sort((left, right) => left.key.localeCompare(right.key));
  const total = weights.reduce((sum, entry) => sum + entry.value, 0);
  const scale = Math.max(total, Number.isFinite(baseline) ? baseline : 0);
  if (scale <= 0) return [];
  const nodes: { key: string | null; value: number }[] = [...weights];
  if (scale > total) nodes.push({ key: null, value: scale - total });
  const tiles: PJTreemapTile[] = [];

  function partition(group: typeof nodes, x: number, y: number, width: number, height: number, sum: number) {
    if (group.length === 1) {
      const node = group[0];
      if (node.key !== null) tiles.push({ ...node, key: node.key, x, y, width, height });
      return;
    }
    let split = 1;
    let firstSum = group[0].value;
    while (split < group.length - 1 && Math.abs(firstSum + group[split].value - sum / 2) < Math.abs(firstSum - sum / 2)) {
      firstSum += group[split].value;
      split += 1;
    }
    const fraction = firstSum / sum;
    if (width >= height) {
      partition(group.slice(0, split), x, y, width * fraction, height, firstSum);
      partition(group.slice(split), x + width * fraction, y, width * (1 - fraction), height, sum - firstSum);
    } else {
      partition(group.slice(0, split), x, y, width, height * fraction, firstSum);
      partition(group.slice(split), x, y + height * fraction, width, height * (1 - fraction), sum - firstSum);
    }
  }
  partition(nodes, 0, 0, 100, 100, scale);
  return tiles;
}

export function pjItemColor(key: string): string {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return `hsl(${((hash % 360) + 360) % 360} 45% 28%)`;
}
