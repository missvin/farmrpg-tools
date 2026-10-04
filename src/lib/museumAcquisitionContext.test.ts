import { describe, expect, it, vi } from 'vitest';
import { deriveMuseumAcquisitionSources, loadMuseumAcquisitionReferences, type MuseumAcquisitionReferences } from './museumAcquisitionContext';

vi.mock('./loadDropRateReference', () => ({ loadDropRateReference: async () => ({ byTargetCanonicalKey: { salt: [{ sourceType: 'Explore', sourceName: 'Beach' }] } }) }));
vi.mock('./loadPetSourceReference', () => ({ loadPetSourceReference: async () => { throw new Error('Unavailable'); } }));
vi.mock('./loadOpenableContentsReference', () => ({ loadOpenableContentsReference: async () => ({ byContentCanonicalKey: {} }) }));
vi.mock('./loadQuestReference', () => ({ loadQuestReference: async () => ({ sourceHintsByCanonicalKey: {} }) }));
vi.mock('./loadRecipeGraph', () => ({ loadRecipeGraph: async () => ({ byOutputCanonicalKey: {} }) }));

const references: MuseumAcquisitionReferences = {
  drops: { salt: [{ sourceName: 'Beach', sourceType: 'Explore' }] },
  pets: { salt: [{ petName: 'Rock', unlockLevel: 6, petAvailability: 'seasonal' }] },
  openables: { salt: [{ openableItemName: 'Grab Bag', quantityKind: 'expected' }] },
  recipes: { salt: { recipeType: 'craft' }, stew: { recipeType: 'cooking' } },
  hints: { salt: [{ sourceName: 'Beach', sourceType: 'explore' }] },
  incomplete: false,
};

describe('Museum acquisition context', () => {
  it('combines existing sources, deduplicates hints, and preserves seasonal and random limits', () => {
    expect(deriveMuseumAcquisitionSources('salt', references)).toEqual([
      'Crafting', 'Explore: Beach', 'Pet: Rock (level 6, seasonal)', 'Open: Grab Bag (random contents)',
    ]);
    expect(deriveMuseumAcquisitionSources('stew', references)).toEqual(['Cooking']);
    expect(deriveMuseumAcquisitionSources('unknown', references)).toEqual([]);
  });

  it('retains successful reference sources when another loader fails', async () => {
    const loaded = await loadMuseumAcquisitionReferences();
    expect(loaded.incomplete).toBe(true);
    expect(deriveMuseumAcquisitionSources('salt', loaded)).toEqual(['Explore: Beach']);
  });
});
