import { type CSSProperties, useEffect, useMemo, useState } from 'react';

import { useSearchParams } from 'react-router-dom';

import { ItemProfileLink } from '../components/ItemProfileLink';
import { PageIntro } from '../components/PageIntro';
import {
  deriveCraftMaterialMatrix,
  type CraftMaterialMatrixPathType,
  type CraftMaterialMatrixRow,
} from '../lib/craftMaterialMatrix';
import {
  CRAFT_MATERIAL_MATRIX_FAMILIES,
  classifyCraftMaterialMatrixRow,
  type CraftMaterialMatrixFamilyId,
} from '../lib/craftMaterialMatrixFamilies';
import { getItemIcon } from '../lib/itemIconManifest';
import { loadRecipeGraph, type RecipeGraph } from '../lib/loadRecipeGraph';
import { loadTowerRequirements, type TowerMasteryLevelNeeded, type TowerRequirementsData } from '../lib/loadTowerRequirements';
import { toCanonicalItemKey } from '../lib/normalizeItemKey';
import { getLatestSnapshot, type MasterySnapshot } from '../lib/storage/masterySnapshots';

type ResourceState = {
  isLoading: boolean;
  error: string | null;
  recipeGraph: RecipeGraph | null;
  towerRequirementsData: TowerRequirementsData | null;
  snapshot: MasterySnapshot | null;
};

type SeedOption = {
  canonicalKey: string;
  itemName: string;
  recipeCount: number;
};

type TowerFilter = 'all' | 'tower' | 'unfinishedTower';
type PathFilter = 'all' | CraftMaterialMatrixPathType;
type FamilyFilter = 'all' | CraftMaterialMatrixFamilyId;
type TargetFilter = 'all' | TowerMasteryLevelNeeded;
type AchievedFilter = 'all' | 'achieved' | 'unachieved';
type SortField = 'towerLevel' | 'remainingMastery' | 'seedQuantity' | 'family' | 'itemName';

type DisplayMatrixRow = CraftMaterialMatrixRow & {
  familyId: CraftMaterialMatrixFamilyId;
  familyLabel: string;
};

type PivotCell = {
  row: DisplayMatrixRow;
  fillPercent: number;
  statusLabel: string;
  tooltip: string;
  ariaLabel: string;
};

type PivotRow = {
  familyId: CraftMaterialMatrixFamilyId;
  familyLabel: string;
  cellsBySeedKey: Map<string, PivotCell>;
};

const DYE_SEEDS = [
  'Black Dye',
  'Blue Dye',
  'Brown Dye',
  'Green Dye',
  'Orange Dye',
  'Purple Dye',
  'Red Dye',
  'White Dye',
  'Yellow Dye',
];

const COLORED_TWINE_SEEDS = [
  'Black Twine',
  'Blue Twine',
  'Brown Twine',
  'Green Twine',
  'Orange Twine',
  'Purple Twine',
  'Red Twine',
  'White Twine',
  'Yellow Twine',
];

const PRESETS: Array<{ label: string; seeds: string[] }> = [
  {
    label: 'Tower color crafts',
    seeds: [
      ...DYE_SEEDS,
      'Twine',
      ...COLORED_TWINE_SEEDS,
      'Leather',
      'Leather Bag',
      'Black Bag',
      'Brown Bag',
      'White Bag',
      'Coin Purse',
      'Black Purse',
      'White Purse',
      'Brown Purse',
    ],
  },
  {
    label: 'Dyes',
    seeds: DYE_SEEDS,
  },
  {
    label: 'Colored twine',
    seeds: ['Twine', ...COLORED_TWINE_SEEDS],
  },
  {
    label: 'Bags, purses, and cloaks',
    seeds: ['Leather', 'Leather Bag', 'Black Bag', 'Brown Bag', 'White Bag', 'Coin Purse', 'Black Twine', 'Brown Dye'],
  },
  {
    label: 'Frequent materials',
    seeds: ['Twine', 'Leather', 'Mushroom Paste', 'Board', 'Glass Bottle', 'Iron', 'Hammer'],
  },
];

const PIVOT_FAMILY_ORDER: CraftMaterialMatrixFamilyId[] = [
  'bag',
  'butterfly',
  'scarf',
  'shield',
  'twine',
  'cloak',
  'purse',
  'shirt',
  'dye',
  'other_dye_uses',
  'colored_twine_uses',
  'other_raw_color_uses',
];

