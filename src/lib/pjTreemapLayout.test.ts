import { describe, expect, it } from 'vitest';
import { comparePJContributions, layoutPJTreemap, pjItemColor } from './pjTreemapLayout';

describe('PJ treemap layout', () => {
  it('orders by Tower level with name tie-breaks rather than PJ or name alone', () => {
    const entries = [
      { key: 'a', value: 30, towerLevel: 350 },
      { key: 'c', value: 10, towerLevel: 340 },
      { key: 'b', value: 20, towerLevel: 340 },
    ];
    const tiles = layoutPJTreemap(entries, 100, 'tower');
    expect(tiles.map((tile) => tile.key)).toEqual(['b', 'c', 'a']);
    for (const tile of tiles) expect(tile.width * tile.height / 10_000).toBeCloseTo(tile.value / 100);
  });

  it('sorts numeric contributions with name tie-breaks while preserving area', () => {
    const entries = [{ key: 'b', value: 10 }, { key: 'c', value: 30 }, { key: 'a', value: 10 }];
    for (const sort of ['pj-desc', 'pj-asc', 'name'] as const) {
      const tiles = layoutPJTreemap(entries, 100, sort);
      expect(tiles.map((tile) => tile.key)).toEqual(sort === 'pj-desc' ? ['c', 'a', 'b'] : ['a', 'b', 'c']);
      expect(layoutPJTreemap([...entries].reverse(), 100, sort)).toEqual(tiles);
      for (const tile of tiles) expect(tile.width * tile.height / 10_000).toBeCloseTo(tile.value / 100);
      const withUnknown = [...entries, { key: 'unknown', value: null }, { key: 'done', value: 0 }];
      withUnknown.sort((a, b) => comparePJContributions(a, b, sort));
      if (sort !== 'name') expect(withUnknown.at(-1)?.key).toBe('unknown');
    }
  });

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
