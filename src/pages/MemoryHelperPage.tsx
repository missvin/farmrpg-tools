import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';

import { ItemProfileLink } from '../components/ItemProfileLink';
import { PageIntro } from '../components/PageIntro';
import { downloadTextFile } from '../lib/appBackupExport';
import { getItemIcon } from '../lib/itemIconManifest';
import {
  loadMemoryGameAllowedItems,
  type MemoryGameAllowedItemEntry,
  type MemoryGameAllowedItemsData,
} from '../lib/loadMemoryGameAllowedItems';
import {
  createMemoryGameObservationExportFilename,
  loadMemoryGameObservationState,
  MEMORY_GAME_OBSERVATION_EXPORT_MIME_TYPE,
  recordMemoryGameObservation,
  saveMemoryGameObservationState,
  toMemoryGameObservationCsv,
  type MemoryGameObservationRecord,
  type MemoryGameObservationState,
} from '../lib/memoryGameObservationState';
import {
  loadLocalItemReferenceLookup,
  resolveLocalItemReference,
  type LocalItemReferenceLookup,
} from '../lib/localItemReferenceLookup';
import { toCanonicalItemKey } from '../lib/normalizeItemKey';
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
import {
  createUnknownItemEvidenceRecord,
  recordUnknownItemEvidence,
} from '../lib/unknownItemEvidence';

type ResourceState = {
  isLoading: boolean;
  error: string | null;
  lookup: LocalItemReferenceLookup | null;
  memoryGameItems: MemoryGameAllowedItemsData | null;
};

type ItemOption = {
  canonicalKey: string;
  itemName: string;
  sourceLabel: string;
};

type SeenOnceItemOption = ItemOption & {
  slotSummary: string;
};

const BORGENS_LOST_AND_FOUND_LABEL = "Borgen's Lost and Found";
const SUPPRESSED_MEMORY_HELPER_ENTRY_WARNINGS = new Set([
  'Recognized from museum completion canon only; do not infer mastery eligibility.',
]);

function getMemoryHelperEntryWarnings(warnings: string[]): string[] {
  return warnings.filter((warning) => !SUPPRESSED_MEMORY_HELPER_ENTRY_WARNINGS.has(warning));
}

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

  for (const entry of lookup.museumCanon?.entries ?? []) {
    if (optionsByCanonicalKey.has(entry.canonicalKey)) {
      continue;
    }

    optionsByCanonicalKey.set(entry.canonicalKey, {
      canonicalKey: entry.canonicalKey,
      itemName: entry.itemName,
      sourceLabel: 'Museum canon',
    });
  }

  return [...optionsByCanonicalKey.values()].sort((left, right) => {
    return left.itemName.localeCompare(right.itemName) || left.canonicalKey.localeCompare(right.canonicalKey);
  });
}

function buildMemoryGameItemOptions(memoryGameItems: MemoryGameAllowedItemsData): ItemOption[] {
  return [...memoryGameItems.entries]
    .sort(
      (left, right) =>
        right.observedSources.length - left.observedSources.length ||
        left.itemName.localeCompare(right.itemName) ||
        left.canonicalKey.localeCompare(right.canonicalKey),
    )
    .map((entry) => ({
      canonicalKey: entry.canonicalKey,
      itemName: entry.itemName,
      sourceLabel: BORGENS_LOST_AND_FOUND_LABEL,
    }));
}

function buildPersonalObservationItemOptions(observationState: MemoryGameObservationState): ItemOption[] {
  return [...observationState.records]
    .sort(
      (left, right) =>
        right.observationCount - left.observationCount ||
        right.lastSeenAt.localeCompare(left.lastSeenAt) ||
        left.itemName.localeCompare(right.itemName) ||
        left.canonicalKey.localeCompare(right.canonicalKey),
    )
    .map((entry) => ({
      canonicalKey: entry.canonicalKey,
      itemName: entry.itemName,
      sourceLabel:
        entry.observationCount === 1
          ? 'Observed locally once'
          : `Observed locally ${entry.observationCount} times`,
    }));
}

