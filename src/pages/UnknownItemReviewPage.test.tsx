import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  UNKNOWN_ITEM_EVIDENCE_STORAGE_KEY,
  groupUnknownItemEvidence,
  loadUnknownItemEvidenceState,
} from '../lib/unknownItemEvidence';
import { UnknownItemReviewPage } from './UnknownItemReviewPage';

describe('UnknownItemReviewPage', () => {
  beforeEach(() => {
    window.localStorage.removeItem(UNKNOWN_ITEM_EVIDENCE_STORAGE_KEY);
  });

  it('adds the first review batch and lets a candidate be marked for icon export', async () => {
    const user = userEvent.setup();

    render(<UnknownItemReviewPage />);

    await user.click(screen.getByRole('button', { name: 'Add First Unknown Batch' }));

    expect(await screen.findByText('Planet Egg')).toBeInTheDocument();

    const planetEggCard = screen.getByText('Planet Egg').closest('li');
    expect(planetEggCard).not.toBeNull();

    await user.selectOptions(within(planetEggCard as HTMLElement).getByLabelText('Review decision'), 'reviewed');
    await user.selectOptions(
      within(planetEggCard as HTMLElement).getByLabelText('Promotion target'),
      'buddy_icon_candidates',
    );

    const groups = groupUnknownItemEvidence(loadUnknownItemEvidenceState());
    expect(groups.find((group) => group.normalizedKey === 'planet egg')).toMatchObject({
      reviewState: 'reviewed',
      targetDestination: 'buddy_icon_candidates',
    });
    expect(screen.getByRole('button', { name: 'Export Icon Candidates CSV' })).not.toBeDisabled();
  });
});
