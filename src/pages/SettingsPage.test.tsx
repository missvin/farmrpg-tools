import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { mockExportCurrentAppBackupFile } = vi.hoisted(() => ({
  mockExportCurrentAppBackupFile: vi.fn(),
}));

vi.mock('../lib/appBackupExport', () => ({
  exportCurrentAppBackupFile: mockExportCurrentAppBackupFile,
}));

import { SettingsPage } from './SettingsPage';

describe('SettingsPage', () => {
  beforeEach(() => {
    mockExportCurrentAppBackupFile.mockReset();
  });

  it('exports the full local backup file from the settings page', async () => {
    const user = userEvent.setup();

    mockExportCurrentAppBackupFile.mockResolvedValue({
      payload: {},
      content: '{}\n',
      filename: 'farmrpg-tools-backup-2026-03-21T10-30-00-000Z.json',
    });

    render(<SettingsPage />);

    await user.click(screen.getByRole('button', { name: 'Export Backup' }));

    expect(mockExportCurrentAppBackupFile).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText('Backup downloaded as farmrpg-tools-backup-2026-03-21T10-30-00-000Z.json.'),
    ).toBeInTheDocument();
  });

  it('surfaces a readable export error without changing local state', async () => {
    const user = userEvent.setup();

    mockExportCurrentAppBackupFile.mockRejectedValue(new Error('IndexedDB is not available in this browser.'));

    render(<SettingsPage />);

    await user.click(screen.getByRole('button', { name: 'Export Backup' }));

    expect(
      await screen.findByText('IndexedDB is not available in this browser.'),
    ).toBeInTheDocument();
  });
});
