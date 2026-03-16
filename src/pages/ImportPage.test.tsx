import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ImportPage } from './ImportPage';

const saveSnapshotMock = vi.fn();

vi.mock('../lib/storage/masterySnapshots', () => ({
  createSnapshotId: () => 'snapshot-test-id',
  saveSnapshot: (...args: unknown[]) => saveSnapshotMock(...args),
}));

function buildMasteryBlock(itemName: string, count: number, target: number | 'INF'): string {
  const progressTarget = target === 'INF' ? '\u221e' : target.toLocaleString();
  return `${itemName}\n${count.toLocaleString()} / ${progressTarget} Progress\n50%`;
}

function buildTierRows(
  labelPrefix: string,
  target: number | 'INF',
  count: number,
  startIndex = 1,
): string[] {
  return Array.from({ length: count }, (_, index) =>
    buildMasteryBlock(`${labelPrefix} Item ${startIndex + index}`, startIndex + index, target),
  );
}

function buildFullExport(): string {
  return [
    ...buildTierRows('No Tier', 10, 12, 1),
    ...buildTierRows('Tier II', 100, 12, 101),
    ...buildTierRows('Tier III', 10_000, 12, 201),
    ...buildTierRows('Tier IV', 100_000, 12, 301),
    ...buildTierRows('Tier V', 1_000_000, 12, 401),
  ].join('\n\n');
}

describe('ImportPage', () => {
  beforeEach(() => {
    saveSnapshotMock.mockReset();
    saveSnapshotMock.mockResolvedValue(undefined);
  });

  it('produces no import validation warning for a full export', async () => {
    const user = userEvent.setup();

    render(<ImportPage />);

    const saveButton = screen.getByRole('button', { name: 'Save Snapshot' });
    expect(saveButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Raw mastery export'), { target: { value: buildFullExport() } });
    await user.click(screen.getByRole('button', { name: 'Parse Preview' }));

    expect(screen.getByText('Items parsed')).toBeInTheDocument();
    expect(screen.queryByText('Import Validation Warning')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Import anyway' })).not.toBeInTheDocument();
    expect(saveButton).toBeEnabled();
  });

  it('shows a warning when Tier II is missing', async () => {
    const user = userEvent.setup();

    render(<ImportPage />);

    const missingTierTwoExport = [
      ...buildTierRows('No Tier', 10, 15, 1),
      ...buildTierRows('Tier III', 10_000, 15, 201),
      ...buildTierRows('Tier IV', 100_000, 15, 301),
      ...buildTierRows('Tier V', 1_000_000, 15, 401),
    ].join('\n\n');

    fireEvent.change(screen.getByLabelText('Raw mastery export'), { target: { value: missingTierTwoExport } });
    await user.click(screen.getByRole('button', { name: 'Parse Preview' }));

    expect(screen.getByText('Import Validation Warning')).toBeInTheDocument();
    expect(screen.getByText(/Tier II appears to be missing/)).toBeInTheDocument();
  });

  it('shows a warning listing multiple missing tiers', async () => {
    const user = userEvent.setup();

    render(<ImportPage />);

    const missingMultipleTiersExport = [
      ...buildTierRows('Tier IV', 100_000, 30, 301),
      ...buildTierRows('Tier V', 1_000_000, 30, 401),
    ].join('\n\n');

    fireEvent.change(screen.getByLabelText('Raw mastery export'), { target: { value: missingMultipleTiersExport } });
    await user.click(screen.getByRole('button', { name: 'Parse Preview' }));

    expect(screen.getByText(/Tier II, Tier III \(M\)/)).toBeInTheDocument();
    expect(screen.getByText(/No Tier/)).toBeInTheDocument();
  });

  it('still allows saving when warnings exist after choosing import anyway', async () => {
    const user = userEvent.setup();

    render(<ImportPage />);

    const saveButton = screen.getByRole('button', { name: 'Save Snapshot' });

    fireEvent.change(screen.getByLabelText('Raw mastery export'), {
      target: { value: 'Gold Cucumber\n967,174 / 1,000,000 Progress\n96.7174%' },
    });
    await user.click(screen.getByRole('button', { name: 'Parse Preview' }));

    expect(screen.getByText('Import Validation Warning')).toBeInTheDocument();
    expect(saveButton).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Import anyway' }));

    expect(saveButton).toBeEnabled();

    await user.click(saveButton);

    expect(saveSnapshotMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Snapshot saved locally/)).toBeInTheDocument();
  });

  it('shows a validation message when no mastery items are detected', async () => {
    const user = userEvent.setup();

    render(<ImportPage />);

    fireEvent.change(screen.getByLabelText('Raw mastery export'), {
      target: { value: 'Home\nSettings\nInventory' },
    });
    await user.click(screen.getByRole('button', { name: 'Parse Preview' }));

    expect(
      screen.getByText('No mastery items were detected in that paste. Check that you copied the mastery export.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Snapshot' })).toBeDisabled();
  });

  it('filters parsed rows by raw item name or canonical key', async () => {
    const user = userEvent.setup();

    render(<ImportPage />);

    fireEvent.change(screen.getByLabelText('Raw mastery export'), {
      target: {
        value:
          'Gold Cucumber\n967,174 / 1,000,000 Progress\n96.7174%\n\nRed Diamond Fish\n8,835 / 10,000 Progress\n88.35%',
      },
    });
    await user.click(screen.getByRole('button', { name: 'Parse Preview' }));

    await user.type(screen.getByLabelText('Filter parsed rows'), 'diamond');

    expect(screen.queryByText('Gold Cucumber')).not.toBeInTheDocument();
    expect(screen.getByText('Red Diamond Fish')).toBeInTheDocument();
  });
});
