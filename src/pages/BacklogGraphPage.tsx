import { useEffect, useMemo, useState } from 'react';

import { PageIntro } from '../components/PageIntro';
import {
  loadBacklogGraph,
  type BacklogGraphData,
  type BacklogGraphEdge,
  type BacklogGraphNode,
  type BacklogGraphWarning,
} from '../lib/loadBacklogGraph';

type FocusMode = 'neighborhood' | 'expanded';

type RelationshipGroups = {
  upstream: RelatedNodeEntry[];
  downstream: RelatedNodeEntry[];
};

type RelatedNodeEntry = {
  node: BacklogGraphNode;
  relationshipLabel: string;
};

function compareNodes(left: BacklogGraphNode, right: BacklogGraphNode): number {
  return left.displayTitle.localeCompare(right.displayTitle);
}

function mergeRelatedNodes(
  relatedNodes: Array<{ node: BacklogGraphNode; relationshipLabel: string }>,
): RelatedNodeEntry[] {
  const byNodeId = new Map<string, RelatedNodeEntry>();

  for (const { node, relationshipLabel } of relatedNodes) {
    const existingEntry = byNodeId.get(node.id);

    if (!existingEntry) {
      byNodeId.set(node.id, {
        node,
        relationshipLabel,
      });
      continue;
    }

    const existingLabels = existingEntry.relationshipLabel.split(' + ');

    if (!existingLabels.includes(relationshipLabel)) {
      existingEntry.relationshipLabel = `${existingEntry.relationshipLabel} + ${relationshipLabel}`;
    }
  }

  return Array.from(byNodeId.values()).sort((left, right) => compareNodes(left.node, right.node));
}

function matchesFilters(
  node: BacklogGraphNode,
  filters: {
    area: string;
    status: string;
  },
): boolean {
  return (!filters.area || node.area === filters.area) && (!filters.status || node.status === filters.status);
}

