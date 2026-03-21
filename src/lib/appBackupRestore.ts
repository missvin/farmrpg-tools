import {
  clearCraftingModifierState,
  saveCraftingModifierState,
} from './craftingModifierState';
import { isAppBackupPayloadV1, type AppBackupPayloadV1 } from './appBackupSchema';
import { replaceSnapshots } from './storage/masterySnapshots';
import { clearStoredAppTheme, persistAppTheme } from './themePreference';

export async function readAppBackupFile(file: File): Promise<AppBackupPayloadV1> {
  let rawText: string;

  try {
    rawText = await file.text();
  } catch {
    throw new Error('Unable to read the selected backup file.');
  }

  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(rawText);
  } catch {
    throw new Error('The selected file is not valid JSON.');
  }

  if (!isAppBackupPayloadV1(parsedValue)) {
    throw new Error('The selected file is not a supported FarmRPG Tools backup.');
  }

  return parsedValue;
}

export async function restoreAppBackupPayload(payload: AppBackupPayloadV1): Promise<void> {
  await replaceSnapshots(payload.state.snapshots);

  if (payload.state.preferences.craftingModifierState) {
    saveCraftingModifierState(payload.state.preferences.craftingModifierState);
  } else {
    clearCraftingModifierState();
  }

  if (payload.state.preferences.themePreference) {
    persistAppTheme(payload.state.preferences.themePreference);
  } else {
    clearStoredAppTheme();
  }
}

export function reloadAfterRestore(): void {
  window.location.reload();
}
