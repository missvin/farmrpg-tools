import { useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react';

import type { BacklogGraphData, BacklogGraphNode } from './backlogGraphData';
import {
  buildOverviewLayout,
  buildRelationshipGroups,
  collectFilterOptions,
  compareNodes,
  formatWarningLabel,
  getBacklogNodeStatusClassName,
  matchesFilters,
  type FocusMode,
  type GraphMode,
} from './backlogGraphViewModel';

type BacklogGraphState = {
  isLoading: boolean;
  error: string | null;
  graph: BacklogGraphData | null;
};

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
  const statusClassName = getBacklogNodeStatusClassName(node.status);

  return (
    <button
      type="button"
      className={
        isSelected
          ? `backlog-node-card ${statusClassName} backlog-node-card--selected`
          : `backlog-node-card ${statusClassName}`
      }
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

export function BacklogGraphView({ graphState }: { graphState: BacklogGraphState }) {
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [graphMode, setGraphMode] = useState<GraphMode>('focused');
  const [focusMode, setFocusMode] = useState<FocusMode>('neighborhood');
  const [areaFilter, setAreaFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [overviewZoom, setOverviewZoom] = useState(1);
  const [overviewPan, setOverviewPan] = useState({ x: 0, y: 0 });
  const [dragState, setDragState] = useState<{
    pointerId: number;
    originClientX: number;
    originClientY: number;
    originPanX: number;
    originPanY: number;
  } | null>(null);

  useEffect(() => {
    if (!graphState.graph) {
      setSelectedNodeId('');
      return;
    }

    setSelectedNodeId(graphState.graph.nodes[0]?.id ?? '');
  }, [graphState.graph]);

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
      const defaultNodeId = graphState.graph.nodes[0]?.id ?? '';
      setSelectedNodeId(filteredNodeIds.has(defaultNodeId) ? defaultNodeId : filteredNodes[0].id);
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

    return buildRelationshipGroups(graphState.graph, selectedNode.id, focusMode, {
      area: areaFilter,
      status: statusFilter,
    });
  }, [areaFilter, focusMode, graphState.graph, selectedNode, statusFilter]);

  const overviewLayout = useMemo(() => {
    if (!graphState.graph || filteredNodes.length === 0) {
      return null;
    }

    return buildOverviewLayout(graphState.graph, filteredNodes);
  }, [filteredNodes, graphState.graph]);

  useEffect(() => {
    if (!overviewLayout) {
      return;
    }

    setOverviewZoom(overviewLayout.initialZoom);
    setOverviewPan({ x: 0, y: 0 });
  }, [graphMode, overviewLayout]);

  function resetGraphView(): void {
    setGraphMode('focused');
    setFocusMode('neighborhood');
    setAreaFilter('');
    setStatusFilter('');
    if (overviewLayout) {
      setOverviewZoom(overviewLayout.initialZoom);
    } else {
      setOverviewZoom(1);
    }
    setOverviewPan({ x: 0, y: 0 });
  }

  function zoomOverview(nextZoom: number): void {
    setOverviewZoom(Math.min(1.6, Math.max(0.45, Math.round(nextZoom * 100) / 100)));
  }

  function panOverview(deltaX: number, deltaY: number): void {
    setOverviewPan((currentPan) => ({
      x: currentPan.x + deltaX,
      y: currentPan.y + deltaY,
    }));
  }

  function handleOverviewPointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    setDragState({
      pointerId: event.pointerId,
      originClientX: event.clientX,
      originClientY: event.clientY,
      originPanX: overviewPan.x,
      originPanY: overviewPan.y,
    });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handleOverviewPointerMove(event: ReactPointerEvent<HTMLDivElement>): void {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    setOverviewPan({
      x: dragState.originPanX + (event.clientX - dragState.originClientX),
      y: dragState.originPanY + (event.clientY - dragState.originClientY),
    });
  }

  function clearDragState(): void {
    setDragState(null);
  }

  const selectedNodeStatusClassName = selectedNode ? getBacklogNodeStatusClassName(selectedNode.status) : '';

  return (
    <>
      <section className="page-card page-stack" aria-labelledby="backlog-graph-controls-title">
        <div>
          <h2 id="backlog-graph-controls-title">Select Backlog Item</h2>
          <p className="supporting-text">
            Choose one item to inspect either its focused dependency neighborhood or a zoomable whole-backlog overview.
            Lightweight controls keep the page readable without turning it into a heavy graph tool.
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
                <label className="field-label" htmlFor="backlog-graph-mode">
                  Graph mode
                </label>
                <select
                  id="backlog-graph-mode"
                  className="text-input"
                  value={graphMode}
                  onChange={(event) => setGraphMode(event.target.value as GraphMode)}
                >
                  <option value="focused">Focused graph</option>
                  <option value="overview">Whole-backlog overview</option>
                </select>
              </div>

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
                  disabled={graphMode !== 'focused'}
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
              {graphMode === 'overview'
                ? 'whole-backlog overview mode'
                : focusMode === 'expanded'
                  ? 'expanded focus mode'
                  : 'immediate neighborhood mode'}
              .
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

      {selectedNode && (graphMode === 'overview' || relationshipGroups) ? (
        <>
          {graphMode === 'focused' && relationshipGroups ? (
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
                  <article className={`backlog-node-card ${selectedNodeStatusClassName} backlog-node-card--selected`}>
                    <strong>{selectedNode.displayTitle}</strong>
                    <div className="backlog-node-card__meta">
                      <MetaPill label={selectedNode.id} />
                      <MetaPill label={selectedNode.status} />
                      <MetaPill label={selectedNode.type} />
                      <MetaPill label={selectedNode.area} />
                      <MetaPill label={selectedNode.priority} />
                    </div>
                    {selectedNode.displaySummary ? <p className="subtle-text">{selectedNode.displaySummary}</p> : null}
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
          ) : null}

          {graphMode === 'overview' && overviewLayout ? (
            <section className="page-card page-stack" aria-labelledby="backlog-graph-overview-title">
              <div>
                <h2 id="backlog-graph-overview-title">Whole-Backlog Overview</h2>
                <p className="supporting-text">
                  Inspect the full filtered backlog at once. Drag to pan, use the zoom controls to move between a
                  whole-project overview and easier node reading, and click any node to drive the shared detail panel.
                </p>
              </div>

              <div className="backlog-overview-toolbar">
                <div className="button-row">
                  <button type="button" className="button" onClick={() => zoomOverview(overviewZoom - 0.15)}>
                    Zoom out
                  </button>
                  <button type="button" className="button" onClick={() => zoomOverview(overviewZoom + 0.15)}>
                    Zoom in
                  </button>
                  <button
                    type="button"
                    className="button"
                    onClick={() => {
                      setOverviewZoom(overviewLayout.initialZoom);
                      setOverviewPan({ x: 0, y: 0 });
                    }}
                  >
                    Reset overview
                  </button>
                  <button type="button" className="button" onClick={() => panOverview(0, -60)}>
                    Pan up
                  </button>
                  <button type="button" className="button" onClick={() => panOverview(-60, 0)}>
                    Pan left
                  </button>
                  <button type="button" className="button" onClick={() => panOverview(60, 0)}>
                    Pan right
                  </button>
                  <button type="button" className="button" onClick={() => panOverview(0, 60)}>
                    Pan down
                  </button>
                </div>
                <p className="supporting-text" data-testid="backlog-overview-zoom-value">
                  Zoom: {Math.round(overviewZoom * 100)}%
                </p>
              </div>

              <div
                className="backlog-overview-viewport"
                onPointerDown={handleOverviewPointerDown}
                onPointerMove={handleOverviewPointerMove}
                onPointerUp={clearDragState}
                onPointerLeave={clearDragState}
                onPointerCancel={clearDragState}
              >
                <div
                  className="backlog-overview-stage"
                  data-testid="backlog-overview-stage"
                  style={{
                    width: `${overviewLayout.width}px`,
                    height: `${overviewLayout.height}px`,
                    transform: `translate(${overviewPan.x}px, ${overviewPan.y}px) scale(${overviewZoom})`,
                  }}
                >
                  <svg
                    className="backlog-overview-stage__edges"
                    width={overviewLayout.width}
                    height={overviewLayout.height}
                    aria-hidden="true"
                  >
                    {overviewLayout.edges.map((edge) => {
                      const fromNode = overviewLayout.nodes.find((node) => node.node.id === edge.from);
                      const toNode = overviewLayout.nodes.find((node) => node.node.id === edge.to);

                      if (!fromNode || !toNode) {
                        return null;
                      }

                      return (
                        <line
                          key={`${edge.relationship}-${edge.from}-${edge.to}`}
                          x1={fromNode.x + fromNode.width}
                          y1={fromNode.y + fromNode.height / 2}
                          x2={toNode.x}
                          y2={toNode.y + toNode.height / 2}
                          className={
                            edge.relationship === 'dependency'
                              ? 'backlog-overview-edge backlog-overview-edge--dependency'
                              : 'backlog-overview-edge backlog-overview-edge--parent'
                          }
                        />
                      );
                    })}
                  </svg>

                  {overviewLayout.nodes.map(({ node, x, y, width, height }) => {
                    const statusClassName = getBacklogNodeStatusClassName(node.status);
                    const className =
                      node.id === selectedNode.id
                        ? `backlog-node-card backlog-node-card--overview ${statusClassName} backlog-node-card--selected`
                        : `backlog-node-card backlog-node-card--overview ${statusClassName}`;

                    return (
                      <button
                        key={node.id}
                        type="button"
                        aria-label={`${node.displayTitle} (${node.id})`}
                        className={className}
                        style={{
                          left: `${x}px`,
                          top: `${y}px`,
                          width: `${width}px`,
                          minHeight: `${height}px`,
                        }}
                        onClick={() => setSelectedNodeId(node.id)}
                      >
                        <strong>{node.displayTitle}</strong>
                        <span className="subtle-text">
                          {node.id} | {node.status} | {node.type}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          ) : null}

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
    </>
  );
}
