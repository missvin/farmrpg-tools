import { useEffect, useState } from 'react';

import {
  loadLocalItemReferenceLookup,
  type LocalItemReferenceLookup,
} from './localItemReferenceLookup';

export function useImportReferenceLookup() {
  const [localItemLookup, setLocalItemLookup] = useState<LocalItemReferenceLookup | null>(null);
  const [knownItemKeys, setKnownItemKeys] = useState<Set<string> | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadLocalItemReferenceLookup()
      .then((lookup) => {
        if (cancelled) {
          return;
        }

        setLocalItemLookup(lookup);
        setKnownItemKeys(
          new Set([
            ...Object.keys(lookup.itemCatalog.byCanonicalKey),
            ...Object.keys(lookup.museumCoverage.byCanonicalKey),
            ...(lookup.museumCanon?.entries.map((entry) => entry.canonicalKey) ?? []),
          ]),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setLocalItemLookup(null);
          setKnownItemKeys(new Set());
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { localItemLookup, knownItemKeys };
}