function collectFilterOptions(nodes: BacklogGraphNode[], field: 'area' | 'status'): string[] {
  return Array.from(
    new Set(
      nodes
        .map((node) => node[field].trim())
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

function buildImmediateRelationshipGroups(graph: BacklogGraphData, selectedNodeId: string): RelationshipGroups {
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
    upstream: mergeRelatedNodes([
      ...(parentEdge && graph.byId[parentEdge.from]
        ? [{ node: graph.byId[parentEdge.from], relationshipLabel: 'Parent' }]
        : []),
      ...dependencyNodes.map((node) => ({
        node,
        relationshipLabel: 'Dependency',
      })),
    ]),
    downstream: mergeRelatedNodes([
      ...childNodes.map((node) => ({
        node,
        relationshipLabel: 'Child',
      })),
      ...dependentNodes.map((node) => ({
        node,
        relationshipLabel: 'Dependent',
      })),
    ]),
  };
}

function collectExpandedRelatedNodes(
  graph: BacklogGraphData,
  selectedNodeId: string,
  direction: 'upstream' | 'downstream',
): RelatedNodeEntry[] {
  const queue: Array<{ nodeId: string; relationshipLabel: string }> = [];
  const exploredNodeIds = new Set<string>();
  const relatedNodes: Array<{ node: BacklogGraphNode; relationshipLabel: string }> = [];

  function addDirectEdge(edge: BacklogGraphEdge): void {
    if (direction === 'upstream' && edge.to === selectedNodeId) {
      queue.push({
        nodeId: edge.from,
        relationshipLabel: edge.relationship === 'parent_child' ? 'Parent' : 'Dependency',
      });
    }

    if (direction === 'downstream' && edge.from === selectedNodeId) {
      queue.push({
        nodeId: edge.to,
        relationshipLabel: edge.relationship === 'parent_child' ? 'Child' : 'Dependent',
      });
    }
  }

  for (const edge of graph.edges) {
    addDirectEdge(edge);
  }

  while (queue.length > 0) {
    const currentEntry = queue.shift();

    if (!currentEntry) {
      continue;
    }

    const currentNode = graph.byId[currentEntry.nodeId];

    if (!currentNode) {
      continue;
    }

    relatedNodes.push({
      node: currentNode,
      relationshipLabel: currentEntry.relationshipLabel,
    });

    if (exploredNodeIds.has(currentNode.id)) {
      continue;
    }

    exploredNodeIds.add(currentNode.id);

    for (const edge of graph.edges) {
      if (direction === 'upstream' && edge.to === currentNode.id) {
        queue.push({
          nodeId: edge.from,
          relationshipLabel: 'Ancestor',
        });
      }

      if (direction === 'downstream' && edge.from === currentNode.id) {
        queue.push({
          nodeId: edge.to,
          relationshipLabel: 'Descendant',
        });
      }
    }
  }

  return mergeRelatedNodes(relatedNodes);
}

function buildExpandedRelationshipGroups(graph: BacklogGraphData, selectedNodeId: string): RelationshipGroups {
  return {
    upstream: collectExpandedRelatedNodes(graph, selectedNodeId, 'upstream'),
    downstream: collectExpandedRelatedNodes(graph, selectedNodeId, 'downstream'),
  };
}

function buildRelationshipGroups(
  graph: BacklogGraphData,
  selectedNodeId: string,
  focusMode: FocusMode,
  filters: {
    area: string;
    status: string;
  },
): RelationshipGroups {
  const relationshipGroups =
    focusMode === 'expanded'
      ? buildExpandedRelationshipGroups(graph, selectedNodeId)
      : buildImmediateRelationshipGroups(graph, selectedNodeId);

  return {
    upstream: relationshipGroups.upstream.filter(({ node }) => matchesFilters(node, filters)),
    downstream: relationshipGroups.downstream.filter(({ node }) => matchesFilters(node, filters)),
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
  const [focusMode, setFocusMode] = useState<FocusMode>('neighborhood');
  const [areaFilter, setAreaFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

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

  const filterOptions = useMemo(() => {
    if (!graphState.graph) {
      return {
        areas: [],
        statuses: [],
      };
    }

    return {
      areas: collectFilterOptions(graphState.graph.nodes, 'area'),
      statuses: collectFilterOptions(graphState.graph.nodes, 'status'),
    };
  }, [graphState.graph]);

  const filteredNodes = useMemo(() => {
    if (!graphState.graph) {
      return [];
    }

    return graphState.graph.nodes
      .filter((node) =>
        matchesFilters(node, {
          area: areaFilter,
          status: statusFilter,
        }),
      )
      .sort(compareNodes);
  }, [areaFilter, graphState.graph, statusFilter]);

  useEffect(() => {
    if (!graphState.graph) {
      return;
    }

    const filteredNodeIds = new Set(filteredNodes.map((node) => node.id));

    if (filteredNodes.length === 0) {
      if (selectedNodeId) {
        setSelectedNodeId('');
      }
      return;
    }

    if (!selectedNodeId || !filteredNodeIds.has(selectedNodeId)) {
      setSelectedNodeId(filteredNodes[0].id);
    }
  }, [filteredNodes, graphState.graph, selectedNodeId]);

  const selectedNode = useMemo(() => {
    if (!graphState.graph || !selectedNodeId) {
      return null;
    }

    const node = graphState.graph.byId[selectedNodeId] ?? null;

    if (!node) {
      return null;
    }

    return matchesFilters(node, { area: areaFilter, status: statusFilter }) ? node : null;
  }, [areaFilter, graphState.graph, selectedNodeId, statusFilter]);

  const relationshipGroups = useMemo(() => {
    if (!graphState.graph || !selectedNode) {
      return null;
    }

    return buildRelationshipGroups(
      graphState.graph,
      selectedNode.id,
      focusMode,
      {
        area: areaFilter,
        status: statusFilter,
      },
    );
  }, [areaFilter, focusMode, graphState.graph, selectedNode, statusFilter]);

  function resetGraphView(): void {
    setFocusMode('neighborhood');
    setAreaFilter('');
    setStatusFilter('');
  }

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
            Choose one item to inspect its dependency neighborhood. Lightweight focus and filter controls keep the
            page readable without turning it into a heavy graph tool.
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
            <div className="backlog-graph-controls">
              <div className="page-stack page-stack--tight">
                <label className="field-label" htmlFor="backlog-graph-select">
                  Backlog item
                </label>
                <select
                  id="backlog-graph-select"
                  className="text-input"
                  value={selectedNodeId}
                  onChange={(event) => setSelectedNodeId(event.target.value)}
                  disabled={filteredNodes.length === 0}
                >
                  {filteredNodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.displayTitle} ({node.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="page-stack page-stack--tight">
                <label className="field-label" htmlFor="backlog-graph-focus-mode">
                  Focus mode
                </label>
                <select
                  id="backlog-graph-focus-mode"
                  className="text-input"
                  value={focusMode}
                  onChange={(event) => setFocusMode(event.target.value as FocusMode)}
                >
                  <option value="neighborhood">Immediate neighborhood</option>
                  <option value="expanded">Expanded ancestry + descendants</option>
                </select>
              </div>

              <div className="page-stack page-stack--tight">
                <label className="field-label" htmlFor="backlog-graph-area-filter">
                  Area filter
                </label>
                <select
                  id="backlog-graph-area-filter"
                  className="text-input"
                  value={areaFilter}
                  onChange={(event) => setAreaFilter(event.target.value)}
                >
                  <option value="">All areas</option>
                  {filterOptions.areas.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
              </div>

              <div className="page-stack page-stack--tight">
                <label className="field-label" htmlFor="backlog-graph-status-filter">
                  Status filter
                </label>
                <select
                  id="backlog-graph-status-filter"
                  className="text-input"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="">All statuses</option>
                  {filterOptions.statuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="button-row">
              <button type="button" className="button" onClick={resetGraphView}>
                Reset graph view
              </button>
            </div>

            <p className="supporting-text">
              Showing {filteredNodes.length} backlog item{filteredNodes.length === 1 ? '' : 's'} in{' '}
              {focusMode === 'expanded' ? 'expanded focus mode' : 'immediate neighborhood mode'}.
            </p>

            {filteredNodes.length === 0 ? (
              <p className="empty-state">No backlog items match the current filters.</p>
            ) : null}
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
                {focusMode === 'expanded'
                  ? 'The selected item sits in the middle, with expanded upstream ancestry on the left and downstream descendants on the right.'
                  : 'The selected item sits in the middle, with immediate upstream work on the left and downstream work on the right.'}
              </p>
            </div>

            <div className="backlog-graph-layout">
              <section className="backlog-graph-column" aria-labelledby="backlog-graph-upstream-title">
                <h3 id="backlog-graph-upstream-title" className="section-title">
                  Upstream
                </h3>
                <div className="backlog-graph-column__stack">
                  {relationshipGroups.upstream.map(({ node, relationshipLabel }) => (
                    <RelatedNodeButton
                      key={`upstream-${node.id}`}
                      node={node}
                      relationshipLabel={relationshipLabel}
                      isSelected={node.id === selectedNode.id}
                      onSelect={setSelectedNodeId}
                    />
                  ))}

                  {relationshipGroups.upstream.length === 0 ? (
                    <p className="empty-state">
                      {focusMode === 'expanded'
                        ? 'No upstream items matched the current focus and filters.'
                        : 'No immediate upstream relationships.'}
                    </p>
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
                  {relationshipGroups.downstream.map(({ node, relationshipLabel }) => (
                    <RelatedNodeButton
                      key={`downstream-${node.id}`}
                      node={node}
                      relationshipLabel={relationshipLabel}
                      isSelected={node.id === selectedNode.id}
                      onSelect={setSelectedNodeId}
                    />
                  ))}

                  {relationshipGroups.downstream.length === 0 ? (
                    <p className="empty-state">
                      {focusMode === 'expanded'
                        ? 'No downstream items matched the current focus and filters.'
                        : 'No immediate downstream relationships.'}
                    </p>
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