function getMemoryGameItemMeta(entry: MemoryGameAllowedItemEntry | undefined): string {
  if (!entry) {
    return BORGENS_LOST_AND_FOUND_LABEL;
  }

  return entry.observedSources.length > 1 ? `${entry.observedSources.length} observations` : BORGENS_LOST_AND_FOUND_LABEL;
}

function getItemIconSrc(canonicalKey: string): string | null {
  return getItemIcon(canonicalKey)?.src ?? null;
}

function getItemOptionSearchRank(option: ItemOption, rawQuery: string): number | null {
  const normalizedQuery = rawQuery.trim().toLowerCase();
  const canonicalQuery = toCanonicalItemKey(rawQuery);
  const canSearchName = normalizedQuery.length >= 2;
  const canSearchCanonicalKey = canonicalQuery.length >= 2;

  if (!canSearchName && !canSearchCanonicalKey) {
    return null;
  }

  const itemName = option.itemName.toLowerCase();

  if (
    (canSearchName && itemName === normalizedQuery) ||
    (canSearchCanonicalKey && option.canonicalKey === canonicalQuery)
  ) {
    return 0;
  }

  if (canSearchName && itemName.startsWith(normalizedQuery)) {
    return 1;
  }

  if (canSearchCanonicalKey && option.canonicalKey.startsWith(canonicalQuery)) {
    return 2;
  }

  if (canSearchName && itemName.includes(normalizedQuery)) {
    return 3;
  }

  if (canSearchCanonicalKey && option.canonicalKey.includes(canonicalQuery)) {
    return 4;
  }

  return null;
}

function rankMatchingItemOptions(itemOptions: ItemOption[], rawQuery: string): ItemOption[] {
  return itemOptions
    .map((option) => ({
      option,
      rank: getItemOptionSearchRank(option, rawQuery),
    }))
    .filter((entry): entry is { option: ItemOption; rank: number } => entry.rank !== null)
    .sort(
      (left, right) =>
        left.rank - right.rank ||
        left.option.itemName.localeCompare(right.option.itemName) ||
        left.option.canonicalKey.localeCompare(right.option.canonicalKey),
    )
    .slice(0, 8)
    .map((entry) => entry.option);
}

