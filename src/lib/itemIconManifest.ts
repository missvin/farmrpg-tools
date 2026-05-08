import manifest from '../../generated/buddy_item_icon_manifest.json';

export type ItemIconManifestEntry = {
  itemName: string;
  canonicalKey: string;
  manifestStatus: string;
  localRelativePath: string | null;
};

export type ItemIcon = {
  itemName: string;
  canonicalKey: string;
  src: string;
};

type ItemIconManifestPayload = {
  results: ItemIconManifestEntry[];
};

const iconAssetModules = import.meta.glob('../../generated/item-icons/*.png', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;

function normalizeGeneratedAssetPath(modulePath: string): string {
  return modulePath.replace(/^\.\.\/\.\.\//, '');
}

const iconAssetUrlsByLocalPath = Object.fromEntries(
  Object.entries(iconAssetModules).map(([modulePath, assetUrl]) => [
    normalizeGeneratedAssetPath(modulePath),
    assetUrl,
  ]),
);

export function buildItemIconLookup(
  manifestEntries: ItemIconManifestEntry[],
  assetUrlsByLocalPath: Record<string, string>,
): Map<string, ItemIcon> {
  const lookup = new Map<string, ItemIcon>();

  for (const entry of manifestEntries) {
    if (entry.manifestStatus !== 'ready' || !entry.localRelativePath || lookup.has(entry.canonicalKey)) {
      continue;
    }

    const assetUrl = assetUrlsByLocalPath[entry.localRelativePath];
    if (!assetUrl) {
      continue;
    }

    lookup.set(entry.canonicalKey, {
      itemName: entry.itemName,
      canonicalKey: entry.canonicalKey,
      src: assetUrl,
    });
  }

  return lookup;
}

const itemIconLookup = buildItemIconLookup(
  (manifest as ItemIconManifestPayload).results,
  iconAssetUrlsByLocalPath,
);

export function getItemIcon(canonicalKey: string): ItemIcon | null {
  return itemIconLookup.get(canonicalKey) ?? null;
}
