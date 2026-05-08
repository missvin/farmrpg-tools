import { PageIntro } from '../components/PageIntro';

export function HistoryPage() {
  return (
    <PageIntro
      title="Snapshot History"
      description="Review the mastery snapshots saved in this browser before comparing, backing up, or importing a newer export."
      storageKey="history"
    />
  );
}
