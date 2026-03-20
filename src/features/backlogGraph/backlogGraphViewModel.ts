import type { BacklogGraphData, BacklogGraphEdge, BacklogGraphNode, BacklogGraphWarning } from './backlogGraphData';

export type FocusMode = 'neighborhood' | 'expanded';
export type GraphMode = 'focused' | 'overview';

export type RelatedNodeEntry = {
  node: BacklogGraphNode;
  relationshipLabel: string;
};

export type RelationshipGroups = {
  upstream: RelatedNodeEntry[];
  downstream: RelatedNodeEntry[];
};

export type OverviewLayoutNode = {
  node: BacklogGraphNode;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type OverviewLayoutEdge = {
  from: string;
  to: string;
  relationship: BacklogGraphEdge['relationship'];
};

export type OverviewLayout = {
  nodes: OverviewLayoutNode[];
  edges: OverviewLayoutEdge[];
  width: number;
  height: number;
  initialZoom: number;
};

export function normalizeStatusValue(status: string): string {
  return status.trim().toLowerCase();
}

export function getBacklogNodeStatusClassName(status: string): string {
  switch (normalizeStatusValue(status)) {
    case 'shipped':
      return 'backlog-node-card--status-shipped';
    case 'in_progress':
      return 'backlog-node-card--status-in-progress';
    case 'inbox':
      return 'backlog-node-card--status-inbox';
    default:
      return 'backlog-node-card--status-unknown';
  }
}

export function compareNodes(left: BacklogGraphNode, right: BacklogGraphNode): number {
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

export function matchesFilters(
  node: BacklogGraphNode,
  filters: {
    area: string;
    status: string;
  },
): boolean {
  return (!filters.area || node.area === filters.area) && (!filters.status || node.status === filters.status);
}

export function collectFilterOptions(nodes: BacklogGraphNode[], field: 'area' | 'status'): string[] {
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

export function buildRelationshipGroups(
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

export function buildOverviewLayout(graph: BacklogGraphData, visibleNodes: BacklogGraphNode[]): OverviewLayout {
  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
  const visibleEdges = graph.edges.filter(
    (edge) => visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to),
  );

  const outgoingByNodeId = new Map<string, string[]>();
  const indegreeByNodeId = new Map<string, number>();
  const levelByNodeId = new Map<string, number>();

  for (const node of visibleNodes) {
    outgoingByNodeId.set(node.id, []);
    indegreeByNodeId.set(node.id, 0);
    levelByNodeId.set(node.id, 0);
  }

  for (const edge of visibleEdges) {
    outgoingByNodeId.get(edge.from)?.push(edge.to);
    indegreeByNodeId.set(edge.to, (indegreeByNodeId.get(edge.to) ?? 0) + 1);
  }

  const queue = visibleNodes
    .filter((node) => (indegreeByNodeId.get(node.id) ?? 0) === 0)
    .sort(compareNodes)
    .map((node) => node.id);

  const processedNodeIds = new Set<string>();

  while (queue.length > 0) {
    const currentNodeId = queue.shift();

    if (!currentNodeId) {
      continue;
    }

    processedNodeIds.add(currentNodeId);

    for (const nextNodeId of outgoingByNodeId.get(currentNodeId) ?? []) {
      const nextLevel = (levelByNodeId.get(currentNodeId) ?? 0) + 1;
      levelByNodeId.set(nextNodeId, Math.max(levelByNodeId.get(nextNodeId) ?? 0, nextLevel));

      const nextIndegree = (indegreeByNodeId.get(nextNodeId) ?? 0) - 1;
      indegreeByNodeId.set(nextNodeId, nextIndegree);

      if (nextIndegree === 0) {
        queue.push(nextNodeId);
        queue.sort((left, right) => compareNodes(graph.byId[left], graph.byId[right]));
      }
    }
  }

  const highestAssignedLevel = Math.max(0, ...Array.from(levelByNodeId.values()));
  let overflowLevel = highestAssignedLevel + 1;

  for (const node of visibleNodes.sort(compareNodes)) {
    if (processedNodeIds.has(node.id)) {
      continue;
    }

    levelByNodeId.set(node.id, overflowLevel);
    overflowLevel += 1;
  }

  const nodesByLevel = new Map<number, BacklogGraphNode[]>();

  for (const node of visibleNodes) {
    const level = levelByNodeId.get(node.id) ?? 0;
    const levelNodes = nodesByLevel.get(level) ?? [];
    levelNodes.push(node);
    nodesByLevel.set(level, levelNodes);
  }

  for (const levelNodes of nodesByLevel.values()) {
    levelNodes.sort(compareNodes);
  }

  const nodeWidth = 220;
  const nodeHeight = 92;
  const columnGap = 120;
  const rowGap = 36;
  const padding = 24;
  const maxLevel = Math.max(0, ...Array.from(nodesByLevel.keys()));
  const maxRows = Math.max(1, ...Array.from(nodesByLevel.values()).map((levelNodes) => levelNodes.length));
  const layoutNodes: OverviewLayoutNode[] = [];

  for (const [level, levelNodes] of Array.from(nodesByLevel.entries()).sort((left, right) => left[0] - right[0])) {
    levelNodes.forEach((node, index) => {
      layoutNodes.push({
        node,
        x: padding + level * (nodeWidth + columnGap),
        y: padding + index * (nodeHeight + rowGap),
        width: nodeWidth,
        height: nodeHeight,
      });
    });
  }

  const width = padding * 2 + (maxLevel + 1) * nodeWidth + maxLevel * columnGap;
  const height = padding * 2 + maxRows * nodeHeight + Math.max(0, maxRows - 1) * rowGap;

  let initialZoom = 1;

  if (width > 1800) {
    initialZoom = 0.55;
  } else if (width > 1400) {
    initialZoom = 0.65;
  } else if (width > 1100) {
    initialZoom = 0.8;
  }

  return {
    nodes: layoutNodes,
    edges: visibleEdges.map((edge) => ({
      from: edge.from,
      to: edge.to,
      relationship: edge.relationship,
    })),
    width,
    height,
    initialZoom,
  };
}

export function formatWarningLabel(warning: BacklogGraphWarning): string {
  if (!warning.backlogId) {
    return warning.message;
  }

  return `${warning.backlogId}: ${warning.message}`;
}
