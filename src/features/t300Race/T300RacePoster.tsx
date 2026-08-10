import type { RefObject } from 'react';

import {
  FINALIST_COLORS,
  T300_TARGET,
  buildForecastHistory,
  buildProgressIntervals,
  buildRaceMetrics,
  formatStoryDate,
  getCompletionColor,
  getConsolidatedFinalistSeries,
  type T300StoryData,
} from './t300RaceStory';

type T300RacePosterProps = {
  story: T300StoryData;
  posterRef: RefObject<SVGSVGElement>;
  iconUrls: Record<string, string | null>;
};

export const T300_POSTER_WIDTH = 1600;
export const T300_POSTER_HEIGHT = 2400;

function linePath(points: Array<{ x: number; y: number }>): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function T300RacePoster({ story, posterRef, iconUrls }: T300RacePosterProps) {
  const series = getConsolidatedFinalistSeries(story.finalistSeries);
  const metrics = buildRaceMetrics(story);
  const latest = series[series.length - 1];
  const startAt = Date.parse(story.trackingStartedAt);
  const deadlineAt = Date.parse(story.deadlineAt);
  const raceEndAt = Math.max(
    deadlineAt,
    ...metrics.map((metric) => metric.projectedFinishAt ? Date.parse(metric.projectedFinishAt) : deadlineAt),
  );
  const towerByLevel = new Map<number, typeof story.requirements>();
  for (const requirement of story.requirements) {
    const rows = towerByLevel.get(requirement.towerLevel) ?? [];
    rows.push(requirement);
    towerByLevel.set(requirement.towerLevel, rows);
  }
  const campaignX = (observedAt: string) => 110 + ((Date.parse(observedAt) - startAt) / (deadlineAt - startAt)) * 1380;
  const campaignY = (count: number) => 1320 - ((count - 145) / 24) * 220;
  const campaignPoints = story.campaignSnapshots.map((snapshot) => ({
    x: campaignX(snapshot.observedAt),
    y: campaignY(snapshot.mmCount),
  }));
  const campaignPath = campaignPoints.flatMap((point, index) => {
    if (index === 0) return [`M ${point.x.toFixed(1)} ${point.y.toFixed(1)}`];
    return [`H ${point.x.toFixed(1)}`, `V ${point.y.toFixed(1)}`];
  }).join(' ');
  const raceX = (observedAt: string) => 110 + ((Date.parse(observedAt) - startAt) / (raceEndAt - startAt)) * 1380;
  const raceY = (value: number) => 1750 - (value / T300_TARGET) * 300;

  return (
    <svg
      ref={posterRef}
      className="t300-poster"
      viewBox={`0 0 ${T300_POSTER_WIDTH} ${T300_POSTER_HEIGHT}`}
      width={T300_POSTER_WIDTH}
      height={T300_POSTER_HEIGHT}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-labelledby="t300-poster-title t300-poster-desc"
    >
      <title id="t300-poster-title">The Race to T300 poster</title>
      <desc id="t300-poster-desc">A visual history of 169 FarmRPG Tower mastery requirements tracked by @blackberry.</desc>
      <defs>
        <style>{`
          .poster-kicker{font:700 24px Arial,sans-serif;letter-spacing:2px;fill:#efc45b}
          .poster-title{font:700 70px Arial,sans-serif;fill:#fffdf5}
          .poster-subtitle{font:400 28px Arial,sans-serif;fill:#c8c5bb}
          .poster-section{font:700 34px Arial,sans-serif;fill:#fffdf5}
          .poster-label{font:700 19px Arial,sans-serif;fill:#fffdf5}
          .poster-small{font:400 17px Arial,sans-serif;fill:#a9a69d}
          .poster-number{font:700 38px Arial,sans-serif;fill:#fffdf5}
          .poster-axis{stroke:#514f49;stroke-width:2}
          .poster-grid{stroke:#34332f;stroke-width:1}
        `}</style>
      </defs>
      <rect width={T300_POSTER_WIDTH} height={T300_POSTER_HEIGHT} fill="#11110f" />
      <text className="poster-kicker" x="80" y="86">@BLACKBERRY · FARMRPG</text>
      <text className="poster-title" x="80" y="170">The Race to T300</text>
      <text className="poster-subtitle" x="80" y="220">169 mastery requirements across the 169 days from March 14 to August 30, 2026.</text>

      <g transform="translate(80 270)">
        <text className="poster-number" x="0" y="0">147</text>
        <text className="poster-small" x="0" y="28">MM at tracking start</text>
        <text className="poster-number" x="310" y="0">19</text>
        <text className="poster-small" x="310" y="28">first observed MM</text>
        <text className="poster-number" x="620" y="0">3</text>
        <text className="poster-small" x="620" y="28">remaining on Aug 8</text>
        <text className="poster-number" x="930" y="0">169</text>
        <text className="poster-small" x="930" y="28">Tower requirements</text>
      </g>

      <text className="poster-section" x="80" y="380">The Tower</text>
      <text className="poster-small" x="80" y="412">T201–T300 · each floor contains one to three MM requirements</text>
      <g transform="translate(80 445)">
        {Array.from({ length: 100 }, (_, index) => 201 + index).map((level) => {
          const decadeRow = Math.floor((level - 201) / 10);
          const column = (level - 201) % 10;
          const x = column * 144;
          const y = (9 - decadeRow) * 66;
          const requirements = towerByLevel.get(level) ?? [];
          const slotWidth = requirements.length > 0 ? 104 / requirements.length : 104;

          return (
            <g key={level} transform={`translate(${x} ${y})`}>
              <rect width="132" height="56" rx="4" fill="#1c1c19" stroke="#34332f" />
              <text x="10" y="21" className="poster-small">{level}</text>
              {requirements.map((requirement, slotIndex) => (
                <rect
                  key={requirement.canonicalKey}
                  x={10 + slotIndex * slotWidth}
                  y="34"
                  width={Math.max(7, slotWidth - 4)}
                  height="10"
                  rx="2"
                  fill={getCompletionColor(requirement)}
                  stroke={!requirement.completedBeforeTracking && !requirement.firstObservedMmAt ? '#fffdf5' : 'none'}
                  strokeWidth="2"
                />
              ))}
            </g>
          );
        })}
      </g>

      <text className="poster-section" x="80" y="1040">The campaign</text>
      <text className="poster-small" x="80" y="1072">First observed complete at saved checkpoints; no daily interpolation.</text>
      <line className="poster-axis" x1="110" y1="1320" x2="1490" y2="1320" />
      {[150, 160, 169].map((count) => (
        <g key={count}>
          <line className="poster-grid" x1="110" y1={campaignY(count)} x2="1490" y2={campaignY(count)} />
          <text className="poster-small" x="102" y={campaignY(count) + 5} textAnchor="end">{count}</text>
        </g>
      ))}
      <path d={campaignPath} fill="none" stroke="#efc45b" strokeWidth="7" strokeLinejoin="round" />
      {story.campaignSnapshots.map((snapshot) => (
        <circle key={snapshot.observedAt} cx={campaignX(snapshot.observedAt)} cy={campaignY(snapshot.mmCount)} r="6" fill="#fffdf5" />
      ))}
      <text className="poster-label" x={campaignX(story.campaignSnapshots[0].observedAt)} y="1360">147</text>
      <text className="poster-label" x={campaignX(story.campaignSnapshots[story.campaignSnapshots.length - 1].observedAt)} y="1105" textAnchor="end">166</text>

      <text className="poster-section" x="80" y="1420">The final three</text>
      <text className="poster-small" x="80" y="1452">Observed mastery, with rolling 30-day forecasts drawn beyond the latest checkpoint.</text>
      <line className="poster-grid" x1="110" y1={raceY(T300_TARGET)} x2="1490" y2={raceY(T300_TARGET)} />
      <text className="poster-small" x="102" y={raceY(T300_TARGET) + 5} textAnchor="end">1M</text>
      <line x1={raceX(story.deadlineAt)} y1="1450" x2={raceX(story.deadlineAt)} y2="1770" stroke="#efc45b" strokeWidth="3" strokeDasharray="10 9" />
      <text className="poster-small" x={raceX(story.deadlineAt) - 8} y="1476" textAnchor="end">Aug 30 deadline</text>
      {story.finalists.map((finalist) => {
        const metric = metrics.find((entry) => entry.canonicalKey === finalist.canonicalKey);
        const color = FINALIST_COLORS[finalist.canonicalKey];
        const points = series.map((checkpoint) => ({
          x: raceX(checkpoint.observedAt),
          y: raceY(checkpoint.values[finalist.canonicalKey] ?? 0),
        }));
        const latestPoint = points[points.length - 1];

        return (
          <g key={finalist.canonicalKey}>
            <path d={linePath(points)} fill="none" stroke={color} strokeWidth="6" strokeLinejoin="round" />
            {metric?.projectedFinishAt && latestPoint ? (
              <line
                x1={latestPoint.x}
                y1={latestPoint.y}
                x2={raceX(metric.projectedFinishAt)}
                y2={raceY(T300_TARGET)}
                stroke={color}
                strokeWidth="5"
                strokeDasharray="12 10"
              />
            ) : null}
            {latestPoint ? <circle cx={latestPoint.x} cy={latestPoint.y} r="9" fill={color} /> : null}
            {iconUrls[finalist.canonicalKey] && latestPoint ? (
              <image href={iconUrls[finalist.canonicalKey] ?? undefined} x={latestPoint.x + 12} y={latestPoint.y - 28} width="48" height="48" />
            ) : null}
          </g>
        );
      })}

      <g transform="translate(80 1840)">
        {metrics.map((metric, index) => {
          const y = index * 76;
          const ratio = metric.paceRatio ?? 0;
          return (
            <g key={metric.canonicalKey} transform={`translate(0 ${y})`}>
              <text className="poster-label" x="0" y="24">{metric.itemName}</text>
              <rect x="280" y="4" width="720" height="24" rx="4" fill="#292824" />
              <rect x="280" y="4" width={clamp(ratio / 3, 0, 1) * 720} height="24" rx="4" fill={metric.color} />
              <line x1={280 + 240} y1="0" x2={280 + 240} y2="34" stroke="#fffdf5" strokeWidth="2" />
              <text className="poster-label" x="1040" y="24">{ratio.toFixed(2)}× required pace</text>
              <text className="poster-small" x="1330" y="24" textAnchor="end">
                {metric.projectedFinishAt ? formatStoryDate(metric.projectedFinishAt, true) : 'No forecast'}
              </text>
            </g>
          );
        })}
      </g>

      <text className="poster-section" x="80" y="2085">How the finish line moved</text>
      {story.finalists.map((finalist, finalistIndex) => {
        const forecast = buildForecastHistory(story, finalist.canonicalKey).filter((point) => Math.abs(point.daysFromDeadline) <= 365);
        const x = (observedAt: string) => 110 + ((Date.parse(observedAt) - startAt) / (Date.parse(latest.observedAt) - startAt)) * 820;
        const y = (days: number) => 2260 - ((clamp(days, -30, 120) + 30) / 150) * 130;
        const path = linePath(forecast.map((point) => ({ x: x(point.observedAt), y: y(point.daysFromDeadline) })));
        const intervals = buildProgressIntervals(story, finalist.canonicalKey).slice(-10);
        const maxRate = Math.max(1, ...intervals.map((interval) => interval.perDay));

        return (
          <g key={finalist.canonicalKey}>
            {path ? <path d={path} fill="none" stroke={FINALIST_COLORS[finalist.canonicalKey]} strokeWidth="4" /> : null}
            <g transform={`translate(1010 ${2110 + finalistIndex * 70})`}>
              <text className="poster-small" x="0" y="18">{finalist.itemName}</text>
              {intervals.map((interval, index) => (
                <rect
                  key={interval.endedAt}
                  x={180 + index * 34}
                  y={32 - (Math.max(0, interval.perDay) / maxRate) * 30}
                  width="24"
                  height={(Math.max(0, interval.perDay) / maxRate) * 30}
                  fill={FINALIST_COLORS[finalist.canonicalKey]}
                  opacity={interval.approximate ? 0.45 : 0.9}
                />
              ))}
            </g>
          </g>
        );
      })}
      <line x1="110" y1={2260 - (30 / 150) * 130} x2="930" y2={2260 - (30 / 150) * 130} stroke="#fffdf5" strokeWidth="2" strokeDasharray="7 7" />
      <text className="poster-small" x="935" y={2260 - (30 / 150) * 130 + 5}>deadline</text>

      <line x1="80" y1="2320" x2="1520" y2="2320" stroke="#34332f" />
      <text className="poster-small" x="80" y="2360">Source: 26 FarmRPG Tools mastery snapshots plus reviewed chat checkpoints. MM = Mega Mastered. LN = Large Net.</text>
      <text className="poster-small" x="1520" y="2360" textAnchor="end">Created with FarmRPG Tools · @blackberry</text>
    </svg>
  );
}
