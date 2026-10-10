/** One origin-wide boundary for capture, manual corrections and backup restore. */
export const PLAYER_DATA_LOCK = 'farmrpg-tools.player-data';

export async function withPlayerDataLock<T>(work: () => Promise<T> | T, requireCrossTab = false): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request(PLAYER_DATA_LOCK, { mode: 'exclusive' }, work);
  }
  // Manual imports still work in older browsers. Capture must never pretend a
  // process-local mutex protects other tabs.
  if (requireCrossTab) throw new Error('Capture requires browser cross-tab locking. Previous data retained.');
  return work();
}
