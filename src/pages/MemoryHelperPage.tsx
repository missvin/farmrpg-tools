import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';

import { ItemProfileLink } from '../components/ItemProfileLink';
import { PageIntro } from '../components/PageIntro';
import { getItemIcon } from '../lib/itemIconManifest';
import {
  loadLocalItemReferenceLookup,
  resolveLocalItemReference,
  type LocalItemReferenceLookup,
} from '../lib/localItemReferenceLookup';
import {
  clearMemoryHelperSlot,
  deriveMemoryHelperBoard,
  loadMemoryHelperState,
  resetMemoryHelperGame,
  saveMemoryHelperState,
  setMemoryHelperPairMatched,
  setMemoryHelperSlotItem,
  undoMemoryHelperAction,
  type MemoryHelperPairGroup,
  type MemoryHelperSlotStatus,
  type MemoryHelperState,
} from '../lib/memoryHelperState';

type ResourceState = {
  isLoading: boolean;
  error: string | null;
  lookup: LocalItemReferenceLookup | null;
};

type ItemOption = {
  canonicalKey: string;
  itemName: string;
  sourceLabel: string;
};

function formatSlotPosition(row: number, column: number): string {
  return `R${row} C${column}`;
}

function formatSlotSummary(slotIds: string[]): string {
  return slotIds
    .map((slotId) => {
      const slotNumber = Number(slotId.replace('slot-', ''));
      const row = Math.floor((slotNumber - 1) / 6) + 1;
      const column = ((slotNumber - 1) % 6) + 1;
      return formatSlotPosition(row, column);
    })
    .join(', ');
}

function formatSlotStatus(status: MemoryHelperSlotStatus): string {
  switch (status) {
    case 'detected':
      return 'Pair found';
    case 'matched':
      return 'Matched';
    case 'single':
      return 'Seen once';
    case 'empty':
      return 'Empty';
  }
}

function buildItemOptions(lookup: LocalItemReferenceLookup): ItemOption[] {
  const optionsByCanonicalKey = new Map<string, ItemOption>();

  for (const entry of lookup.itemCatalog.entries) {
    optionsByCanonicalKey.set(entry.canonicalKey, {
      canonicalKey: entry.canonicalKey,
      itemName: entry.itemName,
      sourceLabel: 'Item catalog',
    });
  }

  for (const entry of lookup.museumCoverage.entries) {
    if (optionsByCanonicalKey.has(entry.canonicalKey)) {
      continue;
    }

    optionsByCanonicalKey.set(entry.canonicalKey, {
      canonicalKey: entry.canonicalKey,
      itemName: entry.itemName,
      sourceLabel: 'Museum coverage',
    });
  }

  return [...optionsByCanonicalKey.values()].sort((left, right) => {
    return left.itemName.localeCompare(right.itemName) || left.canonicalKey.localeCompare(right.canonicalKey);
  });
}

function getItemIconSrc(canonicalKey: string): string | null {
  return getItemIcon(canonicalKey)?.src ?? null;
}

function MemoryHelperPairRow({
  pair,
  onToggleMatched,
}: {
  pair: MemoryHelperPairGroup;
  onToggleMatched: (pair: MemoryHelperPairGroup) => void;
}) {
  const iconSrc = getItemIconSrc(pair.canonicalKey);

  return (
    <li className={`memory-helper-pair${pair.matched ? ' memory-helper-pair--matched' : ''}`}>
      <div className="memory-helper-pair__item">
        <ItemProfileLink canonicalKey={pair.canonicalKey} itemName={pair.itemName} iconSrc={iconSrc} />
        <span className="subtle-text">{formatSlotSummary(pair.slotIds)}</span>
      </div>
      <button className="button button--secondary" type="button" onClick={() => onToggleMatched(pair)}>
        {pair.matched ? `Unmark ${pair.itemName}` : `Mark ${pair.itemName} matched`}
      </button>
    </li>
  );
}

