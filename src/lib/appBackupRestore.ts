import {
  clearAcquisitionPlannerInputState,
  loadAcquisitionPlannerInputState,
  saveAcquisitionPlannerInputState,
} from './acquisitionPlannerState';
import {
  loadCraftingModifierState,
  clearCraftingModifierState,
  saveCraftingModifierState,
} from './craftingModifierState';
import { validateAppBackupPayloadV1, type AppBackupPayloadV1 } from './appBackupSchema';
import { listSnapshots, replaceSnapshots } from './storage/masterySnapshots';
import { clearStoredAppTheme, persistAppTheme, readStoredAppTheme } from './themePreference';

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

  const validationResult = validateAppBackupPayloadV1(parsedValue);

  if (!validationResult.ok) {
    throw new Error(validationResult.message);
  }

  return validationResult.payload;
}

export async function restoreAppBackupPayload(payload: AppBackupPayloadV1): Promise<void> {
  const currentSnapshots = await listSnapshots();
  const currentCraftingModifierState = loadCraftingModifierState();
  const currentAcquisitionPlannerState = loadAcquisitionPlannerInputState();
  const currentThemePreference = readStoredAppTheme();

  try {
    await replaceSnapshots(payload.state.snapshots);

    if (payload.state.preferences.craftingModifierState) {
      saveCraftingModifierState(payload.state.preferences.craftingModifierState);
    } else {
      clearCraftingModifierState();
    }

    if (payload.state.preferences.acquisitionPlannerState) {
      saveAcquisitionPlannerInputState(payload.state.preferences.acquisitionPlannerState);
    } else {
      clearAcquisitionPlannerInputState();
    }

    if (payload.state.preferences.themePreference) {
      persistAppTheme(payload.state.preferences.themePreference);
    } else {
      clearStoredAppTheme();
    }
  } catch {
    await replaceSnapshots(currentSnapshots);
    saveCraftingModifierState(currentCraftingModifierState);
    saveAcquisitionPlannerInputState(currentAcquisitionPlannerState);

    if (currentThemePreference) {
      persistAppTheme(currentThemePreference);
    } else {
      clearStoredAppTheme();
    }

    throw new Error('Unable to restore the selected backup file. Your current local state was left unchanged.');
  }
}

export function reloadAfterRestore(): void {
  window.location.reload();
}
