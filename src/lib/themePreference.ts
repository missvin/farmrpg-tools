export const APP_THEME_STORAGE_KEY = 'farmrpg-tools-theme';

export type AppTheme = 'light' | 'dark';

export function isAppTheme(value: string | null | undefined): value is AppTheme {
  return value === 'light' || value === 'dark';
}

export function readStoredAppTheme(): AppTheme | null {
  try {
    const storedValue = window.localStorage.getItem(APP_THEME_STORAGE_KEY);
    return isAppTheme(storedValue) ? storedValue : null;
  } catch {
    return null;
  }
}

export function getInitialAppTheme(): AppTheme {
  return readStoredAppTheme() ?? 'light';
}

export function persistAppTheme(theme: AppTheme): void {
  try {
    window.localStorage.setItem(APP_THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage failures so theming stays non-fatal.
  }
}

export function clearStoredAppTheme(): void {
  try {
    window.localStorage.removeItem(APP_THEME_STORAGE_KEY);
  } catch {
    // Ignore storage failures so theming stays non-fatal.
  }
}
