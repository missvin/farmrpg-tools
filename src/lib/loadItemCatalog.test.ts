import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseItemCatalogCsv } from './loadItemCatalog';

const HEADER = 'item_name,canonical_key,mastery_possible,farmrpg_item_id,buddy_slug,source_datasets,notes';

describe('parseItemCatalogCsv', () => {
  it('parses catalog rows with canonical keys, metadata, and source datasets', () => {
    const result = parseItemCatalogCsv(`${HEADER}
Glass Orb,glass orb,yes,123,glass-orb,mastery_difficulty;tower_requirements,"Known mastery item"
Acorn,acorn,unknown,,,recipe_inputs,Recipe-only recognition`);

    expect(result.entries).toHaveLength(2);
    expect(result.byCanonicalKey['glass orb']).toMatchObject({
      itemName: 'Glass Orb',
      canonicalKey: 'glass orb',
      masteryPossible: 'yes',
      farmrpgItemId: '123',
      buddySlug: 'glass-orb',
      sourceDatasets: ['mastery_difficulty', 'tower_requirements'],
      notes: 'Known mastery item',
    });
    expect(result.byCanonicalKey.acorn).toMatchObject({
      masteryPossible: 'unknown',
      farmrpgItemId: null,
      buddySlug: null,
      sourceDatasets: ['recipe_inputs'],
    });
  });

  it('rejects invalid headers', () => {
    expect(() =>
      parseItemCatalogCsv(`item_name,canonical_key,mastery_possible
Glass Orb,glass orb,yes`),
    ).toThrow('Invalid item catalog schema');
  });

  it('rejects canonical key mismatches', () => {
    expect(() =>
      parseItemCatalogCsv(`${HEADER}
Glass Orb,wrong key,yes,,,mastery_difficulty,`),
    ).toThrow('Canonical key mismatch for item catalog row "Glass Orb"');
  });

  it('rejects invalid mastery_possible values', () => {
    expect(() =>
      parseItemCatalogCsv(`${HEADER}
Glass Orb,glass orb,sometimes,,,mastery_difficulty,`),
    ).toThrow('Invalid mastery_possible "sometimes"');
  });

  it('rejects duplicate canonical keys', () => {
    expect(() =>
      parseItemCatalogCsv(`${HEADER}
Glass Orb,glass orb,yes,,,mastery_difficulty,
Glass Orb,glass orb,yes,,,tower_requirements,`),
    ).toThrow('Duplicate item catalog row for canonical key "glass orb".');
  });

  it('requires at least one source dataset', () => {
    expect(() =>
      parseItemCatalogCsv(`${HEADER}
Glass Orb,glass orb,yes,,,,,`),
    ).toThrow('Missing required source_datasets for item catalog row "Glass Orb".');
  });

  it('parses the checked-in local item catalog', () => {
    const result = parseItemCatalogCsv(readFileSync(join(process.cwd(), 'data', 'item_catalog.csv'), 'utf8'));

    expect(result.entries.length).toBeGreaterThan(0);
    expect(result.byCanonicalKey['acorn butter']).toMatchObject({
      itemName: 'Acorn Butter',
      masteryPossible: 'yes',
    });
    expect(result.byCanonicalKey.acorn).toMatchObject({
      itemName: 'Acorn',
      masteryPossible: 'unknown',
      sourceDatasets: ['recipe_inputs.input'],
    });
  });
});
