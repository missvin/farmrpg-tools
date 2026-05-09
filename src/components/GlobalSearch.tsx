import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { loadItemCatalog } from '../lib/loadItemCatalog';
import { loadRecipeGraph } from '../lib/loadRecipeGraph';
import { loadTowerRequirements } from '../lib/loadTowerRequirements';
import { toItemProfilePath } from '../lib/itemProfileRoutes';
import { appRoutes } from '../lib/routes';
import { getLatestSnapshot } from '../lib/storage/masterySnapshots';

type SearchableItem = {
  canonicalKey: string;
  itemName: string;
  sourceLabel: string;
  to: string;
};

function formatFallbackItemName(canonicalKey: string): string {
  return canonicalKey
    .split(' ')
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

function matchesQuery(value: string, query: string): boolean {
  return value.toLowerCase().includes(query);
}

function setSearchableItem(
  byCanonicalKey: Map<string, SearchableItem>,
  canonicalKey: string,
  itemName: string,
  sourceLabel: string,
): void {
  if (byCanonicalKey.has(canonicalKey)) {
    return;
  }

  byCanonicalKey.set(canonicalKey, {
    canonicalKey,
    itemName,
    sourceLabel,
    to: toItemProfilePath(canonicalKey),
  });
}

export function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [searchableItems, setSearchableItems] = useState<SearchableItem[]>([]);
  const [hasLoadedItems, setHasLoadedItems] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const normalizedQuery = query.trim().toLowerCase();

  useEffect(() => {
    let isMounted = true;

    if (normalizedQuery.length < 2 || hasLoadedItems) {
      return () => {
        isMounted = false;
      };
    }

    void Promise.all([getLatestSnapshot(), loadTowerRequirements(), loadItemCatalog(), loadRecipeGraph()])
      .then(([snapshot, towerRequirementsData, itemCatalog, recipeGraph]) => {
        if (!isMounted) {
          return;
        }

        const byCanonicalKey = new Map<string, SearchableItem>();

        for (const entry of itemCatalog.entries) {
          setSearchableItem(byCanonicalKey, entry.canonicalKey, entry.itemName, 'Item profile');
        }

        for (const row of snapshot?.parsedRows ?? []) {
          setSearchableItem(byCanonicalKey, row.canonicalKey, row.rawItemName, 'Latest import');
        }

        for (const canonicalKey of Object.keys(snapshot?.masteryByItem ?? {})) {
          setSearchableItem(byCanonicalKey, canonicalKey, formatFallbackItemName(canonicalKey), 'Latest import');
        }

        for (const row of towerRequirementsData.entries) {
          setSearchableItem(byCanonicalKey, row.canonicalKey, row.itemName, 'Tower requirements');
        }

        for (const recipe of recipeGraph.recipes) {
          setSearchableItem(byCanonicalKey, recipe.outputCanonicalKey, recipe.outputItemName, 'Recipe data');

          for (const input of recipe.inputs) {
            setSearchableItem(byCanonicalKey, input.canonicalKey, input.itemName, 'Recipe data');
          }
        }

        setSearchableItems([...byCanonicalKey.values()].sort((left, right) => left.itemName.localeCompare(right.itemName)));
        setHasLoadedItems(true);
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        setHasLoadedItems(true);
        setLoadError(error instanceof Error ? error.message : 'Unable to load local item search data.');
      });

    return () => {
      isMounted = false;
    };
  }, [hasLoadedItems, normalizedQuery]);

  const pageResults = useMemo(
    () =>
      normalizedQuery.length < 2
        ? []
        : appRoutes
            .filter((route) => !route.path.includes(':'))
            .filter((route) => matchesQuery(route.label, normalizedQuery) || matchesQuery(route.path, normalizedQuery))
            .slice(0, 6),
    [normalizedQuery],
  );

  const itemResults = useMemo(
    () =>
      normalizedQuery.length < 2
        ? []
        : searchableItems
            .filter(
              (item) =>
                matchesQuery(item.itemName, normalizedQuery) || matchesQuery(item.canonicalKey, normalizedQuery),
            )
            .slice(0, 8),
    [normalizedQuery, searchableItems],
  );

  const shouldShowResults = normalizedQuery.length >= 2;

  function handleResultClick(): void {
    setQuery('');
  }

  return (
    <div className="global-search">
      <label className="visually-hidden" htmlFor="global-search">
        Search pages and items
      </label>
      <input
        id="global-search"
        className="global-search__input"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search pages or items"
        autoComplete="off"
      />

      {shouldShowResults ? (
        <div className="global-search__panel" role="region" aria-label="Search results">
          {pageResults.length > 0 ? (
            <section className="global-search__section" aria-labelledby="global-search-pages">
              <h2 id="global-search-pages" className="global-search__section-title">
                Pages
              </h2>
              <ul className="global-search__result-list">
                {pageResults.map((route) => (
                  <li key={route.path}>
                    <Link className="global-search__result" to={route.path} onClick={handleResultClick}>
                      <span>{route.label}</span>
                      <span className="global-search__meta">{route.path}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {itemResults.length > 0 ? (
            <section className="global-search__section" aria-labelledby="global-search-items">
              <h2 id="global-search-items" className="global-search__section-title">
                Items
              </h2>
              <ul className="global-search__result-list">
                {itemResults.map((item) => (
                  <li key={item.canonicalKey}>
                    <Link className="global-search__result" to={item.to} onClick={handleResultClick}>
                      <span>{item.itemName}</span>
                      <span className="global-search__meta">{item.sourceLabel}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {pageResults.length === 0 && itemResults.length === 0 ? (
            <p className="global-search__empty">
              {loadError ? 'Page search is available, but local item search could not load.' : 'No matches yet.'}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
