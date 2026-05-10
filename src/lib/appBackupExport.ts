import { loadAcquisitionPlannerInputState } from './acquisitionPlannerState';
import packageJson from '../../package.json';

import { loadCraftingModifierState } from './craftingModifierState';
import { createAppBackupPayload, type AppBackupPayloadV1 } from './appBackupSchema';
import { loadDropRateAcquisitionSettings } from './dropRateAcquisitionSettings';
import { loadMasteryRaceCountsState } from './masteryRaceCounts';
import { loadPersonalMasteryGoalsState } from './personalMasteryGoals';
import { loadPumpkinJuicePlannerState } from './pumpkinJuicePlannerState';
import { listSnapshots } from './storage/masterySnapshots';
import { readStoredAppTheme } from './themePreference';

export const APP_BACKUP_FILENAME_PREFIX = 'farmrpg-tools-backup';
export const APP_BACKUP_EXPORT_MIME_TYPE = 'application/json;charset=utf-8';

export type BuildCurrentAppBackupPayloadOptions = {
  appVersion?: string;
  exportedAt?: string;
};

export type AppBackupExportResult = {
  payload: AppBackupPayloadV1;
  content: string;
  filename: string;
};

export function createAppBackupFilename(exportedAt: string): string {
  const safeTimestamp = exportedAt.replace(/[:.]/g, '-');
  return `${APP_BACKUP_FILENAME_PREFIX}-${safeTimestamp}.json`;
}

export function serializeAppBackupPayload(payload: AppBackupPayloadV1): string {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export async function buildCurrentAppBackupPayload(
  options: BuildCurrentAppBackupPayloadOptions = {},
): Promise<AppBackupPayloadV1> {
  const snapshots = await listSnapshots();

  return createAppBackupPayload({
    appVersion: options.appVersion ?? packageJson.version,
    exportedAt: options.exportedAt ?? new Date().toISOString(),
    snapshots,
    craftingModifierState: loadCraftingModifierState(),
    acquisitionPlannerState: loadAcquisitionPlannerInputState(),
    dropRateAcquisitionSettings: loadDropRateAcquisitionSettings(),
    pumpkinJuicePlannerState: loadPumpkinJuicePlannerState(),
    personalMasteryGoalsState: loadPersonalMasteryGoalsState(),
    masteryRaceCountsState: loadMasteryRaceCountsState(),
    themePreference: readStoredAppTheme(),
  });
}

export function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function exportCurrentAppBackupFile(
  options: BuildCurrentAppBackupPayloadOptions = {},
): Promise<AppBackupExportResult> {
  const payload = await buildCurrentAppBackupPayload(options);
  const content = serializeAppBackupPayload(payload);
  const filename = createAppBackupFilename(payload.exportedAt);

  downloadTextFile(filename, content, APP_BACKUP_EXPORT_MIME_TYPE);

  return {
    payload,
    content,
    filename,
  };
}
