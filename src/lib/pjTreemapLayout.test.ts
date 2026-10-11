import { describe, expect, it } from 'vitest';
import { layoutPJTreemap, pjItemColor } from './pjTreemapLayout';

describe('PJ treemap layout', () => {
  it('preserves each contribution area and leaves fixed-scale empty space', () => {
    const tiles = layoutPJTreemap([{ key: 'b', value: 30 }, { key: 'a', value: 10 }], 100);
    expect(tiles.map((tile) => tile.key)).toEqual(['a', 'b']);
    for (const tile of tiles) {
      expect(tile.width * tile.height / 10_000).toBeCloseTo(tile.value / 100);
      expect(tile.x + tile.width).toBeLessThanOrEqual(100.00001);
      expect(tile.y + tile.height).toBeLessThanOrEqual(100.00001);
    }
    expect(tiles.reduce((sum, tile) => sum + tile.width * tile.height, 0)).toBeCloseTo(4_000);
  });

  it('expands an insufficient baseline without clipping and excludes zero/unknown work', () => {
    const entries = [{ key: 'tiny', value: 1 }, { key: 'large', value: 999 }, { key: 'done', value: 0 }];
    const tiles = layoutPJTreemap(entries, 10);
    expect(tiles).toHaveLength(2);
    expect(tiles.reduce((sum, tile) => sum + tile.width * tile.height, 0)).toBeCloseTo(10_000);
    expect(tiles.find((tile) => tile.key === 'tiny')!.width * tiles.find((tile) => tile.key === 'tiny')!.height).toBeCloseTo(10);
    expect(layoutPJTreemap([], 0)).toEqual([]);
    expect(layoutPJTreemap([], 100)).toEqual([]);
    expect(layoutPJTreemap([...entries].reverse(), 10)).toEqual(tiles);
    expect(pjItemColor('tiny')).toBe(pjItemColor('tiny'));
  });
});