export function MemoryHelperPage() {
  const itemListId = useId();
  const [memoryState, setMemoryState] = useState<MemoryHelperState>(() => loadMemoryHelperState());
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);
  const [itemQuery, setItemQuery] = useState('');
  const [entryWarnings, setEntryWarnings] = useState<string[]>([]);
  const [resourceState, setResourceState] = useState<ResourceState>({
    isLoading: true,
    error: null,
    lookup: null,
  });

  useEffect(() => {
    let isMounted = true;

    loadLocalItemReferenceLookup()
      .then((lookup) => {
        if (!isMounted) {
          return;
        }

        setResourceState({
          isLoading: false,
          error: null,
          lookup,
        });
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        setResourceState({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unable to load local item reference data.',
          lookup: null,
        });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    saveMemoryHelperState(memoryState);
  }, [memoryState]);

  const derivation = useMemo(() => deriveMemoryHelperBoard(memoryState), [memoryState]);
  const activeSlot = activeSlotId ? memoryState.slots.find((slot) => slot.slotId === activeSlotId) ?? null : null;
  const itemOptions = useMemo(
    () => (resourceState.lookup ? buildItemOptions(resourceState.lookup) : []),
    [resourceState.lookup],
  );

  function handleActivateSlot(slotId: string): void {
    const slot = memoryState.slots.find((entry) => entry.slotId === slotId);
    setActiveSlotId(slotId);
    setItemQuery(slot?.item?.itemName ?? '');
    setEntryWarnings([]);
  }

  function handleSubmitSlot(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (!activeSlotId) {
      return;
    }

    const trimmedQuery = itemQuery.trim();

    if (!trimmedQuery) {
      setMemoryState((currentState) => clearMemoryHelperSlot(currentState, activeSlotId));
      setActiveSlotId(null);
      setEntryWarnings([]);
      return;
    }

    if (!resourceState.lookup) {
      setEntryWarnings(['Local item reference data is not loaded yet.']);
      return;
    }

    const result = resolveLocalItemReference(trimmedQuery, resourceState.lookup);
    setMemoryState((currentState) =>
      setMemoryHelperSlotItem(currentState, {
        slotId: activeSlotId,
        itemName: result.displayName,
        canonicalKey: result.canonicalKey,
      }),
    );
    setActiveSlotId(null);
    setItemQuery('');
    setEntryWarnings(result.warnings);
  }

  function handleClearActiveSlot(): void {
    if (!activeSlotId) {
      return;
    }

    setMemoryState((currentState) => clearMemoryHelperSlot(currentState, activeSlotId));
    setActiveSlotId(null);
    setItemQuery('');
    setEntryWarnings([]);
  }

  function handleTogglePairMatched(pair: MemoryHelperPairGroup): void {
    setMemoryState((currentState) => setMemoryHelperPairMatched(currentState, pair.canonicalKey, !pair.matched));
  }

  function handleUndo(): void {
    setMemoryState((currentState) => undoMemoryHelperAction(currentState));
    setActiveSlotId(null);
    setItemQuery('');
    setEntryWarnings([]);
  }

  function handleReset(): void {
    setMemoryState((currentState) => resetMemoryHelperGame(currentState));
    setActiveSlotId(null);
    setItemQuery('');
    setEntryWarnings([]);
  }

  return (
    <div className="page-stack">
      <PageIntro
        title="Memory Helper"
        storageKey="memory-helper"
        description="Mirror the FarmRPG memory board locally as you reveal cards."
      />

      <section className="page-card page-stack" aria-labelledby="memory-helper-summary-title">
        <div className="section-heading-row">
          <div>
            <h2 id="memory-helper-summary-title">Board Status</h2>
            <p className="supporting-text">Tap a slot, enter the item you saw, then let matching items stand out.</p>
          </div>
          <div className="inline-control-row">
            <button
              className="button button--secondary"
              type="button"
              onClick={handleUndo}
              disabled={!memoryState.undoSlots}
            >
              Undo
            </button>
            <button
              className="button button--secondary"
              type="button"
              onClick={handleReset}
              disabled={derivation.summary.filledSlots === 0}
            >
              New Game
            </button>
          </div>
        </div>

        <dl className="summary-grid memory-helper-summary">
          <div className="summary-grid__item">
            <dt>Filled</dt>
            <dd>{derivation.summary.filledSlots} / 24</dd>
          </div>
          <div className="summary-grid__item">
            <dt>Pairs Found</dt>
            <dd>{derivation.summary.detectedPairs}</dd>
          </div>
          <div className="summary-grid__item">
            <dt>Matched</dt>
            <dd>{derivation.summary.matchedPairs} / 12</dd>
          </div>
          <div className="summary-grid__item">
            <dt>Remaining</dt>
            <dd>{derivation.summary.remainingPairs}</dd>
          </div>
        </dl>

        {resourceState.error ? <p className="status-message status-message--error">{resourceState.error}</p> : null}
        {derivation.warnings.length > 0 || entryWarnings.length > 0 ? (
          <div className="status-alert status-alert--warning page-stack" role="alert">
            {[...entryWarnings, ...derivation.warnings].map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        ) : null}
      </section>

      <section className="memory-helper-layout" aria-label="Memory helper workspace">
        <div className="page-card page-stack">
          <h2>Memory Board</h2>
          <div className="memory-helper-board" aria-label="6 by 4 memory helper board">
            {derivation.slots.map((slot) => {
              const iconSrc = slot.item ? getItemIconSrc(slot.item.canonicalKey) : null;
              const isActive = slot.slotId === activeSlotId;

              return (
                <button
                  key={slot.slotId}
                  className={[
                    'memory-helper-cell',
                    `memory-helper-cell--${slot.status}`,
                    isActive ? 'memory-helper-cell--active' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  type="button"
                  aria-label={
                    slot.item
                      ? `Slot row ${slot.row} column ${slot.column} ${slot.item.itemName}`
                      : `Slot row ${slot.row} column ${slot.column} empty`
                  }
                  aria-pressed={isActive}
                  onClick={() => handleActivateSlot(slot.slotId)}
                >
                  <span className="memory-helper-cell__position">{formatSlotPosition(slot.row, slot.column)}</span>
                  {iconSrc ? <img className="memory-helper-cell__icon" src={iconSrc} alt="" aria-hidden="true" /> : null}
                  <span className="memory-helper-cell__item">{slot.item?.itemName ?? 'Empty'}</span>
                  <span className="memory-helper-cell__status">{formatSlotStatus(slot.status)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="page-stack">
          <section className="page-card page-stack" aria-labelledby="memory-helper-entry-title">
            <h2 id="memory-helper-entry-title">Selected Slot</h2>
            {activeSlot ? (
              <form className="page-stack page-stack--tight" onSubmit={handleSubmitSlot}>
                <p className="supporting-text">
                  {formatSlotPosition(activeSlot.row, activeSlot.column)}
                  {activeSlot.item ? ` currently shows ${activeSlot.item.itemName}.` : ' is empty.'}
                </p>
                <label className="page-stack page-stack--tight" htmlFor="memory-helper-item">
                  Item
                  <input
                    id="memory-helper-item"
                    className="text-input"
                    type="text"
                    list={itemListId}
                    value={itemQuery}
                    onChange={(event) => setItemQuery(event.target.value)}
                    placeholder="Search item name"
                    autoComplete="off"
                    disabled={resourceState.isLoading}
                  />
                </label>
                <datalist id={itemListId}>
                  {itemOptions.map((option) => (
                    <option key={option.canonicalKey} value={option.itemName}>
                      {option.sourceLabel}
                    </option>
                  ))}
                </datalist>
                <div className="inline-control-row">
                  <button className="button" type="submit" disabled={resourceState.isLoading}>
                    Save Slot
                  </button>
                  <button className="button button--secondary" type="button" onClick={handleClearActiveSlot}>
                    Clear Slot
                  </button>
                </div>
              </form>
            ) : (
              <p className="empty-state">Tap a board slot to record a revealed item.</p>
            )}
          </section>

          <section className="page-card page-stack" aria-labelledby="memory-helper-pairs-title">
            <h2 id="memory-helper-pairs-title">Pairs</h2>
            {derivation.pairs.length > 0 ? (
              <ul className="memory-helper-pair-list">
                {derivation.pairs.map((pair) => (
                  <MemoryHelperPairRow key={pair.canonicalKey} pair={pair} onToggleMatched={handleTogglePairMatched} />
                ))}
              </ul>
            ) : (
              <p className="empty-state">Matching items will appear here once two slots use the same item.</p>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
