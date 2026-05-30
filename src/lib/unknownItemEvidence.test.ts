import { beforeEach, describe, expect, it } from 'vitest';

import {
  addUnknownItemEvidenceRecords,
  clearUnknownItemEvidenceState,
  createDefaultUnknownItemEvidenceState,
  createFirstUnknownInventoryBatchEvidence,
  createUnknownItemEvidenceFromWarnings,
  createUnknownItemEvidenceRecord,
  groupUnknownItemEvidence,
  loadUnknownItemEvidenceState,
  recordUnknownItemEvidence,
  setUnknownItemReviewDecision,
  toUnknownItemIconCandidateCsv,
  toUnknownItemPromotionReviewCsv,
  UNKNOWN_ITEM_EVIDENCE_STORAGE_KEY,
} from './unknownItemEvidence';

describe('unknownItemEvidence', () => {
  beforeEach(() => {
    clearUnknownItemEvidenceState();
  });

  it('collects and dedupes unknown item warning evidence by normalized item and source context', () => {
    const records = createUnknownItemEvidenceFromWarnings(
      [
        'Line 12 item "Planet Egg" was not found in local reference data and was kept as entered.',
        'Line 12: No local item reference coverage found; keep this visible as a review candidate.',
      ],
      {
        sourceType: 'current_inventory_import',
        sourceLabel: 'Current inventory import',
      },
      '2026-05-30T12:00:00.000Z',
    );

    const state = addUnknownItemEvidenceRecords(createDefaultUnknownItemEvidenceState(), records);
    const nextState = addUnknownItemEvidenceRecords(state, records);
    const groups = groupUnknownItemEvidence(nextState);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      displayName: 'Planet Egg',
      normalizedKey: 'planet egg',
      totalOccurrences: 2,
      reviewState: 'new',
      targetDestination: 'needs_more_evidence',
    });
  });

  it('persists review decisions and exports guardrailed promotion rows without mastery difficulty output', () => {
    const record = createUnknownItemEvidenceRecord({
      sourceType: 'locksmith_import',
      sourceLabel: 'Locksmith import',
      observedName: 'Day Off Voucher',
      sampleContext: 'Line 9 item "Day Off Voucher" was not found in local reference data and was kept as entered.',
      warningText: 'No local item reference coverage found; keep this visible as a review candidate.',
      observedAt: '2026-05-30T12:00:00.000Z',
    });
    expect(record).not.toBeNull();

    const state = setUnknownItemReviewDecision(
      addUnknownItemEvidenceRecords(createDefaultUnknownItemEvidenceState(), record ? [record] : []),
      {
        normalizedKey: 'day off voucher',
        displayName: 'Day Off Voucher',
        reviewState: 'reviewed',
        targetDestination: 'item_catalog',
        notes: 'Likely real item; needs catalog review.',
        updatedAt: '2026-05-30T12:01:00.000Z',
      },
    );
    const csv = toUnknownItemPromotionReviewCsv(groupUnknownItemEvidence(state));

    expect(csv).toContain('Day Off Voucher');
    expect(csv).toContain('item_catalog');
    expect(csv).toContain('unknown');
    expect(csv).not.toContain('mastery_difficulty');
  });

  it('exports only reviewed Buddy icon candidates with unverified slug status', () => {
    const state = setUnknownItemReviewDecision(
      addUnknownItemEvidenceRecords(createDefaultUnknownItemEvidenceState(), [
        createUnknownItemEvidenceRecord({
          sourceType: 'current_inventory_import',
          sourceLabel: 'First unknown inventory review batch',
          observedName: "Thomas's Red Velvet Cake",
          observedAt: '2026-05-30T12:00:00.000Z',
        })!,
      ]),
      {
        normalizedKey: "thomas's red velvet cake",
        displayName: "Thomas's Red Velvet Cake",
        reviewState: 'reviewed',
        targetDestination: 'buddy_icon_candidates',
        updatedAt: '2026-05-30T12:01:00.000Z',
      },
    );

    expect(toUnknownItemIconCandidateCsv(groupUnknownItemEvidence(state))).toContain(
      'candidate_name_slug_unverified',
    );
    expect(toUnknownItemIconCandidateCsv(groupUnknownItemEvidence(state))).toContain(
      'https://buddy.farm/i/thomas-s-red-velvet-cake/',
    );
  });

  it('seeds the first unknown batch as local evidence only', () => {
    const state = addUnknownItemEvidenceRecords(
      createDefaultUnknownItemEvidenceState(),
      createFirstUnknownInventoryBatchEvidence('2026-05-30T12:00:00.000Z'),
    );

    expect(groupUnknownItemEvidence(state).map((group) => group.displayName)).toEqual(
      expect.arrayContaining(['Planet Egg', 'Day Off Voucher', "Thomas's Red Velvet Cake"]),
    );
  });

  it('saves local evidence state to browser storage', () => {
    recordUnknownItemEvidence([
      createUnknownItemEvidenceRecord({
        sourceType: 'manual',
        sourceLabel: 'Manual',
        observedName: 'Gloorp',
        observedAt: '2026-05-30T12:00:00.000Z',
      })!,
    ]);

    expect(window.localStorage.getItem(UNKNOWN_ITEM_EVIDENCE_STORAGE_KEY)).toContain('Gloorp');
    expect(groupUnknownItemEvidence(loadUnknownItemEvidenceState())[0].displayName).toBe('Gloorp');
  });
});
