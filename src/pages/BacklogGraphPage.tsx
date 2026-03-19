import { useEffect, useMemo, useState } from 'react';

import { PageIntro } from '../components/PageIntro';
import {
  loadBacklogGraph,
  type BacklogGraphData,
  type BacklogGraphNode,
  type BacklogGraphWarning,
} from '../lib/loadBacklogGraph';

type RelationshipGroups = {
  parent: BacklogGraphNode | null;
  dependencies: BacklogGraphNode[];
  children: BacklogGraphNode[];
  dependents: BacklogGraphNode[];
};

function compareNodes(left: BacklogGraphNode, right: BacklogGraphNode): number {
  return left.displayTitle.localeCompare(right.displayTitle);
}

function buildRelationshipGroups(graph: BacklogGraphData, selectedNodeId: string): RelationshipGroups {
  const parentEdge = graph.edges.find(
    (edge) => edge.relationship === 'parent_child' && edge.to === selectedNodeId,
  );

  const dependencyNodes = graph.edges
    .filter((edge) => edge.relationship === 'dependency' && edge.to === selectedNodeId)
    .map((edge) => graph.byId[edge.from])
    .filter(Boolean)
    .sort(compareNodes);

  const childNodes = graph.edges
    .filter((edge) => edge.relationship === 'parent_child' && edge.from === selectedNodeId)
    .map((edge) => graph.byId[edge.to])
    .filter(Boolean)
    .sort(compareNodes);

  const dependentNodes = graph.edges
    .filter((edge) => edge.relationship === 'dependency' && edge.from === selectedNodeId)
    .map((edge) => graph.byId[edge.to])
    .filter(Boolean)
    .sort(compareNodes);

  return {
    parent: parentEdge ? graph.byId[parentEdge.from] ?? null : null,
    dependencies: dependencyNodes,
    children: childNodes,
    dependents: dependentNodes,
  };
}

function formatWarningLabel(warning: BacklogGraphWarning): string {
  if (!warning.backlogId) {
    return warning.message;
  }

  return `${warning.backlogId}: ${warning.message}`;
}

function MetaPill({ label }: { label: string }) {
  return <span className="meta-pill">{label}</span>;
}