function formatAmount(value: number): string {
  return Math.round(value).toLocaleString();
}

function getIconSrc(canonicalKey: string): string | null {
  return getItemIcon(canonicalKey)?.src ?? null;
}

function getSeedOptions(recipeGraph: RecipeGraph | null): SeedOption[] {
  if (!recipeGraph) {
    return [];
  }

  return Object.entries(recipeGraph.byInputCanonicalKey)
    .map(([canonicalKey, recipes]) => {
      const itemName = recipes
        .flatMap((recipe) => recipe.inputs)
        .find((input) => input.canonicalKey === canonicalKey)?.itemName;

      return {
        canonicalKey,
        itemName: itemName ?? canonicalKey,
        recipeCount: recipes.length,
      };
    })
    .sort((left, right) => left.itemName.localeCompare(right.itemName));
}

function getPresetSeedKeys(presetSeeds: string[], optionsByKey: Map<string, SeedOption>): string[] {
  return presetSeeds.map((seed) => toCanonicalItemKey(seed)).filter((seedKey) => optionsByKey.has(seedKey));
}

function getBestTowerLevel(row: CraftMaterialMatrixRow): number | null {
  return row.towerTargets.flatMap((target) => target.levels)[0] ?? null;
}

function getBestRemainingMastery(row: CraftMaterialMatrixRow): number | null {
  const unfinishedTargets = row.towerTargets.filter((target) => !target.achieved);
  const target = unfinishedTargets[0] ?? row.towerTargets[0] ?? null;
  return target?.remainingToRequirement ?? null;
}

function getPrimaryTowerTarget(row: CraftMaterialMatrixRow): CraftMaterialMatrixRow['towerTargets'][number] | null {
  return row.towerTargets.find((target) => !target.achieved) ?? row.towerTargets[0] ?? null;
}

function getTowerLevelTooltip(row: CraftMaterialMatrixRow): string {
  return row.towerTargets
    .map((target) => `${target.masteryLevelNeeded} Tower ${target.levels.join(', ')}`)
    .join('; ');
}

function matchesTargetFilter(row: CraftMaterialMatrixRow, targetFilter: TargetFilter): boolean {
  return targetFilter === 'all' || row.towerTargets.some((target) => target.masteryLevelNeeded === targetFilter);
}

function matchesAchievedFilter(row: CraftMaterialMatrixRow, achievedFilter: AchievedFilter): boolean {
  if (achievedFilter === 'all') {
    return true;
  }

  if (row.towerTargets.length === 0) {
    return achievedFilter === 'unachieved';
  }

  const allAchieved = row.towerTargets.every((target) => target.achieved);
  return achievedFilter === 'achieved' ? allAchieved : !allAchieved;
}

function sortRows(rows: DisplayMatrixRow[], sortField: SortField): DisplayMatrixRow[] {
  return [...rows].sort((left, right) => {
    if (sortField === 'itemName') {
      return left.outputItemName.localeCompare(right.outputItemName) || left.seedItemName.localeCompare(right.seedItemName);
    }

    if (sortField === 'family') {
      return (
        left.familyLabel.localeCompare(right.familyLabel) ||
        left.outputItemName.localeCompare(right.outputItemName) ||
        left.seedItemName.localeCompare(right.seedItemName)
      );
    }

    if (sortField === 'seedQuantity') {
      return right.consumedSeedQuantity - left.consumedSeedQuantity || left.outputItemName.localeCompare(right.outputItemName);
    }

    if (sortField === 'remainingMastery') {
      const leftRemaining = getBestRemainingMastery(left) ?? Number.POSITIVE_INFINITY;
      const rightRemaining = getBestRemainingMastery(right) ?? Number.POSITIVE_INFINITY;
      return leftRemaining - rightRemaining || left.outputItemName.localeCompare(right.outputItemName);
    }

    const leftLevel = getBestTowerLevel(left) ?? Number.POSITIVE_INFINITY;
    const rightLevel = getBestTowerLevel(right) ?? Number.POSITIVE_INFINITY;
    return leftLevel - rightLevel || left.outputItemName.localeCompare(right.outputItemName);
  });
}

