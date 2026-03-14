import { useEffect, useState } from 'react';

import { PageIntro } from '../components/PageIntro';
import { getLatestSnapshot } from '../lib/storage/masterySnapshots';

function formatTierList(tiers: Array<number | 'INF'>): string {
  if (tiers.length === 0) {
    return 'None detected';
  }

  return tiers.map((tier) => (tier === 'INF' ? 'INF' : tier.toLocaleString())).join(', ');
}

export function DashboardPage() {
  const [latestSnapshotState, setLatestSnapshotState] = useState<{
    isLoading: boolean;
    error: string | null;
    snapshot: Awaited<ReturnType<typeof getLatestSnapshot>>;
  }>({
    isLoading: true,
    error: null,
    snapshot: null,
  });

  useEffect(() => {
    let isMounted = true;

    void getLatestSnapshot()
      .then((snapshot) => {
        if (!isMounted) {
          return;
        }

        setLatestSnapshotState({
          isLoading: false,
          error: null,
          snapshot,
        });
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        setLatestSnapshotState({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unable to load local snapshots.',
          snapshot: null,
        });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="page-stack">
      <PageIntro
        title="Dashboard"
        description="View a quick summary of your FarmRPG mastery progress and recent snapshots."
      />

      <section className="page-card page-stack" aria-labelledby="latest-snapshot-title">
        <div>
          <h2 id="latest-snapshot-title">Latest Snapshot</h2>
          <p className="supporting-text">
            A small local-only summary so you can confirm your most recent import was saved.
          </p>
        </div>

        {latestSnapshotState.isLoading ? <p className="empty-state">Loading local snapshot summary...</p> : null}

        {!latestSnapshotState.isLoading && latestSnapshotState.error ? (
          <p className="status-message status-message--error">{latestSnapshotState.error}</p>
        ) : null}

        {!latestSnapshotState.isLoading &&
        !latestSnapshotState.error &&
        !latestSnapshotState.snapshot ? (
          <p className="empty-state">No saved snapshots yet. Import a mastery export to create your first one.</p>
        ) : null}

        {!latestSnapshotState.isLoading && latestSnapshotState.snapshot ? (
          <dl className="summary-grid">
            <div className="summary-grid__item">
              <dt>Saved at</dt>
              <dd>{new Date(latestSnapshotState.snapshot.createdAt).toLocaleString()}</dd>
            </div>
            <div className="summary-grid__item">
              <dt>Items parsed</dt>
              <dd>{latestSnapshotState.snapshot.parseSummary.itemsParsed.toLocaleString()}</dd>
            </div>
            <div className="summary-grid__item">
              <dt>Tiers detected</dt>
              <dd>{formatTierList(latestSnapshotState.snapshot.parseSummary.tiersDetected)}</dd>
            </div>
          </dl>
        ) : null}
      </section>
    </div>
  );
}
