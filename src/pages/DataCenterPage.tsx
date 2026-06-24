import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { PageIntro } from '../components/PageIntro';
import { loadQuestHistoryState } from '../lib/questHistoryState';
import { getRouteToolMetadata, type RouteToolId } from '../lib/routeMetadata';
import { listSnapshotSummaries, type MasterySnapshotSummary } from '../lib/storage/masterySnapshots';

type SnapshotStatus = {
  isLoading: boolean;
  summaries: MasterySnapshotSummary[];
  error: string | null;
};

type ExtraLink = {
  label: string;
  to: string;
  description: string;
};

type WorkflowGroup = {
  title: string;
  description: string;
  routeIds?: RouteToolId[];
  links?: ExtraLink[];
};

const importRouteIds: RouteToolId[] = [
  'importMastery',
  'importInventory',
  'importPetItems',
  'importLocksmith',
  'questHistory',
  'importHelp',
];

const workflowGroups: WorkflowGroup[] = [
  {
    title: 'Import Local Data',
    description: 'Bring FarmRPG exports into this browser without changing the local-first storage model.',
    routeIds: importRouteIds,
  },
  {
    title: 'Review Progress Data',
    description: 'Use saved snapshots to review progress over time or compare two local imports.',
    routeIds: ['history', 'compare'],
  },
  {
    title: 'Backup, Restore, and Settings',
    description: 'Export or restore one local backup file, then tune app preferences and planning assumptions.',
    routeIds: ['settings'],
    links: [
      {
        label: 'Restore Backup',
        to: '/settings#settings-restore-title',
        description: 'Review and restore a previously exported local backup file.',
      },
      {
        label: 'Daily Source Rates',
        to: '/settings#settings-source-rate-title',
        description: 'Adjust local source-rate assumptions used by planning surfaces.',
      },
      {
        label: 'Owned Stockpiles',
        to: '/settings#settings-owned-stockpiles-title',
        description: 'Save local stockpile and container assumptions for acquisition planning.',
      },
    ],
  },
];

function getInitialSnapshotStatus(): SnapshotStatus {
  return {
    isLoading: true,
    summaries: [],
    error: null,
  };
}

function formatSavedAt(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function routeLink(routeId: RouteToolId): ExtraLink {
  const metadata = getRouteToolMetadata(routeId);

  return {
    label: metadata.label,
    to: metadata.path,
    description: metadata.description,
  };
}

function LinkCard({ link }: { link: ExtraLink }) {
  return (
    <Link className="quick-link-card" to={link.to}>
      <span className="quick-link-card__title">{link.label}</span>
      <span className="quick-link-card__description">{link.description}</span>
    </Link>
  );
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

export function DataCenterPage() {
  const [snapshotStatus, setSnapshotStatus] = useState<SnapshotStatus>(getInitialSnapshotStatus);
  const questHistoryState = useMemo(() => loadQuestHistoryState(), []);
  const latestQuestImport = questHistoryState.imports[0] ?? null;
  const latestSnapshot = snapshotStatus.summaries[0] ?? null;

  useEffect(() => {
    let cancelled = false;

    void listSnapshotSummaries()
      .then((summaries) => {
        if (!cancelled) {
          setSnapshotStatus({
            isLoading: false,
            summaries,
            error: null,
          });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setSnapshotStatus({
            isLoading: false,
            summaries: [],
            error: error instanceof Error ? error.message : 'Unable to read local snapshot history.',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const nextActions = latestSnapshot
    ? [routeLink('history'), routeLink('compare'), routeLink('settings')]
    : [routeLink('importMastery'), { label: 'Restore Backup', to: '/settings#settings-restore-title', description: 'Load a previously exported local backup file.' }, routeLink('importHelp')];

  return (
    <div className="page-stack">
      <PageIntro
        title="Data"
        description="Manage local imports, backup and restore, snapshot history, comparisons, and settings from one place."
        storageKey="data-center"
      />

      <section className="page-card page-stack" aria-labelledby="data-status-title">
        <div>
          <h2 id="data-status-title">Local Data Status</h2>
          <p className="supporting-text">
            This page only reads local browser data and points to the existing import, restore, history, and settings workflows.
          </p>
        </div>

        <dl className="summary-grid">
          <div className="summary-grid__item">
            <dt>Mastery snapshots</dt>
            <dd>
              {snapshotStatus.isLoading
                ? 'Checking local snapshot history...'
                : snapshotStatus.error
                  ? 'Snapshot history could not be read.'
                  : latestSnapshot
                    ? `${snapshotStatus.summaries.length.toLocaleString()} saved ${pluralize(snapshotStatus.summaries.length, 'snapshot')}.`
                    : 'No saved mastery snapshots yet.'}
            </dd>
            <p className="subtle-text">
              {snapshotStatus.error
                ? snapshotStatus.error
                : latestSnapshot
                  ? `Latest saved ${formatSavedAt(latestSnapshot.savedAt)} with ${latestSnapshot.itemCount.toLocaleString()} parsed items.`
                  : 'Import mastery data or restore a backup to unlock progress analysis.'}
            </p>
            <p className="subtle-text">
              <Link to={latestSnapshot ? '/history' : '/import'}>{latestSnapshot ? 'Open History' : 'Import Mastery'}</Link>
            </p>
          </div>

          <div className="summary-grid__item">
            <dt>Quest history</dt>
            <dd>
              {latestQuestImport
                ? `${questHistoryState.imports.length.toLocaleString()} saved ${pluralize(questHistoryState.imports.length, 'import')}.`
                : 'No completed quest history imports saved yet.'}
            </dd>
            <p className="subtle-text">
              {latestQuestImport
                ? `Latest import has ${latestQuestImport.completedRequests.length.toLocaleString()} completed requests and ${latestQuestImport.activeRequests.length.toLocaleString()} active requests.`
                : 'Quest and future-demand planning can still be opened, but completed-history context is missing.'}
            </p>
            <p className="subtle-text">
              <Link to="/quest-history">Open Quest History</Link>
            </p>
          </div>

          <div className="summary-grid__item">
            <dt>Backup and restore</dt>
            <dd>Available in Settings.</dd>
            <p className="subtle-text">
              Export a local backup for safekeeping or restore an existing backup without adding a backend or account layer.
            </p>
            <p className="subtle-text">
              <Link to="/settings#settings-backup-title">Export Backup</Link>
              {' | '}
              <Link to="/settings#settings-restore-title">Restore Backup</Link>
            </p>
          </div>
        </dl>
      </section>

      <section className="page-card page-stack" aria-labelledby="data-next-actions-title">
        <div>
          <h2 id="data-next-actions-title">Next Data Actions</h2>
          <p className="supporting-text">Start with the actions that match the local data currently available.</p>
        </div>

        <div className="quick-link-grid">
          {nextActions.map((link) => (
            <LinkCard key={`${link.to}-${link.label}`} link={link} />
          ))}
        </div>
      </section>

      {workflowGroups.map((group) => (
        <section className="page-card page-stack" aria-labelledby={`data-${group.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-title`} key={group.title}>
          <div>
            <h2 id={`data-${group.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-title`}>{group.title}</h2>
            <p className="supporting-text">{group.description}</p>
          </div>

          <div className="quick-link-grid">
            {group.routeIds?.map((routeId) => <LinkCard key={routeId} link={routeLink(routeId)} />)}
            {group.links?.map((link) => <LinkCard key={link.to} link={link} />)}
          </div>
        </section>
      ))}
    </div>
  );
}