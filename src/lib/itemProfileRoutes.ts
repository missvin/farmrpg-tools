export function toItemProfilePath(canonicalKey: string): string {
  return `/items/${encodeURIComponent(canonicalKey)}`;
}

export function decodeItemProfileParam(param: string | undefined): string {
  return decodeURIComponent(param ?? '').trim().toLowerCase();
}
