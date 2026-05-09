import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { getItemIcon } from '../lib/itemIconManifest';
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

type SearchResult = {
  id: string;
  label: string;
  meta: string;
  to: string;
  iconSrc?: string | null;
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
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [searchableItems, setSearchableItems] = useState<SearchableItem[]>([]);
  const [hasLoadedItems, setHasLoadedItems] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeResultIndex, setActiveResultIndex] = useState(-1);

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
  const combinedResults = useMemo<SearchResult[]>(
    () => [
      ...pageResults.map((route) => ({
        id: `page:${route.path}`,
        label: route.label,
        meta: route.path,
        to: route.path,
        iconSrc: null,
      })),
      ...itemResults.map((item) => ({
        id: `item:${item.canonicalKey}`,
        label: item.itemName,
        meta: item.sourceLabel,
        to: item.to,
        iconSrc: getItemIcon(item.canonicalKey)?.src ?? null,
      })),
    ],
    [itemResults, pageResults],
  );
  const activeResultId =
    activeResultIndex >= 0 && combinedResults[activeResultIndex]
      ? `global-search-result-${activeResultIndex}`
      : undefined;

  useEffect(() => {
    setActiveResultIndex(-1);
  }, [normalizedQuery]);

  function handleResultClick(): void {
    setQuery('');
    setActiveResultIndex(-1);
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (!shouldShowResults || combinedResults.length === 0) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveResultIndex((currentIndex) =>
        currentIndex < 0 ? 0 : (currentIndex + 1) % combinedResults.length,
      );
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveResultIndex((currentIndex) =>
        currentIndex < 0
          ? combinedResults.length - 1
          : (currentIndex - 1 + combinedResults.length) % combinedResults.length,
      );
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const result = combinedResults[activeResultIndex] ?? combinedResults[0];
      setQuery('');
      setActiveResultIndex(-1);
      navigate(result.to);
      return;
    }

    if (event.key === 'Escape') {
      setQuery('');
      setActiveResultIndex(-1);
    }
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
        onKeyDown={handleInputKeyDown}
        placeholder="Search pages or items"
        autoComplete="off"
        aria-controls={shouldShowResults ? 'global-search-results' : undefined}
        aria-expanded={shouldShowResults}
        aria-activedescendant={activeResultId}
      />

      {shouldShowResults ? (
        <div id="global-search-results" className="global-search__panel" role="region" aria-label="Search results">
          {pageResults.length > 0 ? (
            <section className="global-search__section" aria-labelledby="global-search-pages">
              <h2 id="global-search-pages" className="global-search__section-title">
                Pages
              </h2>
              <ul className="global-search__result-list">
                {pageResults.map((route, resultIndex) => (
                  <li key={route.path}>
                    <Link
                      id={`global-search-result-${resultIndex}`}
                      className={`global-search__result${
                        activeResultIndex === resultIndex ? ' global-search__result--active' : ''
                      }`}
                      to={route.path}
                      onClick={handleResultClick}
                    >
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
                {itemResults.map((item, itemIndex) => {
                  const resultIndex = pageResults.length + itemIndex;
                  const icon = getItemIcon(item.canonicalKey);

                  return (
                  <li key={item.canonicalKey}>
                    <Link
                      id={`global-search-result-${resultIndex}`}
                      className={`global-search__result${
                        activeResultIndex === resultIndex ? ' global-search__result--active' : ''
                      }`}
                      to={item.to}
                      onClick={handleResultClick}
                    >
                      <span className="global-search__result-label">
                        {icon ? (
                          <img className="item-icon" src={icon.src} alt="" aria-hidden="true" loading="lazy" />
                        ) : null}
                        <span>{item.itemName}</span>
                      </span>
                      <span className="global-search__meta">{item.sourceLabel}</span>
                    </Link>
                  </li>
                  );
                })}
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
