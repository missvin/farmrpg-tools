import { useEffect, useMemo, useRef, useState } from 'react';

import type {
  TowerPumpkinJuiceHistory,
  TowerPumpkinJuiceHistoryPoint,
} from '../lib/deriveTowerPumpkinJuiceHistory';

const SERIES_COLORS = [
  '#75d48b',
  '#8ec5ff',
  '#f6b95f',
  '#bca2ff',
  '#66d7d1',
  '#f487b6',
  '#ffd166',
];

type ChartPoint = {
  key: string;
  point: TowerPumpkinJuiceHistoryPoint;
  x: number;
  y: number;
  color: string;
};

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

function getPointX(index: number, count: number): number {
  if (count <= 1) {
    return 320;
  }

  return 58 + (index / (count - 1)) * 532;
}

function formatChange(change: number | null): string {
  if (change === null) {
    return 'First saved snapshot';
  }

  if (change === 0) {
    return 'No change from previous snapshot';
  }

  return change < 0
    ? `${Math.abs(change).toLocaleString()} fewer than previous snapshot`
    : `${change.toLocaleString()} more than previous snapshot`;
}

export function TowerPumpkinJuiceHistoryChart({
  history,
  showIncomplete,
  startAtZero,
}: {
  history: TowerPumpkinJuiceHistory;
  showIncomplete: boolean;
  startAtZero: boolean;
}) {
  const [activePointKey, setActivePointKey] = useState<string | null>(null);
  const { chartRef, chartWidth } = useChartWidth();
  const allVisiblePoints = useMemo(
    () => history.series.flatMap((series) => series.points.filter((point) => showIncomplete || !point.isLowerBound)),
    [history.series, showIncomplete],
  );

  if (history.series.length === 0 || history.snapshotCount === 0) {
    return <p className="empty-state">Save at least one mastery snapshot to draw Tower PJ history.</p>;
  }

  if (allVisiblePoints.length === 0) {
    return (
      <p className="empty-state">
        Every saved point is a lower bound. Show incomplete points to draw the history chart.
      </p>
    );
  }

  const rawValues = allVisiblePoints.map((point) => point.totalPumpkinJuicesNeeded);
  const rawMin = Math.min(...rawValues);
  const rawMax = Math.max(...rawValues);
  const spread = Math.max(1, rawMax - rawMin);
  const padding = Math.max(2, Math.ceil(spread * 0.12));
  const minValue = startAtZero ? 0 : Math.max(0, rawMin - padding);
  const maxValue = Math.max(minValue + 1, rawMax + padding);
  const getScaledY = (value: number) => 184 - ((value - minValue) / (maxValue - minValue)) * 146;
  const basePoints = history.series[0]?.points ?? [];
  const maxTickCount = Math.max(2, Math.min(7, Math.floor(chartWidth / 88)));
  const visibleTickIndexes = getVisibleTickIndexes(basePoints.length, maxTickCount);
  const pointDetails: ChartPoint[] = history.series.flatMap((series, seriesIndex) =>
    series.points.flatMap((point, pointIndex) => {
      if (!showIncomplete && point.isLowerBound) {
        return [];
      }

      return [{
        key: `${series.targetLevel}-${point.snapshotId}`,
        point,
        x: getPointX(pointIndex, series.points.length),
        y: getScaledY(point.totalPumpkinJuicesNeeded),
        color: SERIES_COLORS[seriesIndex % SERIES_COLORS.length],
      }];
    }),
  );
  const activePoint = pointDetails.find((point) => point.key === activePointKey) ?? null;
  const yTicks = Array.from({ length: 5 }, (_, index) => minValue + ((maxValue - minValue) * index) / 4);

  return (
    <div className="history-chart tower-pj-history-chart" ref={chartRef}>
      <div className="history-chart__plot">
        <svg
          className="history-chart__svg tower-pj-history-chart__svg"
          viewBox="0 0 640 240"
          role="img"
          aria-label={`Pumpkin Juice needed over time for ${history.targetLevels.map((level) => `Tower ${level}`).join(', ')}`}
        >
          <line className="history-chart__axis" x1="48" y1="190" x2="606" y2="190" />
          {yTicks.map((tick) => {
            const y = getScaledY(tick);
            return (
              <g key={tick} aria-hidden="true">
                <line className="tower-pj-history-chart__grid" x1="48" y1={y} x2="606" y2={y} />
                <text className="history-chart__tick" x="42" y={y + 4} textAnchor="end">
                  {Math.round(tick).toLocaleString()}
                </text>
              </g>
            );
          })}
          {history.series.map((series, seriesIndex) => {
            const color = SERIES_COLORS[seriesIndex % SERIES_COLORS.length];

            return series.points.slice(0, -1).map((point, pointIndex) => {
              const nextPoint = series.points[pointIndex + 1];
              if (!nextPoint || (!showIncomplete && (point.isLowerBound || nextPoint.isLowerBound))) {
                return null;
              }

              return (
                <line
                  key={`${series.targetLevel}-${point.snapshotId}-${nextPoint.snapshotId}`}
                  className="tower-pj-history-chart__segment"
                  x1={getPointX(pointIndex, series.points.length)}
                  y1={getScaledY(point.totalPumpkinJuicesNeeded)}
                  x2={getPointX(pointIndex + 1, series.points.length)}
                  y2={getScaledY(nextPoint.totalPumpkinJuicesNeeded)}
                  style={{
                    stroke: color,
                    strokeDasharray: point.isLowerBound || nextPoint.isLowerBound ? '7 6' : undefined,
                  }}
                  aria-hidden="true"
                />
              );
            });
          })}
          {pointDetails.map(({ key, point, x, y, color }) => (
            <g
              key={key}
              className="history-chart__point"
              role="button"
              tabIndex={0}
              aria-label={`Tower ${point.targetLevel}, ${formatFullDate(point.savedAt)}, ${point.isLowerBound ? 'at least ' : ''}${point.totalPumpkinJuicesNeeded.toLocaleString()} Pumpkin Juice${point.isLowerBound ? `, lower bound with ${point.blockedItemCount.toLocaleString()} missing baseline items` : ''}`}
              onPointerEnter={() => setActivePointKey(key)}
              onPointerLeave={() => setActivePointKey((current) => current === key ? null : current)}
              onFocus={() => setActivePointKey(key)}
              onBlur={() => setActivePointKey((current) => current === key ? null : current)}
              onClick={() => setActivePointKey(key)}
            >
              <circle className="history-chart__point-hit" cx={x} cy={y} r="12" />
              <circle
                className={`history-chart__point-marker${point.isLowerBound ? ' tower-pj-history-chart__point--incomplete' : ''}`}
                cx={x}
                cy={y}
                r="4"
                style={{ fill: point.isLowerBound ? 'var(--color-panel)' : color, stroke: color }}
              />
              {point.isLowerBound ? (
                <text className="tower-pj-history-chart__asterisk" x={x + 7} y={y - 7} aria-hidden="true">*</text>
              ) : null}
            </g>
          ))}
          {basePoints.map((point, pointIndex) => visibleTickIndexes.has(pointIndex) ? (
            <text
              key={point.snapshotId}
              className="history-chart__tick"
              x={getPointX(pointIndex, basePoints.length)}
              y="216"
              textAnchor={pointIndex === 0 ? 'start' : pointIndex === basePoints.length - 1 ? 'end' : 'middle'}
            >
              {formatDate(point.savedAt)}
            </text>
          ) : null)}
          <text className="tower-pj-history-chart__axis-title" x="327" y="235" textAnchor="middle">
            Mastery snapshot date
          </text>
          <text
            className="tower-pj-history-chart__axis-title"
            x="12"
            y="112"
            textAnchor="middle"
            transform="rotate(-90 12 112)"
          >
            Pumpkin Juice needed
          </text>
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
            <strong>T{activePoint.point.targetLevel} · {formatFullDate(activePoint.point.savedAt)}</strong>
            <span>
              {activePoint.point.isLowerBound ? 'At least ' : ''}
              {activePoint.point.totalPumpkinJuicesNeeded.toLocaleString()} PJ
              {activePoint.point.isLowerBound ? '*' : ''}
            </span>
            <span>{formatChange(activePoint.point.changeFromPrevious)}</span>
            {activePoint.point.isLowerBound ? (
              <span>
                {activePoint.point.blockedItemCount.toLocaleString()} required item
                {activePoint.point.blockedItemCount === 1 ? ' had' : 's had'} no baseline
              </span>
            ) : (
              <span>Complete mastery baseline</span>
            )}
          </div>
        ) : null}
      </div>
      <ul className="history-chart__legend history-chart__legend--items">
        {history.series.map((series, seriesIndex) => {
          const latestPoint = series.points[series.points.length - 1];
          return (
            <li key={series.targetLevel}>
              <span
                className="history-chart__swatch"
                style={{ background: SERIES_COLORS[seriesIndex % SERIES_COLORS.length] }}
              />
              T{series.targetLevel}
              {latestPoint ? ` · ${latestPoint.totalPumpkinJuicesNeeded.toLocaleString()} PJ${latestPoint.isLowerBound ? '*' : ''}` : ''}
            </li>
          );
        })}
        <li><span className="tower-pj-history-chart__dash" /> Dashed + * = lower bound</li>
      </ul>
    </div>
  );
}
