import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  parseItemAliasesCsv,
  resolveItemAlias,
  toItemAliasReviewCsv,
  validateItemAliasesAgainstCatalog,
} from './itemAliases';
import { parseItemCatalogCsv } from './loadItemCatalog';

const HEADER = 'alias_name,alias_key,canonical_item_name,canonical_key,review_status,source,notes';

describe('item aliases', () => {
  it('parses reviewed alias rows and resolves approved aliases only', () => {
    const aliases = parseItemAliasesCsv(`${HEADER}
Pot of Gold (Large),pot of gold (large),Pot of Gold Large,pot of gold large,approved,museum_workflow,Reviewed punctuation alias
Farmers Hat,farmers hat,Farmer's Hat,farmer's hat,needs_review,museum_workflow,Apostrophe candidate`);

    expect(aliases.entries).toHaveLength(2);
    expect(resolveItemAlias('Pot of Gold (Large)', aliases)).toMatchObject({
      inputKey: 'pot of gold (large)',
      canonicalKey: 'pot of gold large',
      status: 'alias',
    });
    expect(resolveItemAlias('Farmers Hat', aliases)).toMatchObject({
      inputKey: 'farmers hat',
      canonicalKey: 'farmers hat',
      status: 'direct',
    });
  });

  it('rejects invalid schemas and unsafe alias rows', () => {
    expect(() =>
      parseItemAliasesCsv(`alias_name,alias_key
Alias,alias`),
    ).toThrow('Invalid item alias schema');

    expect(() =>
      parseItemAliasesCsv(`${HEADER}
Alias,wrong,Target,target,approved,test,`),
    ).toThrow('Alias key mismatch for item alias row "Alias"');

    expect(() =>
      parseItemAliasesCsv(`${HEADER}
Alias,alias,Alias,alias,approved,test,`),
    ).toThrow('maps an item to itself');

    expect(() =>
      parseItemAliasesCsv(`${HEADER}
Alias,alias,Target,target,maybe,test,`),
    ).toThrow('Invalid review_status "maybe"');
  });

  it('flags aliases that do not cleanly sit on top of the item catalog', () => {
    const aliases = parseItemAliasesCsv(`${HEADER}
Pot of Gold (Large),pot of gold (large),Pot of Gold Large,pot of gold large,approved,museum_workflow,
Board Variant,board variant,Missing Target,missing target,approved,test,`);
    const catalog = parseItemCatalogCsv(
      `item_name,canonical_key,mastery_possible,farmrpg_item_id,buddy_slug,source_datasets,notes
Pot of Gold Large,pot of gold large,unknown,,,museum_lookup_coverage,
Board Variant,board variant,unknown,,,museum_lookup_coverage,`,
    );

    expect(validateItemAliasesAgainstCatalog(aliases, catalog)).toEqual([
      expect.objectContaining({
        aliasKey: 'board variant',
        code: 'canonical_not_in_catalog',
      }),
      expect.objectContaining({
        aliasKey: 'board variant',
        code: 'alias_conflicts_with_catalog',
      }),
    ]);
  });

  it('exports review candidates without silently approving mappings', () => {
    const aliases = parseItemAliasesCsv(`${HEADER}
Pot of Gold (Large),pot of gold (large),Pot of Gold Large,pot of gold large,approved,museum_workflow,`);
    const csv = toItemAliasReviewCsv(
      [
        {
          observedItemName: 'Pot of Gold (Large)',
          suggestedCanonicalItemName: 'Pot of Gold Large',
          source: 'museum_unresolved_triage',
          reason: 'Likely punctuation-only name drift',
        },
        {
          observedItemName: 'Farmers Hat',
          suggestedCanonicalItemName: "Farmer's Hat",
          source: 'museum_unresolved_triage',
          reason: 'Likely punctuation drift',
          notes: 'Review before adding to data/item_aliases.csv',
        },
      ],
      aliases,
    );

    expect(csv).toContain('observed_alias_key');
    expect(csv).toContain('approved');
    expect(csv).toContain('needs_review');
    expect(csv).toContain("Farmers Hat,farmers hat,Farmer's Hat,farmer's hat");
  });

  it('parses the checked-in local item aliases file', () => {
    const aliases = parseItemAliasesCsv(readFileSync(join(process.cwd(), 'data', 'item_aliases.csv'), 'utf8'));

    expect(aliases.entries).toEqual([
      expect.objectContaining({
        aliasName: 'Baba Bobble',
        aliasKey: 'baba bobble',
        canonicalItemName: 'Baba Bobblehead',
        canonicalKey: 'baba bobblehead',
        reviewStatus: 'approved',
      }),
    ]);
    expect(aliases.approvedByAliasKey['baba bobble']).toMatchObject({
      canonicalItemName: 'Baba Bobblehead',
    });
  });
});