function describePathType(pathType: CraftMaterialMatrixPathType): string {
  return pathType === 'direct' ? 'Direct use' : 'One-step downstream';
}

function withFamily(row: CraftMaterialMatrixRow): DisplayMatrixRow {
  const family = classifyCraftMaterialMatrixRow(row);
  return {
    ...row,
    familyId: family.id,
    familyLabel: family.label,
  };
}

function TowerTargets({ row }: { row: CraftMaterialMatrixRow }) {
  if (row.towerTargets.length === 0) {
    return <span className="muted-text">No Tower target</span>;
  }

  return (
    <div className="material-matrix__tower-targets">
      {row.towerTargets.map((target) => (
        <span
          className={`pill ${target.achieved ? 'pill--success' : 'pill--warning'}`}
          key={`${target.masteryLevelNeeded}:${target.requiredThreshold}`}
        >
          {target.masteryLevelNeeded} L{target.levels.join(', ')}
          {' · '}
          {target.achieved ? 'done' : `${formatAmount(target.remainingToRequirement)} left`}
        </span>
      ))}
    </div>
  );
}

function RecipeSummary({ row }: { row: CraftMaterialMatrixRow }) {
  return (
    <span>
      {row.outputRecipe.inputs.map((input, index) => (
        <span key={`${row.outputCanonicalKey}:${input.canonicalKey}`}>
          {index > 0 ? ', ' : ''}
          {formatAmount(input.quantity)} {input.itemName}
        </span>
      ))}
    </span>
  );
}

function PathSummary({ row }: { row: CraftMaterialMatrixRow }) {
  return (
    <span>
      {row.path.map((step, index) => (
        <span key={`${step.inputCanonicalKey}:${step.outputCanonicalKey}:${index}`}>
          {index > 0 ? ' -> ' : ''}
          {step.inputItemName} x{formatAmount(step.quantity)} {'->'} {step.outputItemName}
        </span>
      ))}
    </span>
  );
}

function comparePivotCandidates(left: DisplayMatrixRow, right: DisplayMatrixRow): number {
  const leftTarget = getPrimaryTowerTarget(left);
  const rightTarget = getPrimaryTowerTarget(right);
  const leftDone = leftTarget?.achieved ?? true;
  const rightDone = rightTarget?.achieved ?? true;

  if (leftDone !== rightDone) {
    return leftDone ? 1 : -1;
  }

  const leftLevel = getBestTowerLevel(left) ?? Number.POSITIVE_INFINITY;
  const rightLevel = getBestTowerLevel(right) ?? Number.POSITIVE_INFINITY;

  if (leftLevel !== rightLevel) {
    return leftLevel - rightLevel;
  }

  return left.outputItemName.localeCompare(right.outputItemName);
}

function buildPivotRows(rows: DisplayMatrixRow[], selectedSeedKeys: string[]): PivotRow[] {
  const selectedSeedSet = new Set(selectedSeedKeys);
  const cellRows = rows
    .filter((row) => row.towerRelevant)
    .filter((row) => selectedSeedSet.has(row.seedCanonicalKey));
  const pivotRowsByFamily = new Map<CraftMaterialMatrixFamilyId, PivotRow>();

  for (const row of cellRows) {
    const target = getPrimaryTowerTarget(row);

    if (!target) {
      continue;
    }

    const pivotRow = pivotRowsByFamily.get(row.familyId) ?? {
      familyId: row.familyId,
      familyLabel: row.familyLabel,
      cellsBySeedKey: new Map<string, PivotCell>(),
    };
    const existingCell = pivotRow.cellsBySeedKey.get(row.seedCanonicalKey);

    if (existingCell && comparePivotCandidates(existingCell.row, row) <= 0) {
      pivotRowsByFamily.set(row.familyId, pivotRow);
      continue;
    }

    const fillPercent = Math.max(0, Math.min(100, Math.floor((target.currentMastery / target.requiredThreshold) * 100)));
    const statusLabel = target.achieved ? 'Done' : target.masteryLevelNeeded;
    const tooltip = `${row.outputItemName}: ${getTowerLevelTooltip(row)}; ${formatAmount(target.currentMastery)} of ${formatAmount(
      target.requiredThreshold,
    )} mastery.`;

    pivotRow.cellsBySeedKey.set(row.seedCanonicalKey, {
      row,
      fillPercent,
      statusLabel,
      tooltip,
      ariaLabel: `${row.outputItemName}, ${statusLabel}, ${fillPercent}% complete. ${getTowerLevelTooltip(row)}.`,
    });
    pivotRowsByFamily.set(row.familyId, pivotRow);
  }

  return [...pivotRowsByFamily.values()].sort((left, right) => {
    const leftIndex = PIVOT_FAMILY_ORDER.indexOf(left.familyId);
    const rightIndex = PIVOT_FAMILY_ORDER.indexOf(right.familyId);

    if (leftIndex !== rightIndex) {
      return (leftIndex === -1 ? Number.POSITIVE_INFINITY : leftIndex) - (rightIndex === -1 ? Number.POSITIVE_INFINITY : rightIndex);
    }

    return left.familyLabel.localeCompare(right.familyLabel);
  });
}

