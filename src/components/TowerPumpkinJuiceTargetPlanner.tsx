import type { DerivedTowerProgress } from '../lib/deriveTowerProgress';

type TowerPumpkinJuiceTargetPlannerProps = {
  derivedProgress: DerivedTowerProgress;
  targetLevel: number | null;
  targetLevelInput: string;
  ownedPumpkinJuiceCount: number;
  ownedPumpkinJuiceInput: string;
  message: string | null;
  error: string | null;
  onSelectAllKnown: () => void;
  onSelectPreset: (level: number) => void;
  onTargetLevelInputChange: (value: string) => void;
  onOwnedPumpkinJuiceInputChange: (value: string) => void;
  onSaveOwnedPumpkinJuiceCount: () => void;
};

function formatShortItemList(itemNames: string[]): string {
  if (itemNames.length <= 2) {
    return itemNames.join(' and ');
  }

  if (itemNames.length <= 4) {
    return `${itemNames.slice(0, -1).join(', ')}, and ${itemNames[itemNames.length - 1]}`;
  }

  return `${itemNames.slice(0, 3).join(', ')}, and ${itemNames.length - 3} more`;
}

function formatTargetScope(targetLevel: number | null): string {
  return targetLevel ? `through Tower ${targetLevel}` : 'for all known Tower levels';
}

export function TowerPumpkinJuiceTargetPlanner({
  derivedProgress,
  targetLevel,
  targetLevelInput,
  ownedPumpkinJuiceCount,
  ownedPumpkinJuiceInput,
  message,
  error,
  onSelectAllKnown,
  onSelectPreset,
  onTargetLevelInputChange,
  onOwnedPumpkinJuiceInputChange,
  onSaveOwnedPumpkinJuiceCount,
}: TowerPumpkinJuiceTargetPlannerProps) {
  const targetScope = formatTargetScope(targetLevel);
  const baselineMasteryItems = derivedProgress.remainingItems.filter(
    (item) => item.pumpkinJuiceEstimate.status === 'needs_baseline',
  );
  const pjDifference = ownedPumpkinJuiceCount - derivedProgress.totalPumpkinJuicesNeeded;

  return (
    <section className="page-card page-stack" aria-labelledby="tower-pj-target-planner-title">
      <div>
        <h2 id="tower-pj-target-planner-title">Pumpkin Juice Target Planner</h2>
        <p className="supporting-text">
          Estimate Pumpkin Juice still needed {targetScope}, using each item's highest required Tower target in scope.
        </p>
      </div>

      <div className="inline-control-row" aria-label="Tower target selector">
        <span className="field-label">Tower target</span>
        <div className="segmented-control" role="group" aria-label="Tower target presets">
          <button
            type="button"
            className={`segmented-control__button${targetLevel === null ? ' segmented-control__button--active' : ''}`}
            onClick={onSelectAllKnown}
          >
            All known
          </button>
          <button
            type="button"
            className={`segmented-control__button${targetLevel === 300 ? ' segmented-control__button--active' : ''}`}
            onClick={() => onSelectPreset(300)}
          >
            T300
          </button>
        </div>
        <label className="field-label" htmlFor="tower-pj-target-level">
          Custom
        </label>
        <input
          id="tower-pj-target-level"
          className="text-input text-input--short"
          type="number"
          min="1"
          step="1"
          value={targetLevelInput}
          placeholder="All"
          onChange={(event) => onTargetLevelInputChange(event.target.value)}
        />
      </div>

      <dl className="summary-grid">
        <div className="summary-grid__item">
          <dt>Items left to GM</dt>
          <dd>{derivedProgress.gmItemsLeftCount.toLocaleString()}</dd>
        </div>
        <div className="summary-grid__item">
          <dt>Items left to MM</dt>
          <dd>{derivedProgress.mmItemsLeftCount.toLocaleString()}</dd>
        </div>
        <div className="summary-grid__item">
          <dt>Total mastery remaining</dt>
          <dd>{derivedProgress.totalMasteryRemaining.toLocaleString()}</dd>
        </div>
        <div className="summary-grid__item">
          <dt>Remaining unique tower items</dt>
          <dd>{derivedProgress.remainingItems.length.toLocaleString()}</dd>
        </div>
        <div className="summary-grid__item">
          <dt>Pumpkin Juice needed {targetScope}</dt>
          <dd>{derivedProgress.totalPumpkinJuicesNeeded.toLocaleString()}</dd>
          {derivedProgress.pumpkinJuiceBlockedItemCount > 0 ? (
            <p className="subtle-text">
              {derivedProgress.pumpkinJuiceBlockedItemCount.toLocaleString()} item
              {derivedProgress.pumpkinJuiceBlockedItemCount === 1 ? ' needs' : 's need'} baseline mastery first:{' '}
              {formatShortItemList(baselineMasteryItems.map((item) => item.itemName))}
            </p>
          ) : null}
        </div>
        <div className="summary-grid__item">
          <dt>Owned Pumpkin Juice</dt>
          <dd>{ownedPumpkinJuiceCount.toLocaleString()}</dd>
          <p className="subtle-text">
            {pjDifference >= 0
              ? `${pjDifference.toLocaleString()} extra after calculable Tower goals ${targetScope}`
              : `${Math.abs(pjDifference).toLocaleString()} short for calculable Tower goals ${targetScope}`}
          </p>
        </div>
      </dl>

      <div className="inline-control-row" aria-label="Pumpkin Juice planner assumptions">
        <label className="field-label" htmlFor="tower-owned-pumpkin-juice">
          Owned Pumpkin Juice
        </label>
        <input
          id="tower-owned-pumpkin-juice"
          className="text-input text-input--short"
          type="number"
          min="0"
          step="1"
          value={ownedPumpkinJuiceInput}
          onChange={(event) => onOwnedPumpkinJuiceInputChange(event.target.value)}
        />
        <button type="button" className="button" onClick={onSaveOwnedPumpkinJuiceCount}>
          Save
        </button>
      </div>
      {message ? <p className="status-message status-message--success">{message}</p> : null}
      {error ? <p className="status-message status-message--error">{error}</p> : null}
    </section>
  );
}
