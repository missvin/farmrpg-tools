import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ImportPage } from './ImportPage';

const saveSnapshotMock = vi.fn();

vi.mock('../lib/storage/masterySnapshots', () => ({
  createSnapshotId: () => 'snapshot-test-id',
  saveSnapshot: (...args: unknown[]) => saveSnapshotMock(...args),
}));

describe('ImportPage', () => {
  beforeEach(() => {
    saveSnapshotMock.mockReset();
    saveSnapshotMock.mockResolvedValue(undefined);
  });

  it('keeps save disabled until a valid parse preview exists and then saves locally', async () => {
    const user = userEvent.setup();

    render(<ImportPage />);

    const saveButton = screen.getByRole('button', { name: 'Save Snapshot' });
    expect(saveButton).toBeDisabled();

    await user.type(
      screen.getByLabelText('Raw mastery export'),
      'Gold Cucumber\n967,174 / 1,000,000 Progress\n96.7174%',
    );
    await user.click(screen.getByRole('button', { name: 'Parse Preview' }));

    expect(screen.getByText('Items parsed')).toBeInTheDocument();
    expect(screen.getByText('Tiers detected')).toBeInTheDocument();
    expect(screen.getByText('Unique canonical items')).toBeInTheDocument();
    expect(screen.getByText('Total parsed rows')).toBeInTheDocument();
    expect(screen.getByText('Gold Cucumber')).toBeInTheDocument();
    expect(saveButton).toBeEnabled();

    await user.click(saveButton);

    expect(saveSnapshotMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Snapshot saved locally/)).toBeInTheDocument();
  });

  it('shows a validation message when no mastery items are detected', async () => {
    const user = userEvent.setup();

    render(<ImportPage />);

    await user.type(screen.getByLabelText('Raw mastery export'), 'Home\nSettings\nInventory');
    await user.click(screen.getByRole('button', { name: 'Parse Preview' }));

    expect(
      screen.getByText('No mastery items were detected in that paste. Check that you copied the mastery export.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Snapshot' })).toBeDisabled();
  });

  it('filters parsed rows by raw item name or canonical key', async () => {
    const user = userEvent.setup();

    render(<ImportPage />);

    await user.type(
      screen.getByLabelText('Raw mastery export'),
      'Gold Cucumber\n967,174 / 1,000,000 Progress\n96.7174%\n\nRed Diamond Fish\n8,835 / 10,000 Progress\n88.35%',
    );
    await user.click(screen.getByRole('button', { name: 'Parse Preview' }));

    await user.type(screen.getByLabelText('Filter parsed rows'), 'diamond');

    expect(screen.queryByText('Gold Cucumber')).not.toBeInTheDocument();
    expect(screen.getByText('Red Diamond Fish')).toBeInTheDocument();
  });
});