function TowerColorPivotMatrix({
  pivotRows,
  selectedSeedKeys,
  optionsByKey,
}: {
  pivotRows: PivotRow[];
  selectedSeedKeys: string[];
  optionsByKey: Map<string, SeedOption>;
}) {
  const columnSeedKeys = selectedSeedKeys.filter((seedKey) => pivotRows.some((row) => row.cellsBySeedKey.has(seedKey)));

  if (pivotRows.length === 0 || columnSeedKeys.length === 0) {
    return (
      <section className="page-card page-stack" aria-labelledby="tower-color-matrix-heading">
        <div>
          <h2 id="tower-color-matrix-heading">Tower Color Matrix</h2>
          <p className="muted-text">No Tower color craft cells match the selected materials yet.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="page-card page-stack" aria-labelledby="tower-color-matrix-heading">
      <div>
        <h2 id="tower-color-matrix-heading">Tower Color Matrix</h2>
        <p className="muted-text">Scan color craft families at a glance. Hover or focus a cell for Tower levels.</p>
      </div>
      <div className="material-matrix-pivot-scroll">
        <table className="material-matrix-pivot" aria-label="Tower color craft pivot matrix">
          <thead>
            <tr>
              <th scope="col">Family</th>
              {columnSeedKeys.map((seedKey) => {
                const option = optionsByKey.get(seedKey);
                const iconSrc = getIconSrc(seedKey);

                return (
                  <th scope="col" key={seedKey}>
                    <span className="material-matrix-pivot__column-heading">
                      {iconSrc ? <img className="item-icon" src={iconSrc} alt="" aria-hidden="true" /> : null}
                      <span>{option?.itemName ?? seedKey}</span>
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pivotRows.map((pivotRow) => (
              <tr key={pivotRow.familyId}>
                <th scope="row">{pivotRow.familyLabel}</th>
                {columnSeedKeys.map((seedKey) => {
                  const cell = pivotRow.cellsBySeedKey.get(seedKey);

                  if (!cell) {
                    return (
                      <td className="material-matrix-pivot__empty-cell" key={seedKey}>
                        <span aria-hidden="true">-</span>
                      </td>
                    );
                  }

                  const iconSrc = getIconSrc(cell.row.outputCanonicalKey);

                  return (
                    <td key={seedKey}>
                      <a
                        className={`material-matrix-pivot__cell ${cell.statusLabel === 'Done' ? 'material-matrix-pivot__cell--done' : ''}`}
                        href={cell.row.outputProfilePath}
                        title={cell.tooltip}
                        aria-label={cell.ariaLabel}
                        style={{ '--matrix-cell-fill': `${cell.fillPercent}%` } as CSSProperties}
                      >
                        <span className="material-matrix-pivot__cell-content">
                          {iconSrc ? <img className="item-icon" src={iconSrc} alt="" aria-hidden="true" /> : null}
                          <span className="material-matrix-pivot__item-name">{cell.row.outputItemName}</span>
                          <span className="material-matrix-pivot__status">{cell.statusLabel}</span>
                          <span className="material-matrix-pivot__percent">{cell.fillPercent}%</span>
                        </span>
                      </a>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function CraftMaterialMatrixPage() {
  const [searchParams] = useSearchParams();
  const [resourcesState, setResourcesState] = useState<ResourceState>({
    isLoading: true,
    error: null,
    recipeGraph: null,
    towerRequirementsData: null,
    snapshot: null,
  });
  const [selectedSeedKeys, setSelectedSeedKeys] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');
  const [towerFilter, setTowerFilter] = useState<TowerFilter>('unfinishedTower');
  const [pathFilter, setPathFilter] = useState<PathFilter>('all');
  const [familyFilter, setFamilyFilter] = useState<FamilyFilter>('all');
  const [targetFilter, setTargetFilter] = useState<TargetFilter>('all');
  const [achievedFilter, setAchievedFilter] = useState<AchievedFilter>('all');
  const [sortField, setSortField] = useState<SortField>('towerLevel');

  useEffect(() => {
    let isMounted = true;

    void Promise.all([loadRecipeGraph(), loadTowerRequirements(), getLatestSnapshot()])
      .then(([recipeGraph, towerRequirementsData, snapshot]) => {
        if (!isMounted) {
          return;
        }

        setResourcesState({
          isLoading: false,
          error: null,
          recipeGraph,
          towerRequirementsData,
          snapshot,
        });
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        setResourcesState({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unable to load craft material matrix inputs.',
          recipeGraph: null,
          towerRequirementsData: null,
          snapshot: null,
        });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const seedOptions = useMemo(() => getSeedOptions(resourcesState.recipeGraph), [resourcesState.recipeGraph]);
  const optionsByKey = useMemo(
    () => new Map(seedOptions.map((option) => [option.canonicalKey, option])),
    [seedOptions],
  );

  useEffect(() => {
    if (selectedSeedKeys.length > 0 || seedOptions.length === 0) {
      return;
    }

    const seedParam = searchParams.get('seed');
    const seedParamKey = seedParam ? toCanonicalItemKey(seedParam) : '';

    if (seedParamKey && optionsByKey.has(seedParamKey)) {
      setSelectedSeedKeys([seedParamKey]);
      return;
    }

    const defaultPreset = getPresetSeedKeys(PRESETS[0].seeds, optionsByKey);
    setSelectedSeedKeys(defaultPreset.length > 0 ? defaultPreset : [seedOptions[0].canonicalKey]);
  }, [optionsByKey, searchParams, seedOptions, selectedSeedKeys.length]);

  const filteredSeedOptions = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();
    const selectedKeys = new Set(selectedSeedKeys);

    return seedOptions
      .filter((option) => !selectedKeys.has(option.canonicalKey))
      .filter((option) => {
        if (!normalizedSearch) {
          return true;
        }

        return option.itemName.toLowerCase().includes(normalizedSearch) || option.canonicalKey.includes(normalizedSearch);
      })
      .slice(0, 8);
  }, [searchText, seedOptions, selectedSeedKeys]);

  const matrixResult = useMemo(() => {
    if (!resourcesState.recipeGraph) {
      return null;
    }

    return deriveCraftMaterialMatrix({
      seedCanonicalKeys: selectedSeedKeys,
      recipeGraph: resourcesState.recipeGraph,
      towerRequirementsData: resourcesState.towerRequirementsData,
      snapshot: resourcesState.snapshot,
      maxDepth: 1,
    });
  }, [
    resourcesState.recipeGraph,
    resourcesState.snapshot,
    resourcesState.towerRequirementsData,
    selectedSeedKeys,
  ]);

  const visibleRows = useMemo(() => {
    const rows = (matrixResult?.rows ?? []).map(withFamily);

    return sortRows(
      rows.filter((row) => {
        if (towerFilter === 'tower' && !row.towerRelevant) {
          return false;
        }

        if (towerFilter === 'unfinishedTower' && (!row.towerRelevant || row.towerTargets.every((target) => target.achieved))) {
          return false;
        }

        if (pathFilter !== 'all' && row.pathType !== pathFilter) {
          return false;
        }

        if (familyFilter !== 'all' && row.familyId !== familyFilter) {
          return false;
        }

        return matchesTargetFilter(row, targetFilter) && matchesAchievedFilter(row, achievedFilter);
      }),
      sortField,
    );
  }, [achievedFilter, familyFilter, matrixResult?.rows, pathFilter, sortField, targetFilter, towerFilter]);

  const pivotRows = useMemo(() => buildPivotRows((matrixResult?.rows ?? []).map(withFamily), selectedSeedKeys), [
    matrixResult?.rows,
    selectedSeedKeys,
  ]);

  function addSeed(canonicalKey: string): void {
    if (!canonicalKey || selectedSeedKeys.includes(canonicalKey)) {
      return;
    }

    setSelectedSeedKeys((current) => [...current, canonicalKey].sort((left, right) => {
      const leftName = optionsByKey.get(left)?.itemName ?? left;
      const rightName = optionsByKey.get(right)?.itemName ?? right;
      return leftName.localeCompare(rightName);
    }));
    setSearchText('');
  }

  function addSearchResult(): void {
    const exactKey = toCanonicalItemKey(searchText);
    const matchingOption =
      optionsByKey.get(exactKey) ??
      filteredSeedOptions.find((option) => option.itemName.toLowerCase().includes(searchText.trim().toLowerCase()));

    if (matchingOption) {
      addSeed(matchingOption.canonicalKey);
    }
  }

  function applyPreset(seedNames: string[]): void {
    const presetSeedKeys = getPresetSeedKeys(seedNames, optionsByKey);

    if (presetSeedKeys.length > 0) {
      setSelectedSeedKeys(presetSeedKeys);
    }
  }

  return (
    <main className="page-shell">
      <PageIntro
        title="Craft Material Matrix"
        description="Pick a material and see craftable downstream uses, Tower targets, mastery status, and recipes in one place."
      />

      <section className="page-card material-matrix__controls" aria-labelledby="craft-material-controls-heading">
        <div className="section-heading-row">
          <div>
            <h2 id="craft-material-controls-heading">Materials</h2>
            <p className="muted-text">Start with a preset or add seed materials directly.</p>
          </div>
          <button type="button" className="button" onClick={() => setSelectedSeedKeys([])}>
            Clear
          </button>
        </div>

        {resourcesState.error ? <p className="warning-text">{resourcesState.error}</p> : null}
        {resourcesState.isLoading ? <p className="muted-text">Loading recipe and Tower data...</p> : null}

        <div className="material-matrix__preset-list" aria-label="Material presets">
          {PRESETS.map((preset) => {
            const availableSeeds = getPresetSeedKeys(preset.seeds, optionsByKey);
            return (
              <button
                type="button"
                className="button button--secondary"
                key={preset.label}
                disabled={availableSeeds.length === 0}
                onClick={() => applyPreset(preset.seeds)}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <div className="material-matrix__seed-search">
          <label>
            Add material
            <input
              type="search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addSearchResult();
                }
              }}
              placeholder="Search recipe inputs"
            />
          </label>
          <button type="button" className="button" onClick={addSearchResult} disabled={filteredSeedOptions.length === 0}>
            Add
          </button>
        </div>

        <div className="material-matrix__suggestions" aria-label="Matching materials">
          {filteredSeedOptions.map((option) => (
            <button
              type="button"
              className="material-matrix__suggestion"
              key={option.canonicalKey}
              onClick={() => addSeed(option.canonicalKey)}
            >
              {getIconSrc(option.canonicalKey) ? (
                <img className="item-icon" src={getIconSrc(option.canonicalKey) ?? undefined} alt="" aria-hidden="true" />
              ) : null}
              <span>{option.itemName}</span>
              <span className="muted-text">{option.recipeCount} uses</span>
            </button>
          ))}
        </div>

        <div className="material-matrix__selected-seeds" aria-label="Selected materials">
          {selectedSeedKeys.length === 0 ? <p className="muted-text">No materials selected yet.</p> : null}
          {selectedSeedKeys.map((canonicalKey) => {
            const option = optionsByKey.get(canonicalKey);
            return (
              <span className="material-matrix__seed-chip" key={canonicalKey}>
                {getIconSrc(canonicalKey) ? (
                  <img className="item-icon" src={getIconSrc(canonicalKey) ?? undefined} alt="" aria-hidden="true" />
                ) : null}
                <span>{option?.itemName ?? canonicalKey}</span>
                <button
                  type="button"
                  aria-label={`Remove ${option?.itemName ?? canonicalKey}`}
                  onClick={() => setSelectedSeedKeys((current) => current.filter((key) => key !== canonicalKey))}
                >
                  x
                </button>
              </span>
            );
          })}
        </div>
      </section>

      <section className="page-card material-matrix__filters" aria-labelledby="craft-material-filters-heading">
        <h2 id="craft-material-filters-heading">View</h2>
        <div className="form-grid">
          <label>
            Tower
            <select value={towerFilter} onChange={(event) => setTowerFilter(event.target.value as TowerFilter)}>
              <option value="all">All craft uses</option>
              <option value="tower">Tower only</option>
              <option value="unfinishedTower">Unfinished Tower only</option>
            </select>
          </label>
          <label>
            Path
            <select value={pathFilter} onChange={(event) => setPathFilter(event.target.value as PathFilter)}>
              <option value="all">Direct and downstream</option>
              <option value="direct">Direct use</option>
              <option value="one_step_downstream">One-step downstream</option>
            </select>
          </label>
          <label>
            Family
            <select value={familyFilter} onChange={(event) => setFamilyFilter(event.target.value as FamilyFilter)}>
              <option value="all">All families</option>
              {CRAFT_MATERIAL_MATRIX_FAMILIES.map((family) => (
                <option key={family.id} value={family.id}>
                  {family.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Target
            <select value={targetFilter} onChange={(event) => setTargetFilter(event.target.value as TargetFilter)}>
              <option value="all">M, GM, and MM</option>
              <option value="M">M</option>
              <option value="GM">GM</option>
              <option value="MM">MM</option>
            </select>
          </label>
          <label>
            Status
            <select value={achievedFilter} onChange={(event) => setAchievedFilter(event.target.value as AchievedFilter)}>
              <option value="all">Achieved and unachieved</option>
              <option value="unachieved">Unachieved</option>
              <option value="achieved">Achieved</option>
            </select>
          </label>
          <label>
            Sort
            <select value={sortField} onChange={(event) => setSortField(event.target.value as SortField)}>
              <option value="towerLevel">Next Tower level</option>
              <option value="remainingMastery">Remaining mastery</option>
              <option value="seedQuantity">Seed quantity</option>
              <option value="family">Family</option>
              <option value="itemName">Item name</option>
            </select>
          </label>
        </div>
      </section>

      <section className="material-matrix__results" aria-labelledby="craft-material-results-heading">
        <TowerColorPivotMatrix pivotRows={pivotRows} selectedSeedKeys={selectedSeedKeys} optionsByKey={optionsByKey} />

        <div className="section-heading-row">
          <div>
            <h2 id="craft-material-results-heading">Craft Uses</h2>
            <p className="muted-text">
              Showing {visibleRows.length.toLocaleString()} of {(matrixResult?.rows.length ?? 0).toLocaleString()} uses.
            </p>
          </div>
        </div>

        {visibleRows.length === 0 && !resourcesState.isLoading ? (
          <section className="page-card">
            <p className="muted-text">No craft uses match the current material and filter choices.</p>
          </section>
        ) : null}

        <div className="material-matrix__row-list">
          {visibleRows.map((row) => (
            <article
              className={`page-card material-matrix__row ${row.towerRelevant ? 'material-matrix__row--tower' : ''}`}
              key={`${row.seedCanonicalKey}:${row.outputCanonicalKey}:${row.pathType}`}
            >
              <div className="material-matrix__row-main">
                <ItemProfileLink
                  canonicalKey={row.outputCanonicalKey}
                  itemName={row.outputItemName}
                  iconSrc={getIconSrc(row.outputCanonicalKey)}
                />
                <div className="material-matrix__row-meta">
                  <span>{row.familyLabel}</span>
                  <span>{describePathType(row.pathType)}</span>
                  <span>{row.recipeType}</span>
                  <span>{formatAmount(row.consumedSeedQuantity)} {row.seedItemName} per output</span>
                </div>
              </div>
              <TowerTargets row={row} />
              <dl className="material-matrix__details">
                <div>
                  <dt>Recipe</dt>
                  <dd><RecipeSummary row={row} /></dd>
                </div>
                <div>
                  <dt>Path</dt>
                  <dd><PathSummary row={row} /></dd>
                </div>
                <div>
                  <dt>Current mastery</dt>
                  <dd>
                    {formatAmount(row.currentMastery)}
                    {!row.matchedSnapshotRow ? ' (not in latest snapshot)' : ''}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
