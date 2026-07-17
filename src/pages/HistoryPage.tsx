import { useEffect, useMemo, useRef, useState } from 'react';

import { ItemProfileLink } from '../components/ItemProfileLink';
import { PageIntro } from '../components/PageIntro';
import {
  deriveSnapshotHistoryAnalytics,
  filterSnapshotHistoryAnalyticsItems,
  type SnapshotHistoryAnalytics,
  type SnapshotHistoryItemRow,
  type SnapshotHistoryTimelinePoint,
} from '../lib/deriveSnapshotHistoryAnalytics';
import { deriveTowerProgress } from '../lib/deriveTowerProgress';
import { getItemIcon } from '../lib/itemIconManifest';
import { loadMasteryDifficulty } from '../lib/loadMasteryDifficulty';
import { loadTowerRequirements } from '../lib/loadTowerRequirements';
import {
  loadSnapshotVelocityPreferences,
  saveSnapshotVelocityPreferences,
  type SnapshotVelocityChartMode,
  type SnapshotVelocityPreferences,
  type SnapshotVelocityRangeMode,
} from '../lib/snapshotVelocityPreferences';
import { listSnapshots } from '../lib/storage/masterySnapshots';

type HistorySortMode =
  | 'recentGain'
  | 'gainPerDay'
  | 'percentGain'
  | 'current'
  | 'closestThreshold'
  | 'tower'
  | 'name';

const ITEM_CHART_COLORS = [
  '#8ec5ff',
  '#f6b95f',
  '#75d48b',
  '#f487b6',
  '#bca2ff',
  '#66d7d1',
  '#ffd166',
  '#ff8b6b',
  '#a7d46f',
  '#d99bf7',
  '#88a8ff',
  '#f4d35e',
];

function formatCompactNumber(value: number): string {
  return Math.round(value).toLocaleString();
}

function formatSignedNumber(value: number): string {
  return `${value > 0 ? '+' : ''}${formatCompactNumber(value)}`;
}

function formatRate(value: number | null): string {
  return value === null ? 'n/a' : `${formatCompactNumber(value)} / day`;
}