function filterItemOptions(
  itemOptions: ItemOption[],
  rawQuery: string,
  priorityItemOptions: ItemOption[],
): ItemOption[] {
  const filteredOptionsByCanonicalKey = new Map<string, ItemOption>();

  for (const option of rankMatchingItemOptions(priorityItemOptions, rawQuery)) {
    if (filteredOptionsByCanonicalKey.has(option.canonicalKey)) {
      continue;
    }

    filteredOptionsByCanonicalKey.set(option.canonicalKey, option);
  }

  for (const option of rankMatchingItemOptions(itemOptions, rawQuery)) {
    if (filteredOptionsByCanonicalKey.has(option.canonicalKey)) {
      continue;
    }

    filteredOptionsByCanonicalKey.set(option.canonicalKey, option);
  }

  return [...filteredOptionsByCanonicalKey.values()].slice(0, 8);
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
  const itemSuggestionListId = useId();
  const itemInputRef = useRef<HTMLInputElement | null>(null);
  const [memoryState, setMemoryState] = useState<MemoryHelperState>(() => loadMemoryHelperState());
  const [observationState, setObservationState] = useState<MemoryGameObservationState>(() =>
    loadMemoryGameObservationState(),
  );
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);
  const [itemQuery, setItemQuery] = useState('');
  const [entryWarnings, setEntryWarnings] = useState<string[]>([]);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [resourceState, setResourceState] = useState<ResourceState>({
    isLoading: true,
    error: null,
    lookup: null,
    memoryGameItems: null,
  });

  useEffect(() => {
    let isMounted = true;

    Promise.all([loadLocalItemReferenceLookup(), loadMemoryGameAllowedItems()])
      .then(([lookup, memoryGameItems]) => {
        if (!isMounted) {
          return;
        }

        setResourceState({
          isLoading: false,
          error: null,
          lookup,
          memoryGameItems,
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
          memoryGameItems: null,
        });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    saveMemoryHelperState(memoryState);
  }, [memoryState]);

  useEffect(() => {
    saveMemoryGameObservationState(observationState);
  }, [observationState]);

  const derivation = useMemo(() => deriveMemoryHelperBoard(memoryState), [memoryState]);
  const activeSlot = activeSlotId ? memoryState.slots.find((slot) => slot.slotId === activeSlotId) ?? null : null;
  const itemOptions = useMemo(
    () => (resourceState.lookup ? buildItemOptions(resourceState.lookup) : []),
    [resourceState.lookup],
  );
  const memoryGameItemOptions = useMemo(
    () => (resourceState.memoryGameItems ? buildMemoryGameItemOptions(resourceState.memoryGameItems) : []),
    [resourceState.memoryGameItems],
  );
  const personalObservationItemOptions = useMemo(
    () => buildPersonalObservationItemOptions(observationState),
    [observationState],
  );
  const personalObservationRecordsByCanonicalKey = useMemo(() => {
    const recordsByCanonicalKey = new Map<string, MemoryGameObservationRecord>();

    for (const record of observationState.records) {
      recordsByCanonicalKey.set(record.canonicalKey, record);
    }

    return recordsByCanonicalKey;
  }, [observationState.records]);
  const memoryGameEntriesByCanonicalKey = resourceState.memoryGameItems?.byCanonicalKey ?? {};
  const seenOnceItemOptions = useMemo<SeenOnceItemOption[]>(() => {
    const optionsByCanonicalKey = new Map<string, { itemName: string; canonicalKey: string; slotIds: string[] }>();

    for (const slot of derivation.slots) {
      if (!slot.item || slot.status !== 'single' || slot.slotId === activeSlotId) {
        continue;
      }

      const existingOption = optionsByCanonicalKey.get(slot.item.canonicalKey);

      if (existingOption) {
        existingOption.slotIds.push(slot.slotId);
        continue;
      }

      optionsByCanonicalKey.set(slot.item.canonicalKey, {
        itemName: slot.item.itemName,
        canonicalKey: slot.item.canonicalKey,
        slotIds: [slot.slotId],
      });
    }

    return [...optionsByCanonicalKey.values()]
      .map((option) => {
        const slotSummary = formatSlotSummary(option.slotIds);

        return {
          canonicalKey: option.canonicalKey,
          itemName: option.itemName,
          sourceLabel: `Seen ${slotSummary}`,
          slotSummary,
        };
      })
      .sort((left, right) => left.itemName.localeCompare(right.itemName));
  }, [activeSlotId, derivation.slots]);
  const seenOnceOptionKeys = useMemo(
    () => new Set(seenOnceItemOptions.map((option) => option.canonicalKey)),
    [seenOnceItemOptions],
  );
  const filteredItemOptions = useMemo(
    () =>
      filterItemOptions(itemOptions, itemQuery, [
        ...seenOnceItemOptions,
        ...personalObservationItemOptions,
        ...memoryGameItemOptions,
      ]),
    [itemOptions, itemQuery, memoryGameItemOptions, personalObservationItemOptions, seenOnceItemOptions],
  );
  const memoryGameQuickPickOptions = useMemo(() => {
    const activeCanonicalKey = activeSlot?.item?.canonicalKey ?? null;
    const quickPickOptionsByCanonicalKey = new Map<string, ItemOption>();

    for (const option of [...personalObservationItemOptions, ...memoryGameItemOptions]) {
      if (quickPickOptionsByCanonicalKey.has(option.canonicalKey)) {
        continue;
      }

      quickPickOptionsByCanonicalKey.set(option.canonicalKey, option);
    }

    const candidates =
      itemQuery.trim().length >= 2
        ? rankMatchingItemOptions([...quickPickOptionsByCanonicalKey.values()], itemQuery)
        : [...quickPickOptionsByCanonicalKey.values()];

    return candidates
      .filter((option) => option.canonicalKey !== activeCanonicalKey && !seenOnceOptionKeys.has(option.canonicalKey))
      .slice(0, 12);
  }, [
    activeSlot?.item?.canonicalKey,
    itemQuery,
    memoryGameItemOptions,
    personalObservationItemOptions,
    seenOnceOptionKeys,
  ]);
  const memoryGameOptionKeys = useMemo(
    () => new Set(memoryGameItemOptions.map((option) => option.canonicalKey)),
    [memoryGameItemOptions],
  );
  const personalObservationOptionKeys = useMemo(
    () => new Set(personalObservationItemOptions.map((option) => option.canonicalKey)),
    [personalObservationItemOptions],
  );
  const shouldShowItemSuggestions = Boolean(activeSlot) && itemQuery.trim().length >= 2 && !resourceState.isLoading;
  const activeSuggestionId =
    shouldShowItemSuggestions && activeSuggestionIndex >= 0 && filteredItemOptions[activeSuggestionIndex]
      ? `${itemSuggestionListId}-option-${activeSuggestionIndex}`
      : undefined;

  useEffect(() => {
    setActiveSuggestionIndex(filteredItemOptions.length > 0 ? 0 : -1);
  }, [filteredItemOptions.length, itemQuery]);

  useEffect(() => {
    if (!activeSlotId || !itemInputRef.current) {
      return;
    }

    itemInputRef.current.focus();
    itemInputRef.current.select();
  }, [activeSlotId]);

  function handleActivateSlot(slotId: string): void {
    const slot = memoryState.slots.find((entry) => entry.slotId === slotId);
    setActiveSlotId(slotId);
    setItemQuery(slot?.item?.itemName ?? '');
    setEntryWarnings([]);
  }

  function saveItemToActiveSlot(inputName: string): void {
    if (!activeSlotId) {
      return;
    }

    if (!resourceState.lookup) {
      setEntryWarnings(['Local item reference data is not loaded yet.']);
      return;
    }

    const result = resolveLocalItemReference(inputName, resourceState.lookup);
    const shownWarnings = getMemoryHelperEntryWarnings(result.warnings);

    if (!result.recognized) {
      const evidenceRecord = createUnknownItemEvidenceRecord({
        sourceType: 'lost_and_found',
        sourceLabel: BORGENS_LOST_AND_FOUND_LABEL,
        observedName: inputName,
        sampleContext: `${formatSlotPosition(activeSlot?.row ?? 0, activeSlot?.column ?? 0)} entry`,
        warningText: result.warnings.join('; '),
      });

      recordUnknownItemEvidence(evidenceRecord ? [evidenceRecord] : []);
    }

    setObservationState((currentState) =>
      recordMemoryGameObservation(currentState, {
        itemName: result.displayName,
        canonicalKey: result.canonicalKey,
        observedTier: '4',
        sessionId: memoryState.updatedAt,
        slotSummary: formatSlotPosition(activeSlot?.row ?? 0, activeSlot?.column ?? 0),
        warningTexts: result.recognized ? [] : shownWarnings,
      }),
    );

    setMemoryState((currentState) =>
      setMemoryHelperSlotItem(currentState, {
        slotId: activeSlotId,
        itemName: result.displayName,
        canonicalKey: result.canonicalKey,
      }),
    );
    setActiveSlotId(null);
    setItemQuery('');
    setExportStatus(null);
    setEntryWarnings(shownWarnings);
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

    saveItemToActiveSlot(trimmedQuery);
  }

  function handleItemQueryChange(value: string): void {
    setItemQuery(value);
    setEntryWarnings([]);
  }

  function handleSelectItemOption(option: ItemOption): void {
    saveItemToActiveSlot(option.itemName);
  }

  function handleExportObservations(): void {
    if (observationState.records.length === 0) {
      setExportStatus('No local Lost and Found observations to export yet.');
      return;
    }

    const exportedAt = new Date().toISOString();
    downloadTextFile(
      createMemoryGameObservationExportFilename(exportedAt),
      toMemoryGameObservationCsv(observationState),
      MEMORY_GAME_OBSERVATION_EXPORT_MIME_TYPE,
    );
    setExportStatus(`Exported ${observationState.records.length} observed item rows for review.`);
  }

  function handleItemInputKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Escape') {
      setActiveSuggestionIndex(-1);
      return;
    }

    if (!shouldShowItemSuggestions || filteredItemOptions.length === 0) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSuggestionIndex((currentIndex) =>
        currentIndex < 0 ? 0 : (currentIndex + 1) % filteredItemOptions.length,
      );
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSuggestionIndex((currentIndex) =>
        currentIndex < 0
          ? filteredItemOptions.length - 1
          : (currentIndex - 1 + filteredItemOptions.length) % filteredItemOptions.length,
      );
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      handleSelectItemOption(filteredItemOptions[activeSuggestionIndex] ?? filteredItemOptions[0]);
    }
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
    setActiveSuggestionIndex(-1);
  }

  function handleReset(): void {
    setMemoryState((currentState) => resetMemoryHelperGame(currentState));
    setActiveSlotId(null);
    setItemQuery('');
    setEntryWarnings([]);
    setActiveSuggestionIndex(-1);
  }

  return (
    <div className="page-stack">
      <PageIntro
        title={BORGENS_LOST_AND_FOUND_LABEL}
        storageKey="memory-helper"
        description="Mirror Borgen's Lost and Found board locally as you reveal cards."
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

        <div className="memory-helper-observation-summary">
          <div>
            <strong>{observationState.records.length}</strong>{' '}
            <span className="subtle-text">locally observed Lost and Found items</span>
          </div>
          <button
            className="button button--secondary"
            type="button"
            onClick={handleExportObservations}
            disabled={observationState.records.length === 0}
          >
            Export Observations
          </button>
        </div>
        {exportStatus ? <p className="supporting-text">{exportStatus}</p> : null}

        {resourceState.error ? <p className="status-message status-message--error">{resourceState.error}</p> : null}
        {derivation.warnings.length > 0 || entryWarnings.length > 0 ? (
          <div className="status-alert status-alert--warning page-stack" role="alert">
            {[...entryWarnings, ...derivation.warnings].map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        ) : null}
      </section>

      <section className="memory-helper-layout" aria-label="Borgen's Lost and Found workspace">
        <div className="page-card page-stack">
          <h2>Lost and Found Board</h2>
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
                    slot.item ? 'memory-helper-cell--has-item' : 'memory-helper-cell--empty',
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
                <div className="page-stack page-stack--tight memory-helper-picker">
                  <label className="field-label" htmlFor="memory-helper-item">
                    Item
                  </label>
                  <input
                    id="memory-helper-item"
                    ref={itemInputRef}
                    className="text-input"
                    type="text"
                    value={itemQuery}
                    onChange={(event) => handleItemQueryChange(event.target.value)}
                    onKeyDown={handleItemInputKeyDown}
                    placeholder="Search item name"
                    autoComplete="off"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-controls={shouldShowItemSuggestions ? itemSuggestionListId : undefined}
                    aria-expanded={shouldShowItemSuggestions}
                    aria-activedescendant={activeSuggestionId}
                    disabled={resourceState.isLoading}
                  />
                  {shouldShowItemSuggestions ? (
                    filteredItemOptions.length > 0 ? (
                      <ul
                        id={itemSuggestionListId}
                        className="memory-helper-suggestion-list"
                        role="listbox"
                        aria-label="Matching items"
                      >
                        {filteredItemOptions.map((option, optionIndex) => {
                          const iconSrc = getItemIconSrc(option.canonicalKey);
                          const isActiveSuggestion = optionIndex === activeSuggestionIndex;

                          return (
                            <li
                              key={option.canonicalKey}
                              id={`${itemSuggestionListId}-option-${optionIndex}`}
                              role="option"
                              aria-selected={isActiveSuggestion}
                            >
                              <button
                                className={`memory-helper-suggestion${
                                  isActiveSuggestion ? ' memory-helper-suggestion--active' : ''
                                }`}
                                type="button"
                                onClick={() => handleSelectItemOption(option)}
                              >
                                <span className="memory-helper-suggestion__item">
                                  {iconSrc ? (
                                    <img
                                      className="memory-helper-suggestion__icon"
                                      src={iconSrc}
                                      alt=""
                                      aria-hidden="true"
                                      loading="lazy"
                                    />
                                  ) : null}
                                  <span className="memory-helper-suggestion__name">{option.itemName}</span>
                                </span>
                                <span className="memory-helper-suggestion__meta">
                                  {option.sourceLabel.startsWith('Seen ')
                                    ? option.sourceLabel
                                    : personalObservationOptionKeys.has(option.canonicalKey)
                                      ? option.sourceLabel
                                    : memoryGameOptionKeys.has(option.canonicalKey)
                                      ? BORGENS_LOST_AND_FOUND_LABEL
                                      : option.sourceLabel}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="empty-state">No local item matches. Saving will keep the typed name.</p>
                    )
                  ) : null}
                </div>
                <div className="inline-control-row">
                  <button className="button" type="submit" disabled={resourceState.isLoading}>
                    Save Slot
                  </button>
                  <button className="button button--secondary" type="button" onClick={handleClearActiveSlot}>
                    Clear Slot
                  </button>
                </div>
                {seenOnceItemOptions.length > 0 ? (
                  <section className="memory-helper-seen-once page-stack page-stack--tight" aria-labelledby="memory-helper-seen-once-title">
                    <h3 id="memory-helper-seen-once-title" className="section-title">
                      Seen Once
                    </h3>
                    <ul className="memory-helper-seen-once-list">
                      {seenOnceItemOptions.map((option) => {
                        const iconSrc = getItemIconSrc(option.canonicalKey);

                        return (
                          <li key={option.canonicalKey}>
                            <button
                              className="memory-helper-seen-once-button"
                              type="button"
                              aria-label={`Use ${option.itemName} from ${option.slotSummary}`}
                              onClick={() => handleSelectItemOption(option)}
                            >
                              <span className="memory-helper-suggestion__item">
                                {iconSrc ? (
                                  <img
                                    className="memory-helper-suggestion__icon"
                                    src={iconSrc}
                                    alt=""
                                    aria-hidden="true"
                                    loading="lazy"
                                  />
                                ) : null}
                                <span className="memory-helper-suggestion__name">{option.itemName}</span>
                              </span>
                              <span className="memory-helper-suggestion__meta">{option.slotSummary}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ) : null}
                {memoryGameQuickPickOptions.length > 0 ? (
                  <section
                    className="memory-helper-observed-items page-stack page-stack--tight"
                    aria-labelledby="memory-helper-observed-items-title"
                  >
                    <h3 id="memory-helper-observed-items-title" className="section-title">
                      Observed Items
                    </h3>
                    <ul className="memory-helper-observed-item-list">
                      {memoryGameQuickPickOptions.map((option) => {
                        const iconSrc = getItemIconSrc(option.canonicalKey);
                        const memoryGameEntry = memoryGameEntriesByCanonicalKey[option.canonicalKey];
                        const personalObservationRecord = personalObservationRecordsByCanonicalKey.get(
                          option.canonicalKey,
                        );

                        return (
                          <li key={option.canonicalKey}>
                            <button
                              className="memory-helper-observed-item-button"
                              type="button"
                              aria-label={`Use observed ${option.itemName}`}
                              title={option.itemName}
                              onClick={() => handleSelectItemOption(option)}
                            >
                              <span className="memory-helper-suggestion__item">
                                {iconSrc ? (
                                  <img
                                    className="memory-helper-suggestion__icon"
                                    src={iconSrc}
                                    alt=""
                                    aria-hidden="true"
                                    loading="lazy"
                                  />
                                ) : null}
                                <span className="memory-helper-suggestion__name">{option.itemName}</span>
                              </span>
                              <span className="memory-helper-suggestion__meta">
                                {personalObservationRecord ? option.sourceLabel : getMemoryGameItemMeta(memoryGameEntry)}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ) : null}
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

      <div className="memory-helper-scroll-align-spacer" aria-hidden="true" />
    </div>
  );
}
