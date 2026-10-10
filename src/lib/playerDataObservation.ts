/** Stored with its inventory section or mastery snapshot, never in a separate receipt write. */
export type PlayerDataObservation = {
  source: 'manual' | 'capture';
  scope: 'full' | 'item';
  observedAt: string;
  appliedAt: string;
  captureId?: string;
};

function isIsoTime(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

export function isValidPlayerDataObservation(value: unknown): value is PlayerDataObservation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    (record.source === 'manual' || record.source === 'capture') &&
    (record.scope === 'full' || record.scope === 'item') &&
    isIsoTime(record.observedAt) && isIsoTime(record.appliedAt) && record.observedAt <= record.appliedAt &&
    (record.source === 'capture'
      ? typeof record.captureId === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(record.captureId)
      : record.captureId === undefined)
  );
}

export function createManualObservation(scope: 'full' | 'item', now = new Date().toISOString()): PlayerDataObservation {
  const observation: PlayerDataObservation = { source: 'manual', scope, observedAt: now, appliedAt: now };
  if (!isValidPlayerDataObservation(observation)) throw new Error('Invalid import observation time.');
  return observation;
}

/** A manual correction protects the whole section against captures observed before it. */
export function getCaptureOrderingReceipt(
  observation: PlayerDataObservation | undefined,
  section: 'inventory' | 'mastery',
) {
  if (!isValidPlayerDataObservation(observation)) return undefined;
  return { captureId: observation.captureId ?? 'manual', section, observedAt: observation.observedAt };
}