function formatPercent(value: number | null): string {
  if (value === null) {
    return 'n/a';
  }

  return `${value.toFixed(value >= 10 ? 1 : 2)}%`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatFullDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function getVisibleTickIndexes(pointCount: number, maxTickCount: number): Set<number> {
  if (pointCount <= maxTickCount) {
    return new Set(Array.from({ length: pointCount }, (_, index) => index));
  }

  const indexes = new Set<number>([0, pointCount - 1]);
  const intervalCount = Math.max(1, maxTickCount - 1);

  for (let tickIndex = 1; tickIndex < intervalCount; tickIndex += 1) {
    indexes.add(Math.round((tickIndex / intervalCount) * (pointCount - 1)));
  }

  return indexes;
}

function formatVelocityValue(value: number, chartMode: SnapshotVelocityChartMode): string {
  if (chartMode === 'threshold') {
    return `${value.toFixed(1)}%`;
  }

  if (chartMode === 'gain') {
    return formatSignedNumber(value);
  }

  return formatCompactNumber(value);
}

function useChartWidth() {
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(640);

  useEffect(() => {
    const chart = chartRef.current;

    if (!chart) {
      return undefined;
    }

    const updateWidth = () => setChartWidth(chart.clientWidth || 640);
    updateWidth();

    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver(updateWidth);
    observer.observe(chart);
    return () => observer.disconnect();
  }, []);

  return { chartRef, chartWidth };
}

function getPointX(index: number, count: number): number {
  if (count <= 1) {
    return 40;
  }

  return 40 + (index / (count - 1)) * 560;
}

function getScaledY(value: number, minValue: number, maxValue: number): number {
  if (maxValue === minValue) {
    return 110;
  }

  return 180 - ((value - minValue) / (maxValue - minValue)) * 140;
}

function getVisibleSnapshotPoints(
  points: SnapshotHistoryTimelinePoint[],
  rangeMode: SnapshotVelocityRangeMode,
): SnapshotHistoryTimelinePoint[] {
  return rangeMode === 'recent' ? points.slice(-2) : points;
}

function getItemChartValue(row: SnapshotHistoryItemRow, pointIndex: number, chartMode: SnapshotVelocityChartMode): number {
  const point = row.points[pointIndex];

  if (!point) {
    return 0;
  }

  if (chartMode === 'gain') {
    return point.delta;
  }

  if (chartMode === 'threshold') {
    return point.percentToNextThreshold;
  }

  return point.value;
}

function getChartModeLabel(chartMode: SnapshotVelocityChartMode): string {
  if (chartMode === 'gain') {
    return 'Interval gain';
  }

  if (chartMode === 'threshold') {
    return 'Progress to next threshold';
  }

  return 'Mastery count';
}

function getSortValue(row: SnapshotHistoryItemRow, sortMode: HistorySortMode): number | string | null {
  if (sortMode === 'recentGain') {
    return row.recentDelta;
  }

  if (sortMode === 'gainPerDay') {
    return row.recentGainPerDay;
  }

  if (sortMode === 'percentGain') {
    return row.percentGain;
  }

  if (sortMode === 'current') {
    return row.latestValue;
  }

  if (sortMode === 'closestThreshold') {
    return row.remainingToNextThreshold;
  }

  if (sortMode === 'tower') {
    return row.suggestionReasons.includes('Tower') ? 1 : 0;
  }

  return row.itemName;
}

function sortCandidateRows(
  rows: SnapshotHistoryItemRow[],
  sortMode: HistorySortMode,
): SnapshotHistoryItemRow[] {
  return [...rows].sort((left, right) => {
    const leftValue = getSortValue(left, sortMode);
    const rightValue = getSortValue(right, sortMode);

    if (typeof leftValue === 'string' || typeof rightValue === 'string') {
      return String(leftValue ?? '').localeCompare(String(rightValue ?? ''));
    }

    if (sortMode === 'closestThreshold') {
      const leftRemaining = leftValue ?? Number.POSITIVE_INFINITY;
      const rightRemaining = rightValue ?? Number.POSITIVE_INFINITY;

      if (leftRemaining !== rightRemaining) {
        return leftRemaining - rightRemaining;
      }

      return right.latestPercentToNextThreshold - left.latestPercentToNextThreshold;
    }

    const leftNumber = leftValue ?? Number.NEGATIVE_INFINITY;
    const rightNumber = rightValue ?? Number.NEGATIVE_INFINITY;

    if (leftNumber !== rightNumber) {
      return rightNumber - leftNumber;
    }

    return left.itemName.localeCompare(right.itemName);
  });
}

function OverallMomentumChart({ points }: { points: SnapshotHistoryTimelinePoint[] }) {
  if (points.length < 2) {
    return <p className="empty-state">Save at least two snapshots to see mastery momentum over time.</p>;
  }

  const intervalPoints = points.slice(1);
  const maxBarValue = Math.max(1, ...intervalPoints.map((point) => Math.abs(point.totalDelta)));
  const percentValues = intervalPoints
    .map((point) => point.percentGainPerDay)
    .filter((value): value is number => value !== null);
  const minPercent = percentValues.length > 0 ? Math.min(...percentValues, 0) : 0;
  const maxPercent = percentValues.length > 0 ? Math.max(...percentValues, 1) : 1;
  const linePoints = intervalPoints
    .map((point, intervalIndex) => {
      if (point.percentGainPerDay === null) {
        return null;
      }

      const pointIndex = intervalIndex + 1;
      return `${getPointX(pointIndex, points.length)},${getScaledY(point.percentGainPerDay, minPercent, maxPercent)}`;
    })
    .filter((point): point is string => Boolean(point));

  return (
    <div className="history-chart" role="img" aria-label="Overall mastery momentum chart">
      <svg className="history-chart__svg" viewBox="0 0 640 220" aria-hidden="true" focusable="false">
        <line className="history-chart__axis" x1="32" y1="184" x2="612" y2="184" />
        {intervalPoints.map((point, intervalIndex) => {
          const pointIndex = intervalIndex + 1;
          const x = getPointX(pointIndex, points.length) - 12;
          const barHeight = Math.max(4, (Math.abs(point.totalDelta) / maxBarValue) * 126);
          const y = point.totalDelta >= 0 ? 184 - barHeight : 184;

          return (
            <g key={point.snapshotId}>
              <rect
                className={`history-chart__bar${
                  point.totalDelta < 0 ? ' history-chart__bar--negative' : ''
                }`}
                x={x}
                y={y}
                width="24"
                height={barHeight}
                rx="3"
              />
              <text className="history-chart__tick" x={x + 12} y="205" textAnchor="middle">
                {formatDate(point.savedAt)}
              </text>
            </g>
          );
        })}
        {linePoints.length > 1 ? <polyline className="history-chart__line" points={linePoints.join(' ')} /> : null}
      </svg>
      <div className="history-chart__legend">
        <span><span className="history-chart__swatch history-chart__swatch--bar" /> Mastery gained</span>
        <span><span className="history-chart__swatch history-chart__swatch--line" /> Percent gain per day</span>
      </div>
    </div>
  );
}

function ItemVelocityChart({
  rows,
  chartMode,
  rangeMode,
}: {
  rows: SnapshotHistoryItemRow[];
  chartMode: SnapshotVelocityChartMode;
  rangeMode: SnapshotVelocityRangeMode;
}) {
  const [activePointKey, setActivePointKey] = useState<string | null>(null);
  const { chartRef, chartWidth } = useChartWidth();

  if (rows.length === 0) {
    return <p className="empty-state">Choose at least one item to draw velocity lines.</p>;
  }

  const basePoints = rows[0]?.points ?? [];
  const pointIndexes = rangeMode === 'recent'
    ? basePoints.map((_, index) => index).slice(-2)
    : basePoints.map((_, index) => index);
  const values = rows.flatMap((row) => pointIndexes.map((pointIndex) => getItemChartValue(row, pointIndex, chartMode)));
  const minValue = chartMode === 'gain' ? Math.min(0, ...values) : 0;
  const maxValue = Math.max(1, ...values);
  const maxTickCount = Math.max(2, Math.min(8, Math.floor(chartWidth / 88)));
  const visibleTickIndexes = getVisibleTickIndexes(pointIndexes.length, maxTickCount);
  const pointDetails = rows.flatMap((row, rowIndex) =>
    pointIndexes.flatMap((pointIndex, visibleIndex) => {
      const point = row.points[pointIndex];

      if (!point) {
        return [];
      }

      return [{
        key: `${row.canonicalKey}-${point.snapshotId}`,
        row,
        point,
        chartValue: getItemChartValue(row, pointIndex, chartMode),
        x: getPointX(visibleIndex, pointIndexes.length),
        y: getScaledY(getItemChartValue(row, pointIndex, chartMode), minValue, maxValue),
        color: ITEM_CHART_COLORS[rowIndex % ITEM_CHART_COLORS.length],
      }];
    }));
  const activePoint = pointDetails.find((point) => point.key === activePointKey) ?? null;

  return (
    <div className="history-chart" ref={chartRef}>
      <div className="history-chart__plot">
        <svg
          className="history-chart__svg"
          viewBox="0 0 640 240"
          role="img"
          aria-label={`${getChartModeLabel(chartMode)} item velocity chart`}
        >
          <line className="history-chart__axis" x1="32" y1="190" x2="612" y2="190" />
          {rows.map((row, rowIndex) => {
            const linePoints = pointIndexes
              .map((pointIndex, visibleIndex) => {
                const x = getPointX(visibleIndex, pointIndexes.length);
                const y = getScaledY(getItemChartValue(row, pointIndex, chartMode), minValue, maxValue);
                return `${x},${y}`;
              })
              .join(' ');

            return (
              <polyline
                key={row.canonicalKey}
                className="history-chart__item-line"
                points={linePoints}
                style={{ stroke: ITEM_CHART_COLORS[rowIndex % ITEM_CHART_COLORS.length] }}
                aria-hidden="true"
              />
            );
          })}
          {pointDetails.map(({ key, row, point, chartValue, x, y, color }) => (
            <g
              key={key}
              className="history-chart__point"
              role="button"
              tabIndex={0}
              aria-label={`${row.itemName}, ${formatFullDate(point.savedAt)}, mastery ${formatCompactNumber(point.value)}, ${getChartModeLabel(chartMode)} ${formatVelocityValue(chartValue, chartMode)}`}
              onPointerEnter={() => setActivePointKey(key)}
              onPointerLeave={() => setActivePointKey((current) => current === key ? null : current)}
              onFocus={() => setActivePointKey(key)}
              onBlur={() => setActivePointKey((current) => current === key ? null : current)}
              onClick={() => setActivePointKey(key)}
            >
              <circle className="history-chart__point-hit" cx={x} cy={y} r="12" />
              <circle className="history-chart__point-marker" cx={x} cy={y} r="4" style={{ fill: color }} />
            </g>
          ))}
          {pointIndexes.map((pointIndex, visibleIndex) => {
            const point = basePoints[pointIndex];

            if (!point || !visibleTickIndexes.has(visibleIndex)) {
              return null;
            }

            return (
              <text key={point.snapshotId} className="history-chart__tick" x={getPointX(visibleIndex, pointIndexes.length)} y="214" textAnchor="middle">
                {formatDate(point.savedAt)}
              </text>
            );
          })}
        </svg>
        {activePoint ? (
          <div
            className={`history-chart__tooltip${activePoint.x > 500 ? ' history-chart__tooltip--right' : ''}`}
            style={{
              left: `${(activePoint.x / 640) * 100}%`,
              top: `${(activePoint.y / 240) * 100}%`,
            }}
            role="status"
          >
            <strong>{activePoint.row.itemName}</strong>
            <span>{formatFullDate(activePoint.point.savedAt)}</span>
            <span>Mastery: {formatCompactNumber(activePoint.point.value)}</span>
            {chartMode !== 'mastery' ? (
              <span>{getChartModeLabel(chartMode)}: {formatVelocityValue(activePoint.chartValue, chartMode)}</span>
            ) : null}
          </div>
        ) : null}
      </div>
      <ul className="history-chart__legend history-chart__legend--items">
        {rows.map((row, rowIndex) => (
          <li key={row.canonicalKey}>
            <span
              className="history-chart__swatch"
              style={{ background: ITEM_CHART_COLORS[rowIndex % ITEM_CHART_COLORS.length] }}
            />
            {row.itemName}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReasonBadges({ reasons }: { reasons: string[] }) {
  if (reasons.length === 0) {
    return <span className="history-reason-badge history-reason-badge--muted">Observed</span>;
  }

  return (
    <>
      {reasons.map((reason) => (
        <span key={reason} className="history-reason-badge">
          {reason}
        </span>
      ))}
    </>
  );
}

export function HistoryPage() {
  const [historyState, setHistoryState] = useState<{
    isLoading: boolean;
    loadError: string | null;
    referenceWarning: string | null;
    analytics: SnapshotHistoryAnalytics | null;
  }>({
    isLoading: true,
    loadError: null,
    referenceWarning: null,
    analytics: null,
  });
  const [preferences, setPreferences] = useState<SnapshotVelocityPreferences>(() =>
    loadSnapshotVelocityPreferences(),
  );
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<HistorySortMode>('recentGain');

  useEffect(() => {
    let isMounted = true;

    void listSnapshots()
      .then(async (snapshots) => {
        const latestSnapshot = snapshots[0] ?? null;
        let towerNeededCanonicalKeys: string[] = [];
        let referenceWarning: string | null = null;

        if (latestSnapshot) {
          const [towerResult, difficultyResult] = await Promise.allSettled([
            loadTowerRequirements(),
            loadMasteryDifficulty(),
          ]);

          if (towerResult.status === 'fulfilled' && difficultyResult.status === 'fulfilled') {
            towerNeededCanonicalKeys = deriveTowerProgress(
              latestSnapshot,
              towerResult.value,
              difficultyResult.value,
            ).remainingItems.map((item) => item.canonicalKey);
          } else {
            referenceWarning = 'Tower-needed suggestions could not load, but snapshot velocity still works.';
          }
        }

        if (!isMounted) {
          return;
        }

        setHistoryState({
          isLoading: false,
          loadError: null,
          referenceWarning,
          analytics: deriveSnapshotHistoryAnalytics(snapshots, { towerNeededCanonicalKeys }),
        });
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        setHistoryState({
          isLoading: false,
          loadError: error instanceof Error ? error.message : 'Unable to load local snapshot history.',
          referenceWarning: null,
          analytics: null,
        });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  function savePreferences(nextPreferences: SnapshotVelocityPreferences): void {
    setPreferences(saveSnapshotVelocityPreferences(nextPreferences));
  }

  const analytics = historyState.analytics;
  const itemAnalytics = useMemo(() => {
    if (!analytics) {
      return null;
    }

    return filterSnapshotHistoryAnalyticsItems(analytics, {
      showMegaMasteredItems: preferences.showMegaMasteredItems,
    });
  }, [analytics, preferences.showMegaMasteredItems]);
  const hiddenMegaMasteredCount =
    analytics && itemAnalytics ? analytics.itemRows.length - itemAnalytics.itemRows.length : 0;
  const normalizedQuery = query.trim().toLowerCase();
  const selectedKeys = useMemo(() => {
    if (!itemAnalytics) {
      return [];
    }

    const defaultKeys = itemAnalytics.defaultSelectedCanonicalKeys.filter(
      (canonicalKey) => !preferences.hiddenDefaultCanonicalKeys.includes(canonicalKey),
    );

    return [...new Set([...defaultKeys, ...preferences.selectedCanonicalKeys])];
  }, [itemAnalytics, preferences.hiddenDefaultCanonicalKeys, preferences.selectedCanonicalKeys]);
  const selectedRows = useMemo(() => {
    if (!itemAnalytics) {
      return [];
    }

    const rowsByKey = new Map(itemAnalytics.itemRows.map((row) => [row.canonicalKey, row]));
    return selectedKeys.map((canonicalKey) => rowsByKey.get(canonicalKey)).filter((row): row is SnapshotHistoryItemRow => Boolean(row));
  }, [itemAnalytics, selectedKeys]);
  const candidateRows = useMemo(() => {
    if (!itemAnalytics) {
      return [];
    }

    const filteredRows = itemAnalytics.itemRows.filter(
      (row) =>
        !normalizedQuery ||
        row.itemName.toLowerCase().includes(normalizedQuery) ||
        row.canonicalKey.includes(normalizedQuery),
    );

    return sortCandidateRows(filteredRows, sortMode).slice(0, 50);
  }, [itemAnalytics, normalizedQuery, sortMode]);
  const visibleSnapshotPoints = analytics
    ? getVisibleSnapshotPoints(analytics.snapshotPoints, preferences.rangeMode)
    : [];
  const latestPoint = analytics?.snapshotPoints[analytics.snapshotPoints.length - 1] ?? null;
  const firstPoint = analytics?.snapshotPoints[0] ?? null;
  const latestInterval = analytics?.snapshotPoints[analytics.snapshotPoints.length - 1] ?? null;
  const totalGain = latestPoint && firstPoint ? latestPoint.totalMastery - firstPoint.totalMastery : 0;

  function addItem(canonicalKey: string): void {
    savePreferences({
      ...preferences,
      selectedCanonicalKeys: [...new Set([...preferences.selectedCanonicalKeys, canonicalKey])],
      hiddenDefaultCanonicalKeys: preferences.hiddenDefaultCanonicalKeys.filter((key) => key !== canonicalKey),
    });
  }

  function removeItem(canonicalKey: string): void {
    const isDefaultItem = itemAnalytics?.defaultSelectedCanonicalKeys.includes(canonicalKey) ?? false;

    savePreferences({
      ...preferences,
      selectedCanonicalKeys: preferences.selectedCanonicalKeys.filter((key) => key !== canonicalKey),
      hiddenDefaultCanonicalKeys: isDefaultItem
        ? [...new Set([...preferences.hiddenDefaultCanonicalKeys, canonicalKey])]
        : preferences.hiddenDefaultCanonicalKeys,
    });
  }

  function resetChartItems(): void {
    savePreferences({
      ...preferences,
      selectedCanonicalKeys: [],
      hiddenDefaultCanonicalKeys: [],
    });
  }

  return (
    <div className="page-stack">
      <PageIntro
        title="Snapshot History"
        description="See how your mastery is moving over time, which items are gaining fastest, and what is worth watching next."
        storageKey="history"
      />

      {historyState.isLoading ? <p className="empty-state">Loading saved snapshot history...</p> : null}
      {!historyState.isLoading && historyState.loadError ? (
        <p className="status-message status-message--error">{historyState.loadError}</p>
      ) : null}
      {!historyState.isLoading && !historyState.loadError && analytics?.snapshotPoints.length === 0 ? (
        <section className="page-card page-stack">
          <h2>No Saved Snapshots</h2>
          <p className="empty-state">Import a mastery export to start building snapshot history.</p>
        </section>
      ) : null}

      {analytics && analytics.snapshotPoints.length > 0 ? (
        <>
          {historyState.referenceWarning ? (
            <p className="status-message">{historyState.referenceWarning}</p>
          ) : null}

          <section className="page-card page-stack" aria-labelledby="history-summary-title">
            <div>
              <h2 id="history-summary-title">Mastery Momentum</h2>
              <p className="supporting-text">
                {analytics.snapshotPoints.length.toLocaleString()} snapshot
                {analytics.snapshotPoints.length === 1 ? '' : 's'} from {formatDate(firstPoint?.savedAt ?? '')} to{' '}
                {formatDate(latestPoint?.savedAt ?? '')}.
              </p>
            </div>

            <dl className="summary-grid">
              <div className="summary-grid__item">
                <dt>Total mastery</dt>
                <dd>{formatCompactNumber(latestPoint?.totalMastery ?? 0)}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Total gain</dt>
                <dd>{formatSignedNumber(totalGain)}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Latest gain</dt>
                <dd>{formatSignedNumber(latestInterval?.totalDelta ?? 0)}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Latest rate</dt>
                <dd>{formatRate(latestInterval?.masteryPerDay ?? null)}</dd>
              </div>
            </dl>
          </section>

          {itemAnalytics && itemAnalytics.milestoneCallouts.length > 0 ? (
            <section className="page-card page-stack" aria-labelledby="history-callouts-title">
              <h2 id="history-callouts-title">Interesting Movement</h2>
              <ul className="history-callout-list">
                {itemAnalytics.milestoneCallouts.map((callout) => (
                  <li key={callout.id} className="history-callout-card">
                    <details>
                      <summary>
                        <span className="history-callout-card__title">{callout.title}</span>
                        <strong>{callout.value}</strong>
                        <span>{callout.detail}</span>
                        <span className="history-callout-card__action">View details</span>
                      </summary>
                      <dl className="history-callout-evidence">
                        {callout.evidence.map((evidence, index) => (
                          <div key={`${evidence.label}-${evidence.canonicalKey ?? index}`}>
                            <dt>{evidence.label}</dt>
                            <dd>
                              {evidence.canonicalKey && evidence.itemName ? (
                                <>
                                  <ItemProfileLink
                                    canonicalKey={evidence.canonicalKey}
                                    itemName={evidence.itemName}
                                  />
                                  <span>{evidence.value}</span>
                                </>
                              ) : evidence.value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </details>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="page-card page-stack" aria-labelledby="history-overall-chart-title">
            <div>
              <h2 id="history-overall-chart-title">Overall Velocity</h2>
              <p className="supporting-text">Bars show mastery gained between snapshots; the line shows percent gained per day.</p>
            </div>
            <OverallMomentumChart points={visibleSnapshotPoints} />
          </section>

          <section className="page-card page-stack" aria-labelledby="history-item-chart-title">
            <div className="section-heading-row">
              <div>
                <h2 id="history-item-chart-title">Item Velocity</h2>
                <p className="supporting-text">
                  Defaults to the fastest recent gainers. Add or remove items below to curate this chart.
                </p>
              </div>
              <button type="button" className="secondary-button" onClick={resetChartItems}>
                Reset chart items
              </button>
            </div>

            <div className="inline-control-row">
              <label className="checkbox-field" htmlFor="history-show-mm-items">
                <input
                  id="history-show-mm-items"
                  type="checkbox"
                  checked={preferences.showMegaMasteredItems}
                  onChange={(event) =>
                    savePreferences({
                      ...preferences,
                      showMegaMasteredItems: event.target.checked,
                    })
                  }
                />
                Show MM'd items
              </label>

              <label className="field-label" htmlFor="history-chart-mode">
                Chart mode
              </label>
              <select
                id="history-chart-mode"
                className="text-input text-input--short"
                value={preferences.chartMode}
                onChange={(event) =>
                  savePreferences({
                    ...preferences,
                    chartMode: event.target.value as SnapshotVelocityChartMode,
                  })
                }
              >
                <option value="mastery">Mastery count</option>
                <option value="gain">Interval gain</option>
                <option value="threshold">Progress to next threshold</option>
              </select>

              <label className="field-label" htmlFor="history-range-mode">
                Range
              </label>
              <select
                id="history-range-mode"
                className="text-input text-input--short"
                value={preferences.rangeMode}
                onChange={(event) =>
                  savePreferences({
                    ...preferences,
                    rangeMode: event.target.value as SnapshotVelocityRangeMode,
                  })
                }
              >
                <option value="all">All snapshots</option>
                <option value="recent">Latest interval</option>
              </select>
            </div>

            {!preferences.showMegaMasteredItems && hiddenMegaMasteredCount > 0 ? (
              <p className="supporting-text">
                {hiddenMegaMasteredCount.toLocaleString()} MM'd item
                {hiddenMegaMasteredCount === 1 ? ' is' : 's are'} hidden from item-level views.
              </p>
            ) : null}

            <ItemVelocityChart rows={selectedRows} chartMode={preferences.chartMode} rangeMode={preferences.rangeMode} />

            {selectedRows.length > 0 ? (
              <ul className="history-selected-list">
                {selectedRows.map((row) => {
                  const icon = getItemIcon(row.canonicalKey);

                  return (
                    <li key={row.canonicalKey} className="history-selected-list__item">
                      <ItemProfileLink canonicalKey={row.canonicalKey} itemName={row.itemName} iconSrc={icon?.src ?? null} />
                      <span>{formatSignedNumber(row.recentDelta)} recent</span>
                      <button type="button" className="secondary-button" onClick={() => removeItem(row.canonicalKey)}>
                        Remove
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </section>

          <section className="page-card page-stack" aria-labelledby="history-picker-title">
            <div>
              <h2 id="history-picker-title">Item Picker</h2>
              <p className="supporting-text">
                Search, sort, and add items with useful movement signals to the velocity chart.
              </p>
            </div>

            <div className="summary-grid">
              <div className="page-stack page-stack--tight">
                <label className="field-label" htmlFor="history-item-search">
                  Search items
                </label>
                <input
                  id="history-item-search"
                  className="text-input"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search item names"
                />
              </div>

              <div className="page-stack page-stack--tight">
                <label className="field-label" htmlFor="history-item-sort">
                  Sort by
                </label>
                <select
                  id="history-item-sort"
                  className="text-input"
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value as HistorySortMode)}
                >
                  <option value="recentGain">Recent gain</option>
                  <option value="gainPerDay">Gain per day</option>
                  <option value="percentGain">Percent gain</option>
                  <option value="current">Current mastery</option>
                  <option value="closestThreshold">Closest threshold</option>
                  <option value="tower">Tower needed</option>
                  <option value="name">Name</option>
                </select>
              </div>
            </div>

            <div className="history-suggestion-buckets">
              {(itemAnalytics?.suggestionBuckets ?? [])
                .filter((bucket) => bucket.itemKeys.length > 0)
                .map((bucket) => (
                  <button
                    key={bucket.id}
                    type="button"
                    className="history-suggestion-chip"
                    onClick={() => setSortMode(bucket.id === 'closest_threshold' ? 'closestThreshold' : bucket.id === 'tower_needed' ? 'tower' : 'recentGain')}
                  >
                    {bucket.label}
                    <span>{bucket.itemKeys.length.toLocaleString()}</span>
                  </button>
                ))}
            </div>

            {candidateRows.length === 0 ? (
              <p className="empty-state">No items match that search.</p>
            ) : (
              <ul className="history-candidate-list">
                {candidateRows.map((row) => {
                  const isSelected = selectedKeys.includes(row.canonicalKey);
                  const icon = getItemIcon(row.canonicalKey);

                  return (
                    <li key={row.canonicalKey} className="history-candidate-card">
                      <div className="history-candidate-card__main">
                        <ItemProfileLink canonicalKey={row.canonicalKey} itemName={row.itemName} iconSrc={icon?.src ?? null} />
                        <div className="history-reason-list">
                          <ReasonBadges reasons={row.suggestionReasons} />
                        </div>
                      </div>
                      <dl className="history-candidate-card__stats">
                        <div>
                          <dt>Recent</dt>
                          <dd>{formatSignedNumber(row.recentDelta)}</dd>
                        </div>
                        <div>
                          <dt>Rate</dt>
                          <dd>{formatRate(row.recentGainPerDay)}</dd>
                        </div>
                        <div>
                          <dt>Next</dt>
                          <dd>
                            {row.nextThresholdLabel
                              ? `${formatPercent(row.latestPercentToNextThreshold)} to ${row.nextThresholdLabel}`
                              : 'All thresholds'}
                          </dd>
                        </div>
                      </dl>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => (isSelected ? removeItem(row.canonicalKey) : addItem(row.canonicalKey))}
                      >
                        {isSelected ? 'Remove' : 'Add'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
