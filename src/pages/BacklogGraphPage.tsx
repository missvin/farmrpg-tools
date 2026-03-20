import { useEffect, useState } from 'react';

import { PageIntro } from '../components/PageIntro';
import { BacklogGraphView } from '../features/backlogGraph/BacklogGraphView';
import { loadBacklogGraph, type BacklogGraphData } from '../lib/loadBacklogGraph';

export function BacklogGraphPage() {
  const [graphState, setGraphState] = useState<{
    isLoading: boolean;
    error: string | null;
    graph: BacklogGraphData | null;
  }>({
    isLoading: true,
    error: null,
    graph: null,
  });

  useEffect(() => {
    let isMounted = true;

    void loadBacklogGraph()
      .then((graph) => {
        if (!isMounted) {
          return;
        }

        setGraphState({
          isLoading: false,
          error: null,
          graph,
        });
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        setGraphState({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unable to load local backlog graph data.',
          graph: null,
        });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="page-stack">
      <PageIntro
        title="Backlog Graph"
        description="Internal local-only project-planning view over backlog relationships. This page is read-only support data, not gameplay or canonical reference logic."
      />
      <BacklogGraphView graphState={graphState} />
    </div>
  );
}
