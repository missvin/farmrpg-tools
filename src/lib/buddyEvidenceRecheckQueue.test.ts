import { describe, expect, it } from 'vitest';

import {
  buildBuddyEvidenceRecheckQueue,
  parseBuddyEvidenceManifestCsv,
  toBuddyEvidenceFreshnessCsv,
} from '../../scripts/lib/buddyEvidenceRecheckQueue.mjs';

const manifestCsv = `item_name,canonical_key,buddy_url,page_data_url,cache_file_name,status,http_status,source_status,fetched_at,flags,notes
Ready Item,ready_item,https://buddy.farm/i/ready-item/,https://buddy.farm/page-data/i/ready-item/page-data.json,ready-item__ready-item.json,skip_fresh,200,sources_present,2026-06-01T00:00:00.000Z,,
Blank Item,blank_item,https://buddy.farm/i/blank-item/,https://buddy.farm/page-data/i/blank-item/page-data.json,blank-item__blank-item.json,skip_fresh,200,sources_blank,2026-06-01T00:00:00.000Z,sources_blank,no sources yet
Due Blank,due_blank,https://buddy.farm/i/due-blank/,https://buddy.farm/page-data/i/due-blank/page-data.json,due-blank__due-blank.json,skip_fresh,200,sources_blank,2026-05-01T00:00:00.000Z,sources_blank,no sources yet
Stale Item,stale_item,https://buddy.farm/i/stale-item/,https://buddy.farm/page-data/i/stale-item/page-data.json,stale-item__stale-item.json,skip_fresh,200,sources_present,2026-01-01T00:00:00.000Z,,
Terminal Item,terminal_item,https://buddy.farm/i/terminal-item/,https://buddy.farm/page-data/i/terminal-item/page-data.json,terminal-item__terminal-item.json,skip_terminal,404,uncertain,2026-06-01T00:00:00.000Z,http_404,not found`;

describe('buddyEvidenceRecheckQueue', () => {
  it('classifies ready, blank, due, stale, and terminal evidence rows', () => {
    const result = buildBuddyEvidenceRecheckQueue(parseBuddyEvidenceManifestCsv(manifestCsv), {
      asOf: '2026-06-07T00:00:00.000Z',
      blankRecheckDays: 28,
      terminalRecheckDays: 7,
      staleAfterDays: 90,
    });

    expect(result.summary.countsByState).toEqual({
      ready_for_parse: 1,
      sources_blank: 2,
      needs_recheck: 1,
      stale: 1,
    });
    expect(result.summary.queueRowCount).toBe(4);

    const byKey = Object.fromEntries(result.freshnessRows.map((row) => [row.canonical_key, row]));
    expect(byKey.ready_item.recheck_state).toBe('ready_for_parse');
    expect(byKey.blank_item.recheck_state).toBe('sources_blank');
    expect(byKey.blank_item.suggested_recheck_date).toBe('2026-06-29');
    expect(byKey.due_blank.recheck_state).toBe('needs_recheck');
    expect(byKey.stale_item.recheck_state).toBe('stale');
    expect(byKey.terminal_item.recheck_state).toBe('sources_blank');
    expect(byKey.terminal_item.suggested_recheck_date).toBe('2026-06-08');
  });

  it('marks terminal rows as due once their shorter recheck window has passed', () => {
    const result = buildBuddyEvidenceRecheckQueue(parseBuddyEvidenceManifestCsv(manifestCsv), {
      asOf: '2026-06-09T00:00:00.000Z',
      blankRecheckDays: 28,
      terminalRecheckDays: 7,
      staleAfterDays: 90,
    });

    const terminalItem = result.freshnessRows.find((row) => row.canonical_key === 'terminal_item');
    expect(terminalItem?.recheck_state).toBe('needs_recheck');
  });

  it('exports CSV-safe queue rows', () => {
    const result = buildBuddyEvidenceRecheckQueue(parseBuddyEvidenceManifestCsv(manifestCsv), {
      asOf: '2026-06-07T00:00:00.000Z',
    });

    const csv = toBuddyEvidenceFreshnessCsv(result.queueRows);
    expect(csv).toContain('item_name,canonical_key,buddy_url');
    expect(csv).toContain('Blank Item');
    expect(csv).not.toContain('Ready Item,ready_item');
  });
});
