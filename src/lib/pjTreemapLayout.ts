export type PJTreemapTile = {
  key: string;
  value: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PJTreemapSort = 'pj-desc' | 'pj-asc' | 'name' | 'tower';

export function comparePJContributions(
  left: { key: string; value: number | null; towerLevel?: number },
  right: { key: string; value: number | null; towerLevel?: number },
  sort: PJTreemapSort,
): number {
  if (sort === 'tower') {
    const difference = (left.towerLevel ?? Number.MAX_SAFE_INTEGER) - (right.towerLevel ?? Number.MAX_SAFE_INTEGER);
    if (difference !== 0) return difference;
  } else if (sort !== 'name') {
    if (left.value === null && right.value !== null) return 1;
    if (right.value === null && left.value !== null) return -1;
    const difference = (left.value ?? 0) - (right.value ?? 0);
    if (difference !== 0) return sort === 'pj-desc' ? -difference : difference;
  }
  return left.key.localeCompare(right.key);
}

// Ordered binary partition: retain the selected ordering, splitting along the longer
// side. Coordinates are percentages; empty fixed-scale space is a real weight.
export function layoutPJTreemap(
  entries: { key: string; value: number; towerLevel?: number }[],
  baseline: number,
  sort: PJTreemapSort = 'name',
): PJTreemapTile[] {
  const weights = entries.filter((entry) => Number.isFinite(entry.value) && entry.value > 0)
    .sort((left, right) => comparePJContributions(left, right, sort));
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