function RelatedNodeButton({
  node,
  relationshipLabel,
  isSelected,
  onSelect,
}: {
  node: BacklogGraphNode;
  relationshipLabel: string;
  isSelected: boolean;
  onSelect: (nodeId: string) => void;
}) {
  return (
    <button
      type="button"
      className={isSelected ? 'backlog-node-card backlog-node-card--selected' : 'backlog-node-card'}
      onClick={() => onSelect(node.id)}
    >
      <span className="backlog-node-card__relationship">{relationshipLabel}</span>
      <strong>{node.displayTitle}</strong>
      <span className="subtle-text">
        {node.status} | {node.type} | {node.area}
      </span>
    </button>
  );
}

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
  const [selectedNodeId, setSelectedNodeId] = useState('');

  useEffect(() => {
    let isMounted = true;

    void loadBacklogGraph()
      .then((graph) => {
        if (!isMounted) {
          return;
        }

        const defaultNodeId = graph.nodes[0]?.id ?? '';
        setGraphState({
          isLoading: false,
          error: null,
          graph,
        });
        setSelectedNodeId(defaultNodeId);
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

  const selectedNode = useMemo(() => {
    if (!graphState.graph || !selectedNodeId) {
      return null;
    }

    return graphState.graph.byId[selectedNodeId] ?? null;
  }, [graphState.graph, selectedNodeId]);

  const relationshipGroups = useMemo(() => {
    if (!graphState.graph || !selectedNode) {
      return null;
    }

    return buildRelationshipGroups(graphState.graph, selectedNode.id);
  }, [graphState.graph, selectedNode]);

  return (
    <div className="page-stack">
      <PageIntro
        title="Backlog Graph"
        description="Internal local-only project-planning view over backlog relationships. This page is read-only support data, not gameplay or canonical reference logic."
      />

      <section className="page-card page-stack" aria-labelledby="backlog-graph-controls-title">
        <div>
          <h2 id="backlog-graph-controls-title">Select Backlog Item</h2>
          <p className="supporting-text">
            Choose one item to inspect its immediate dependency neighborhood. This first version stays intentionally
            readable instead of rendering the whole backlog as a dense hairball.
          </p>
        </div>

        {graphState.isLoading ? <p className="empty-state">Loading local backlog metadata...</p> : null}
        {!graphState.isLoading && graphState.error ? (
          <p className="status-message status-message--error">{graphState.error}</p>
        ) : null}
        {!graphState.isLoading && !graphState.error && graphState.graph?.nodes.length === 0 ? (
          <p className="empty-state">No backlog items were available for graph rendering.</p>
        ) : null}

        {graphState.graph && graphState.graph.nodes.length > 0 ? (
          <div className="page-stack page-stack--tight">
            <label className="field-label" htmlFor="backlog-graph-select">
              Backlog item
            </label>
            <select
              id="backlog-graph-select"
              className="text-input"
              value={selectedNodeId}
              onChange={(event) => setSelectedNodeId(event.target.value)}
            >
              {graphState.graph.nodes
                .slice()
                .sort(compareNodes)
                .map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.displayTitle} ({node.id})
                  </option>
                ))}
            </select>
          </div>
        ) : null}
      </section>

      {graphState.graph && graphState.graph.warnings.length > 0 ? (
        <section className="page-card page-stack" aria-labelledby="backlog-graph-warnings-title">
          <div>
            <h2 id="backlog-graph-warnings-title">Backlog Warnings</h2>
            <p className="supporting-text">
              Malformed or unresolved backlog references stay non-fatal here and do not break the rest of the app.
            </p>
          </div>

          <ul className="data-list">
            {graphState.graph.warnings.map((warning, index) => (
              <li key={`${warning.code}-${warning.backlogId ?? 'global'}-${warning.referenceId ?? index}`}>
                <div>
                  <strong>{warning.code}</strong>
                  <p className="subtle-text">{formatWarningLabel(warning)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {selectedNode && relationshipGroups ? (
        <>
          <section className="page-card page-stack" aria-labelledby="backlog-graph-map-title">
            <div>
              <h2 id="backlog-graph-map-title">Dependency Neighborhood</h2>
              <p className="supporting-text">
                The selected item sits in the middle, with immediate upstream work on the left and downstream work on
                the right.
              </p>
            </div>

            <div className="backlog-graph-layout">
              <section className="backlog-graph-column" aria-labelledby="backlog-graph-upstream-title">
                <h3 id="backlog-graph-upstream-title" className="section-title">
                  Upstream
                </h3>
                <div className="backlog-graph-column__stack">
                  {relationshipGroups.parent ? (
                    <RelatedNodeButton
                      node={relationshipGroups.parent}
                      relationshipLabel="Parent"
                      isSelected={relationshipGroups.parent.id === selectedNode.id}
                      onSelect={setSelectedNodeId}
                    />
                  ) : null}

                  {relationshipGroups.dependencies.map((node) => (
                    <RelatedNodeButton
                      key={`dependency-${node.id}`}
                      node={node}
                      relationshipLabel="Dependency"
                      isSelected={node.id === selectedNode.id}
                      onSelect={setSelectedNodeId}
                    />
                  ))}

                  {!relationshipGroups.parent && relationshipGroups.dependencies.length === 0 ? (
                    <p className="empty-state">No immediate upstream relationships.</p>
                  ) : null}
                </div>
              </section>

              <section className="backlog-graph-column" aria-labelledby="backlog-graph-selected-title">
                <h3 id="backlog-graph-selected-title" className="section-title">
                  Selected
                </h3>
                <article className="backlog-node-card backlog-node-card--selected">
                  <strong>{selectedNode.displayTitle}</strong>
                  <div className="backlog-node-card__meta">
                    <MetaPill label={selectedNode.id} />
                    <MetaPill label={selectedNode.status} />
                    <MetaPill label={selectedNode.type} />
                    <MetaPill label={selectedNode.area} />
                    <MetaPill label={selectedNode.priority} />
                  </div>
                  {selectedNode.displaySummary ? (
                    <p className="subtle-text">{selectedNode.displaySummary}</p>
                  ) : null}
                </article>
              </section>

              <section className="backlog-graph-column" aria-labelledby="backlog-graph-downstream-title">
                <h3 id="backlog-graph-downstream-title" className="section-title">
                  Downstream
                </h3>
                <div className="backlog-graph-column__stack">
                  {relationshipGroups.children.map((node) => (
                    <RelatedNodeButton
                      key={`child-${node.id}`}
                      node={node}
                      relationshipLabel="Child"
                      isSelected={node.id === selectedNode.id}
                      onSelect={setSelectedNodeId}
                    />
                  ))}

                  {relationshipGroups.dependents.map((node) => (
                    <RelatedNodeButton
                      key={`dependent-${node.id}`}
                      node={node}
                      relationshipLabel="Dependent"
                      isSelected={node.id === selectedNode.id}
                      onSelect={setSelectedNodeId}
                    />
                  ))}

                  {relationshipGroups.children.length === 0 && relationshipGroups.dependents.length === 0 ? (
                    <p className="empty-state">No immediate downstream relationships.</p>
                  ) : null}
                </div>
              </section>
            </div>
          </section>

          <section className="page-card page-stack" aria-labelledby="backlog-graph-detail-title">
            <div>
              <h2 id="backlog-graph-detail-title">Selected Item Detail</h2>
              <p className="supporting-text">
                Friendly fields come first for human readability, followed by the underlying implementation details.
              </p>
            </div>

            <div className="page-stack page-stack--tight">
              <h3 className="section-title">{selectedNode.displayTitle}</h3>
              {selectedNode.displaySummary ? <p>{selectedNode.displaySummary}</p> : null}
              {selectedNode.displayDescription ? <p>{selectedNode.displayDescription}</p> : null}
            </div>

            <dl className="summary-grid">
              <div className="summary-grid__item">
                <dt>Backlog id</dt>
                <dd>{selectedNode.id}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Status</dt>
                <dd>{selectedNode.status}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Type</dt>
                <dd>{selectedNode.type}</dd>
              </div>
              <div className="summary-grid__item">
                <dt>Area</dt>
                <dd>{selectedNode.area}</dd>
              </div>
            </dl>

            <div className="page-stack page-stack--tight">
              <h3 className="section-title">Implementation Details</h3>
              <dl className="backlog-detail-list">
                <div>
                  <dt>Technical title</dt>
                  <dd>{selectedNode.detail.title}</dd>
                </div>
                <div>
                  <dt>User value</dt>
                  <dd>{selectedNode.detail.userValue || 'None recorded.'}</dd>
                </div>
                <div>
                  <dt>Proposed solution</dt>
                  <dd>{selectedNode.detail.proposedSolution || 'None recorded.'}</dd>
                </div>
                <div>
                  <dt>Scope v1</dt>
                  <dd>{selectedNode.detail.scopeV1 || 'None recorded.'}</dd>
                </div>
                <div>
                  <dt>Dependencies</dt>
                  <dd>{selectedNode.detail.dependenciesText || 'None recorded.'}</dd>
                </div>
                <div>
                  <dt>Notes</dt>
                  <dd>{selectedNode.detail.notes || 'None recorded.'}</dd>
                </div>
              </dl>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
