import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { PageIntro } from '../components/PageIntro';
import { getItemIcon } from '../lib/itemIconManifest';
import { toItemProfilePath } from '../lib/itemProfileRoutes';
import { loadItemCatalog, type ItemCatalogEntry } from '../lib/loadItemCatalog';
import { getLatestSnapshot } from '../lib/storage/masterySnapshots';

type ItemsLandingState = {
  isLoading: boolean;
  catalogError: string | null;
  snapshotError: string | null;
  items: ItemCatalogEntry[];
  hasSnapshot: boolean | null;
};

function matchesItemQuery(item: ItemCatalogEntry, normalizedQuery: string): boolean {
  return item.itemName.toLowerCase().includes(normalizedQuery) || item.canonicalKey.includes(normalizedQuery);
}

function formatMasteryPossible(value: ItemCatalogEntry['masteryPossible']): string {
  if (value === 'yes') {
    return 'Mastery item';
  }

  if (value === 'no') {
    return 'Not mastery-tracked';
  }

  return 'Mastery unknown';
}

export function ItemsLandingPage() {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<ItemsLandingState>({
    isLoading: true,
    catalogError: null,
    snapshotError: null,
    items: [],
    hasSnapshot: null,
  });

  useEffect(() => {
    let isMounted = true;

    void Promise.allSettled([loadItemCatalog(), getLatestSnapshot()]).then(([catalogResult, snapshotResult]) => {
      if (!isMounted) {
        return;
      }

      const items =
        catalogResult.status === 'fulfilled'
          ? [...catalogResult.value.entries].sort((left, right) => left.itemName.localeCompare(right.itemName))
          : [];
      const catalogError =
        catalogResult.status === 'rejected'
          ? catalogResult.reason instanceof Error
            ? catalogResult.reason.message
            : 'Unable to load local item catalog data.'
          : null;
      const snapshotError =
        snapshotResult.status === 'rejected'
          ? snapshotResult.reason instanceof Error
            ? snapshotResult.reason.message
            : 'Unable to read the latest local snapshot.'
          : null;

      setState({
        isLoading: false,
        catalogError,
        snapshotError,
        items,
        hasSnapshot: snapshotResult.status === 'fulfilled' ? snapshotResult.value !== null : null,
      });
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleItems = useMemo(() => {
    if (!normalizedQuery) {
      return state.items.slice(0, 12);
    }

    return state.items.filter((item) => matchesItemQuery(item, normalizedQuery)).slice(0, 24);
  }, [normalizedQuery, state.items]);

  return (
    <div className="page-stack">
      <PageIntro
        title="Items"
        description="Find known local items and open their workbench pages for sources, uses, mastery status, goals, and planning actions."
        storageKey="items-landing"
      />

      <section className="page-card page-stack" aria-labelledby="items-status-title">
        <div>
          <h2 id="items-status-title">Item Data Status</h2>
          <p className="supporting-text">
            Item profiles use checked-in reference data first and fill in player-specific status from local imports.
          </p>
        </div>

        <div className="summary-grid">
          <div className="summary-grid__item">
            <h3 className="section-title">Item catalog</h3>
            <p>
              <strong>{state.isLoading ? 'Checking' : state.catalogError ? 'Unavailable' : 'Ready'}</strong>
            </p>
            <p className="subtle-text">
              {state.isLoading
                ? 'Loading local item reference data.'
                : state.catalogError
                  ? 'Item search is limited until the local catalog can be read.'
                  : `${state.items.length.toLocaleString()} known local items are available.`}
            </p>
          </div>
          <div className="summary-grid__item">
            <h3 className="section-title">Mastery snapshot</h3>
            <p>
              <strong>{state.isLoading ? 'Checking' : state.hasSnapshot ? 'Ready' : 'Optional'}</strong>
            </p>
            <p className="subtle-text">
              {state.snapshotError
                ? 'Item pages still open, but local mastery status could not be checked.'
                : state.hasSnapshot
                  ? 'Item pages can include local mastery progress where supported.'
                  : 'Item pages still open; import or restore data when you want local progress context.'}
            </p>
            {!state.isLoading && !state.hasSnapshot ? (
              <p className="subtle-text">
                <Link to="/import">Import mastery</Link> or{' '}
                <Link to="/settings#settings-restore-title">restore backup</Link>
              </p>
            ) : null}
          </div>
        </div>

        {state.catalogError ? <p className="status-message status-message--error">{state.catalogError}</p> : null}
        {state.snapshotError ? <p className="status-message status-message--error">{state.snapshotError}</p> : null}
      </section>

      <section className="page-card page-stack" aria-labelledby="items-search-title">
        <div>
          <h2 id="items-search-title">Find Item Profiles</h2>
          <p className="supporting-text">Open an item workbench from the local catalog.</p>
        </div>

        <label className="field-label" htmlFor="items-search">
          Item search
        </label>
        <input
          id="items-search"
          className="text-input"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search items"
          autoComplete="off"
        />

        {state.isLoading ? <p className="empty-state">Loading local items...</p> : null}

        {!state.isLoading && !state.catalogError && visibleItems.length === 0 ? (
          <p className="empty-state">No local item matches found.</p>
        ) : null}

        {visibleItems.length > 0 ? (
          <div className="quick-link-grid" aria-live="polite">
            {visibleItems.map((item) => {
              const icon = getItemIcon(item.canonicalKey);

              return (
                <Link className="quick-link-card" to={toItemProfilePath(item.canonicalKey)} key={item.canonicalKey}>
                  <span className="quick-link-card__title item-profile-link">
                    {icon ? (
                      <img className="item-icon" src={icon.src} alt="" aria-hidden="true" loading="lazy" />
                    ) : null}
                    <strong>{item.itemName}</strong>
                  </span>
                  <span className="quick-link-card__description">{formatMasteryPossible(item.masteryPossible)}</span>
                  <span className="quick-link-card__description">{item.canonicalKey}</span>
                </Link>
              );
            })}
          </div>
        ) : null}
      </section>
    </div>
  );
}
