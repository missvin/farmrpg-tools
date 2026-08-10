import { useMemo, useRef, useState } from 'react';

import { getItemIcon } from '../lib/itemIconManifest';
import {
  T300RacePoster,
} from '../features/t300Race/T300RacePoster';
import {
  T300_POSTER_PNG_HEIGHT,
  T300_POSTER_PNG_WIDTH,
  serializeT300Poster,
} from '../features/t300Race/t300RaceExports';
import {
  FINALIST_COLORS,
  T300_TARGET,
  buildForecastHistory,
  buildProgressIntervals,
  buildRaceMetrics,
  buildStoryCsv,
  formatStoryDate,
  formatStoryDateTime,
  getCompletionColor,
  getConsolidatedFinalistSeries,
  getRequirementStateAt,
  t300StoryData,
  type T300RequirementStory,
} from '../features/t300Race/t300RaceStory';

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

function downloadBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function linePath(points: Array<{ x: number; y: number }>): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
}

function TowerMatrix({
  observedAt,
  activeLevel,
  onSelectLevel,
}: {
  observedAt: string;
  activeLevel: number;
  onSelectLevel: (level: number) => void;
}) {
  const byLevel = useMemo(() => {
    const result = new Map<number, T300RequirementStory[]>();
    for (const requirement of t300StoryData.requirements) {
      result.set(requirement.towerLevel, [...(result.get(requirement.towerLevel) ?? []), requirement]);
    }
    return result;
  }, []);
  const activeRequirements = byLevel.get(activeLevel) ?? [];

  return (
    <div className="t300-tower-workspace">
      <svg className="t300-tower-svg" viewBox="0 0 1000 680" role="img" aria-label={`Tower requirement status through ${formatStoryDate(observedAt)}`}>
        {Array.from({ length: 100 }, (_, index) => 201 + index).map((level) => {
          const row = Math.floor((level - 201) / 10);
          const column = (level - 201) % 10;
          const requirements = byLevel.get(level) ?? [];
          const x = column * 100 + 4;
          const y = (9 - row) * 67 + 8;
          const slotWidth = requirements.length > 0 ? 76 / requirements.length : 76;
          const completeCount = requirements.filter((requirement) => getRequirementStateAt(requirement, observedAt) !== 'remaining').length;

          return (
            <g
              key={level}
              className={`t300-tower-cell${activeLevel === level ? ' t300-tower-cell--active' : ''}`}
              transform={`translate(${x} ${y})`}
              role="button"
              tabIndex={0}
              aria-label={`Tower ${level}, ${completeCount} of ${requirements.length} requirements MM at this checkpoint`}
              onClick={() => onSelectLevel(level)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelectLevel(level);
                }
              }}
            >
              <rect className="t300-tower-cell__base" width="92" height="58" rx="4" />
              <text className="t300-tower-cell__level" x="9" y="20">{level}</text>
              {requirements.map((requirement, slotIndex) => {
                const state = getRequirementStateAt(requirement, observedAt);
                return (
                  <rect
                    key={requirement.canonicalKey}
                    className={`t300-tower-cell__slot t300-tower-cell__slot--${state}`}
                    x={9 + slotIndex * slotWidth}
                    y="35"
                    width={Math.max(7, slotWidth - 4)}
                    height="10"
                    rx="2"
                    style={{ fill: state === 'remaining' ? 'transparent' : getCompletionColor(requirement) }}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>
      <div className="t300-level-inspector" aria-live="polite">
        <span className="t300-level-inspector__label">T{activeLevel}</span>
        <div>
          {activeRequirements.map((requirement) => {
            const state = getRequirementStateAt(requirement, observedAt);
            return (
              <p key={requirement.canonicalKey}>
                <span className="t300-level-inspector__dot" style={{ background: getCompletionColor(requirement) }} />
                <strong>{requirement.itemName}</strong>{' '}
                <span>{state === 'remaining' ? 'not MM at this checkpoint' : state === 'foundation' ? 'MM before tracking' : `first observed MM ${formatStoryDate(requirement.firstObservedMmAt!)}`}</span>
              </p>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CampaignTimeline({ activeIndex, onSelect }: { activeIndex: number; onSelect: (index: number) => void }) {
  const snapshots = t300StoryData.campaignSnapshots;
  const startAt = Date.parse(t300StoryData.trackingStartedAt);
  const deadlineAt = Date.parse(t300StoryData.deadlineAt);
  const x = (value: string) => 48 + ((Date.parse(value) - startAt) / (deadlineAt - startAt)) * 880;
  const y = (count: number) => 218 - ((count - 145) / 24) * 176;
  const path = snapshots.flatMap((snapshot, index) => {
    if (index === 0) return [`M ${x(snapshot.observedAt)} ${y(snapshot.mmCount)}`];
    return [`H ${x(snapshot.observedAt)}`, `V ${y(snapshot.mmCount)}`];
  }).join(' ');

  return (
    <div className="t300-campaign-chart">
      <svg viewBox="0 0 960 250" role="img" aria-label="Tower MM requirement count over saved checkpoints">
        {[150, 160, 169].map((count) => (
          <g key={count}>
            <line x1="48" y1={y(count)} x2="928" y2={y(count)} className="t300-chart-grid" />
            <text x="40" y={y(count) + 5} textAnchor="end" className="t300-chart-label">{count}</text>
          </g>
        ))}
        <line x1={x(t300StoryData.deadlineAt)} y1="30" x2={x(t300StoryData.deadlineAt)} y2="222" className="t300-deadline-line" />
        <path d={path} className="t300-campaign-line" />
        {snapshots.map((snapshot, index) => (
          <g
            key={snapshot.observedAt}
            className={`t300-chart-point${index === activeIndex ? ' t300-chart-point--active' : ''}`}
            role="button"
            tabIndex={0}
            aria-label={`${formatStoryDateTime(snapshot.observedAt)}, ${snapshot.mmCount} of 169 requirements MM`}
            onClick={() => onSelect(index)}
            onFocus={() => onSelect(index)}
          >
            <circle className="t300-chart-point__hit" cx={x(snapshot.observedAt)} cy={y(snapshot.mmCount)} r="13" />
            <circle className="t300-chart-point__marker" cx={x(snapshot.observedAt)} cy={y(snapshot.mmCount)} r="5" />
          </g>
        ))}
      </svg>
    </div>
  );
}

function FinalRaceChart({ onInspect }: { onInspect: (label: string) => void }) {
  const series = getConsolidatedFinalistSeries(t300StoryData.finalistSeries);
  const metrics = buildRaceMetrics(t300StoryData);
  const startAt = Date.parse(t300StoryData.trackingStartedAt);
  const deadlineAt = Date.parse(t300StoryData.deadlineAt);
  const endAt = Math.max(deadlineAt, ...metrics.map((metric) => metric.projectedFinishAt ? Date.parse(metric.projectedFinishAt) : deadlineAt));
  const x = (value: string) => 58 + ((Date.parse(value) - startAt) / (endAt - startAt)) * 850;
  const y = (value: number) => 292 - (value / T300_TARGET) * 240;

  return (
    <svg className="t300-race-chart" viewBox="0 0 960 330" role="img" aria-label="Red Trunk Water Lily and Wizard Hat mastery race">
      {[0, 500000, 1000000].map((value) => (
        <g key={value}>
          <line x1="58" y1={y(value)} x2="908" y2={y(value)} className="t300-chart-grid" />
          <text x="50" y={y(value) + 5} textAnchor="end" className="t300-chart-label">{value === 1000000 ? '1M' : value === 500000 ? '500k' : '0'}</text>
        </g>
      ))}
      <line x1={x(t300StoryData.deadlineAt)} y1="42" x2={x(t300StoryData.deadlineAt)} y2="292" className="t300-deadline-line" />
      {t300StoryData.finalists.map((finalist) => {
        const metric = metrics.find((entry) => entry.canonicalKey === finalist.canonicalKey);
        const points = series.map((checkpoint) => ({
          checkpoint,
          x: x(checkpoint.observedAt),
          y: y(checkpoint.values[finalist.canonicalKey] ?? 0),
        }));
        const latest = points[points.length - 1];

        return (
          <g key={finalist.canonicalKey}>
            <path d={linePath(points)} fill="none" stroke={FINALIST_COLORS[finalist.canonicalKey]} className="t300-race-line" />
            {metric?.projectedFinishAt && latest ? (
              <line x1={latest.x} y1={latest.y} x2={x(metric.projectedFinishAt)} y2={y(T300_TARGET)} stroke={metric.color} className="t300-forecast-line" />
            ) : null}
            {points.map(({ checkpoint, x: pointX, y: pointY }) => (
              <g
                key={`${finalist.canonicalKey}-${checkpoint.observedAt}`}
                role="button"
                tabIndex={0}
                className="t300-chart-point"
                aria-label={`${finalist.itemName}, ${formatStoryDateTime(checkpoint.observedAt)}, mastery ${formatNumber(checkpoint.values[finalist.canonicalKey] ?? 0)}${checkpoint.approximate ? ', approximate' : ''}`}
                onPointerEnter={() => onInspect(`${finalist.itemName} · ${formatStoryDateTime(checkpoint.observedAt)} · ${formatNumber(checkpoint.values[finalist.canonicalKey] ?? 0)}${checkpoint.approximate ? ' · approximate' : ''}`)}
                onFocus={() => onInspect(`${finalist.itemName} · ${formatStoryDateTime(checkpoint.observedAt)} · ${formatNumber(checkpoint.values[finalist.canonicalKey] ?? 0)}${checkpoint.approximate ? ' · approximate' : ''}`)}
                onClick={() => onInspect(`${finalist.itemName} · ${formatStoryDateTime(checkpoint.observedAt)} · ${formatNumber(checkpoint.values[finalist.canonicalKey] ?? 0)}${checkpoint.approximate ? ' · approximate' : ''}`)}
              >
                <circle className="t300-chart-point__hit" cx={pointX} cy={pointY} r="10" />
                <circle cx={pointX} cy={pointY} r={checkpoint.approximate ? 5 : 4} fill={checkpoint.approximate ? '#11110f' : FINALIST_COLORS[finalist.canonicalKey]} stroke={FINALIST_COLORS[finalist.canonicalKey]} strokeWidth="2" />
              </g>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

function ForecastAndSignatures() {
  const latestAt = Date.parse(getConsolidatedFinalistSeries(t300StoryData.finalistSeries).slice(-1)[0].observedAt);
  const startAt = Date.parse(t300StoryData.trackingStartedAt);
  const x = (value: string) => 52 + ((Date.parse(value) - startAt) / (latestAt - startAt)) * 530;
  const y = (days: number) => 190 - ((Math.min(120, Math.max(-30, days)) + 30) / 150) * 145;

  return (
    <div className="t300-forecast-signature-grid">
      <div>
        <h3>Finish forecast vs. Aug 30</h3>
        <svg viewBox="0 0 620 220" role="img" aria-label="Projected finish date relative to the August 30 deadline">
          <line x1="52" y1={y(0)} x2="582" y2={y(0)} className="t300-deadline-line" />
          <text x="578" y={y(0) - 8} textAnchor="end" className="t300-chart-label">deadline</text>
          {t300StoryData.finalists.map((finalist) => {
            const forecast = buildForecastHistory(t300StoryData, finalist.canonicalKey).filter((point) => Math.abs(point.daysFromDeadline) <= 365);
            return (
              <path
                key={finalist.canonicalKey}
                d={linePath(forecast.map((point) => ({ x: x(point.observedAt), y: y(point.daysFromDeadline) })))}
                fill="none"
                stroke={FINALIST_COLORS[finalist.canonicalKey]}
                className="t300-forecast-history-line"
              />
            );
          })}
        </svg>
      </div>
      <div>
        <h3>Progress signatures</h3>
        <div className="t300-signature-list">
          {t300StoryData.finalists.map((finalist) => {
            const intervals = buildProgressIntervals(t300StoryData, finalist.canonicalKey).slice(-12);
            const maxRate = Math.max(1, ...intervals.map((interval) => interval.perDay));
            return (
              <div key={finalist.canonicalKey} className="t300-signature-row">
                <strong>{finalist.itemName}</strong>
                <div className="t300-signature-bars" aria-label={`${finalist.itemName} recent interval-average mastery pace`}>
                  {intervals.map((interval) => (
                    <span
                      key={interval.endedAt}
                      className={interval.approximate ? 't300-signature-bar--approximate' : undefined}
                      style={{
                        height: `${Math.max(5, (Math.max(0, interval.perDay) / maxRate) * 100)}%`,
                        background: FINALIST_COLORS[finalist.canonicalKey],
                      }}
                      title={`${formatStoryDate(interval.startedAt)}–${formatStoryDate(interval.endedAt)}: ${formatNumber(interval.perDay)} mastery/day average`}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function T300RaceStoryPage() {
  const [campaignIndex, setCampaignIndex] = useState(t300StoryData.campaignSnapshots.length - 1);
  const [activeLevel, setActiveLevel] = useState(300);
  const [pointDetail, setPointDetail] = useState('Focus or tap a point to inspect an exact saved observation.');
  const [copyStatus, setCopyStatus] = useState('');
  const posterRef = useRef<SVGSVGElement>(null);
  const campaignSnapshot = t300StoryData.campaignSnapshots[campaignIndex];
  const metrics = buildRaceMetrics(t300StoryData);
  const iconUrls = Object.fromEntries(t300StoryData.finalists.map((finalist) => [
    finalist.canonicalKey,
    getItemIcon(finalist.canonicalKey)?.src ?? null,
  ]));
  const publicationTitle = '[OC] The Race to T300: 169 FarmRPG mastery requirements over 169 days';
  const publicationComment = `Data source: ${t300StoryData.summary.rawBackupSnapshotCount} personal FarmRPG Tools mastery snapshots plus reviewed chat checkpoints. Tools: TypeScript, React, and custom SVG. Completion dates are first observed MM at saved checkpoints; no daily values were interpolated. MM means Mega Mastered and LN means Large Net. Created by ${t300StoryData.profileLabel}.`;

  async function handleSvgDownload(): Promise<void> {
    if (!posterRef.current) return;
    const svgText = await serializeT300Poster(posterRef.current);
    downloadBlob('race-to-t300-poster.svg', new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' }));
  }

  async function handlePngDownload(): Promise<void> {
    if (!posterRef.current) return;
    const svgText = await serializeT300Poster(posterRef.current);
    const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' }));
    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = T300_POSTER_PNG_WIDTH;
      canvas.height = T300_POSTER_PNG_HEIGHT;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) downloadBlob('race-to-t300-poster.png', blob);
        URL.revokeObjectURL(url);
      }, 'image/png');
    };
    image.src = url;
  }

  function handleJsonDownload(): void {
    downloadBlob('race-to-t300-data.json', new Blob([`${JSON.stringify(t300StoryData, null, 2)}\n`], { type: 'application/json' }));
  }

  function handleCsvDownload(): void {
    downloadBlob('race-to-t300-data.csv', new Blob([buildStoryCsv(t300StoryData)], { type: 'text/csv;charset=utf-8' }));
  }

  async function handleCopyPublication(): Promise<void> {
    await navigator.clipboard.writeText(`${publicationTitle}\n\n${publicationComment}`);
    setCopyStatus('Copied Reddit title and source comment.');
  }

  return (
    <article className="t300-story">
      <header className="t300-story-hero">
        <div className="t300-story-hero__inner">
          <p className="t300-story-kicker">{t300StoryData.profileLabel} · FarmRPG</p>
          <h1>The Race to T300</h1>
          <p className="t300-story-deck">169 mastery requirements across the 169 days from March 14 to August 30, 2026.</p>
          <div className="t300-story-summary" aria-label="Campaign summary">
            <span><strong>{t300StoryData.summary.startMmCount}</strong> MM at tracking start</span>
            <span><strong>{t300StoryData.summary.observedCompletionCount}</strong> first observed MM</span>
            <span><strong>{t300StoryData.summary.remainingCount}</strong> remaining on Aug 8</span>
          </div>
        </div>
      </header>

      <section className="t300-story-band" aria-labelledby="t300-tower-heading">
        <div className="t300-story-section-heading">
          <p>01 · The Tower</p>
          <h2 id="t300-tower-heading">One hundred floors. 169 MM requirements.</h2>
          <span>Each cell is a Tower level. Its bars are the item requirements encoded by the project’s Tower CSV.</span>
        </div>
        <div className="t300-scrubber">
          <button type="button" title="Previous checkpoint" aria-label="Previous checkpoint" onClick={() => setCampaignIndex((current) => Math.max(0, current - 1))}>‹</button>
          <input
            type="range"
            min="0"
            max={t300StoryData.campaignSnapshots.length - 1}
            value={campaignIndex}
            onChange={(event) => setCampaignIndex(Number(event.target.value))}
            aria-label="Campaign checkpoint"
          />
          <button type="button" title="Next checkpoint" aria-label="Next checkpoint" onClick={() => setCampaignIndex((current) => Math.min(t300StoryData.campaignSnapshots.length - 1, current + 1))}>›</button>
          <output>{formatStoryDateTime(campaignSnapshot.observedAt)} · {campaignSnapshot.mmCount}/169 MM</output>
        </div>
        <TowerMatrix observedAt={campaignSnapshot.observedAt} activeLevel={activeLevel} onSelectLevel={setActiveLevel} />
      </section>

      <section className="t300-story-band t300-story-band--warm" aria-labelledby="t300-campaign-heading">
        <div className="t300-story-section-heading">
          <p>02 · The Campaign</p>
          <h2 id="t300-campaign-heading">The staircase from 147 to 166.</h2>
          <span>Completion is dated to the first snapshot where an item was observed MM.</span>
        </div>
        <CampaignTimeline activeIndex={campaignIndex} onSelect={setCampaignIndex} />
        <div className="t300-completion-list">
          {t300StoryData.requirements.filter((requirement) => requirement.firstObservedMmAt).map((requirement) => (
            <span key={requirement.canonicalKey} style={{ borderColor: getCompletionColor(requirement) }}>
              <strong>{requirement.itemName}</strong> {formatStoryDate(requirement.firstObservedMmAt!)}
            </span>
          ))}
        </div>
      </section>

      <section className="t300-story-band" aria-labelledby="t300-race-heading">
        <div className="t300-story-section-heading">
          <p>03 · The Final Race</p>
          <h2 id="t300-race-heading">Three masteries. Three different grinds.</h2>
          <span>Solid lines are observed mastery. Dashed lines use rolling 30-day pace.</span>
        </div>
        <div className="t300-finalist-labels">
          {metrics.map((metric) => (
            <div key={metric.canonicalKey} style={{ borderColor: metric.color }}>
              {iconUrls[metric.canonicalKey] ? <img src={iconUrls[metric.canonicalKey] ?? undefined} alt="" /> : null}
              <span><strong>{metric.itemName}</strong><small>{formatNumber(metric.latestMastery)} / 1M</small></span>
              <b>{metric.paceRatio?.toFixed(2)}×</b>
              <em>{metric.projectedFinishAt ? formatStoryDate(metric.projectedFinishAt) : 'No forecast'}</em>
            </div>
          ))}
        </div>
        <FinalRaceChart onInspect={setPointDetail} />
        <p className="t300-point-detail" aria-live="polite">{pointDetail}</p>
      </section>

      <section className="t300-story-band t300-story-band--ink" aria-labelledby="t300-signatures-heading">
        <div className="t300-story-section-heading">
          <p>04 · The Signatures</p>
          <h2 id="t300-signatures-heading">Acceleration, LN bursts, and a stop-start hat grind.</h2>
          <span>Each pulse is the average mastery gained per day between two real observations. LN means Large Net.</span>
        </div>
        <ForecastAndSignatures />
      </section>

      <section className="t300-story-band" aria-labelledby="t300-poster-heading">
        <div className="t300-story-section-heading">
          <p>05 · The Poster</p>
          <h2 id="t300-poster-heading">One story model, four public formats.</h2>
          <span>The poster, interactive charts, and downloads all use the same sanitized dataset.</span>
        </div>
        <div className="t300-export-actions">
          <button type="button" onClick={handleSvgDownload}>Download SVG</button>
          <button type="button" onClick={handlePngDownload}>Download PNG</button>
          <button type="button" onClick={handleJsonDownload}>Download JSON</button>
          <button type="button" onClick={handleCsvDownload}>Download CSV</button>
        </div>
        <div className="t300-poster-frame">
          <T300RacePoster story={t300StoryData} posterRef={posterRef} iconUrls={iconUrls} />
        </div>
        <details className="t300-methodology">
          <summary>Methodology and publication copy</summary>
          <p>Snapshot dates are irregular. MM completion means first observed complete, bounded by the preceding saved snapshot. Hollow points are rounded chat observations. Forecasts use ordinary least-squares regression across available checkpoints in the trailing 30 days and require at least three points.</p>
          <p><strong>{publicationTitle}</strong></p>
          <p>{publicationComment}</p>
          <button type="button" onClick={handleCopyPublication}>Copy title and source comment</button>
          <span role="status">{copyStatus}</span>
        </details>
      </section>
    </article>
  );
}
