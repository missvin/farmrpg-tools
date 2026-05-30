import type {
  TargetOutputPlannerItemRow,
  TargetOutputPlannerResult,
  TargetOutputPlannerTargetSummary,
} from './targetOutputPlannerEngine';
import type { TargetOutputPlanningGoal } from './targetOutputPlanningModel';

export type TargetOutputPlanningGraphNodeKind = 'target' | 'item' | 'supply';

export type TargetOutputPlanningGraphEdgeKind =
  | 'target_demand'
  | 'recipe_input'
  | 'supply_offset';

export type TargetOutputPlanningGraphStageKind =
  | 'target'
  | 'supply'
  | 'craft'
  | 'remaining'
  | 'status';

export type TargetOutputPlanningGraphStage = {
  kind: TargetOutputPlanningGraphStageKind;
  label: string;
  quantity: number | null;
  notes: string[];
};

export type TargetOutputPlanningGraphNode = {
  nodeId: string;
  kind: TargetOutputPlanningGraphNodeKind;
  canonicalKey: string | null;
  itemName: string;
  targetId: string | null;
  stages: TargetOutputPlanningGraphStage[];
  provenance: string[];
};

export type TargetOutputPlanningGraphEdge = {
  edgeId: string;
  kind: TargetOutputPlanningGraphEdgeKind;
  fromNodeId: string;
  toNodeId: string;
  quantity: number;
  label: string;
  targetContributions: {
    targetId: string;
    targetLabel: string;
    quantity: number;
  }[];
};

export type TargetOutputPlanningTreeRoot = {
  targetId: string;
  targetLabel: string;
  targetNodeId: string;
  itemNodeId: string;
  desiredQuantity: number;
};

export type TargetOutputPlanningGraph = {
  nodes: TargetOutputPlanningGraphNode[];
  nodesById: Record<string, TargetOutputPlanningGraphNode>;
  edges: TargetOutputPlanningGraphEdge[];
  edgesByFromNodeId: Record<string, TargetOutputPlanningGraphEdge[]>;
  treeRoots: TargetOutputPlanningTreeRoot[];
};

function toItemNodeId(canonicalKey: string): string {
  return `item:${canonicalKey}`;
}

function toTargetNodeId(targetId: string): string {
  return `target:${targetId}`;
}

function toSupplyNodeId(canonicalKey: string): string {
  return `supply:${canonicalKey}`;
}

function formatSourceLabel(row: TargetOutputPlannerItemRow): string {
  if (!row.supply) {
    return 'No local supply was applied.';
  }

  const labels = row.supply.breakdowns.map((breakdown) => breakdown.label);
  const uniqueLabels = Array.from(new Set(labels));

  return uniqueLabels.length > 0
    ? `Supply sources: ${uniqueLabels.join(', ')}.`
    : 'Local supply was applied.';
}

function getStatusLabel(row: TargetOutputPlannerItemRow): string {
  switch (row.unresolvedReason) {
    case 'leaf_item':
      return 'Needs direct source.';
    case 'cooking_recipe_not_expanded':
      return 'Cooking recipe is not expanded by the craft planner.';
    case 'excluded_recipe':
      return 'Craft recipe is excluded by current planning assumptions.';
    case 'auto_supplied':
      return 'Covered by a planning policy auto-supply assumption.';
    case 'no_remaining_quantity':
      return 'Covered by available supply.';
    case null:
      return 'Remaining quantity was expanded through craft inputs.';
  }
}

function buildItemStages(row: TargetOutputPlannerItemRow): TargetOutputPlanningGraphStage[] {
  const stages: TargetOutputPlanningGraphStage[] = [
    {
      kind: 'target',
      label: 'Gross demand',
      quantity: row.grossRequiredQuantity,
      notes: row.contributions.map((contribution) => (
        `${contribution.targetLabel}: ${contribution.quantity.toLocaleString()}`
      )),
    },
  ];

  if (row.availableUsedQuantity > 0) {
    stages.push({
      kind: 'supply',
      label: 'Supply used',
      quantity: row.availableUsedQuantity,
      notes: row.supply?.breakdowns.map((breakdown) => (
        `${breakdown.label}: ${breakdown.quantity.toLocaleString()}`
      )) ?? [],
    });
  }

  if (row.requiredCraftOperations > 0) {
    stages.push({
      kind: 'craft',
      label: 'Craft operations',
      quantity: row.requiredCraftOperations,
      notes: row.projectedOutputQuantity === null
        ? []
        : [`Projected output: ${row.projectedOutputQuantity.toLocaleString()}`],
    });
  }

  stages.push({
    kind: 'remaining',
    label: 'Still needed',
    quantity: row.remainingQuantity,
    notes: [],
  });
  stages.push({
    kind: 'status',
    label: getStatusLabel(row),
    quantity: null,
    notes: [],
  });

  return stages;
}

function buildItemProvenance(row: TargetOutputPlannerItemRow): string[] {
  const provenance = [
    formatSourceLabel(row),
    getStatusLabel(row),
  ];

  if (row.supply?.overrideQuantity !== null && row.supply?.overrideQuantity !== undefined) {
    provenance.unshift(
      `Manual override sets effective supply to ${row.supply.overrideQuantity.toLocaleString()} and replaces derived supply for planning.`,
    );
  }

  return provenance;
}

function buildTargetNode(goal: TargetOutputPlanningGoal): TargetOutputPlanningGraphNode {
  return {
    nodeId: toTargetNodeId(goal.targetId),
    kind: 'target',
    canonicalKey: goal.canonicalKey,
    itemName: goal.itemName,
    targetId: goal.targetId,
    stages: [
      {
        kind: 'target',
        label: 'Desired output',
        quantity: goal.desiredQuantity,
        notes: goal.requiredCraftOperations === null
          ? []
          : [`Direct craft estimate: ${goal.requiredCraftOperations.toLocaleString()} crafts.`],
      },
    ],
    provenance: [
      goal.recipeType === 'craft'
        ? 'Target has a craft recipe and can expand through remaining demand.'
        : 'Target does not expand through the craft planner.',
    ],
  };
}

function buildSupplyNode(row: TargetOutputPlannerItemRow): TargetOutputPlanningGraphNode {
  return {
    nodeId: toSupplyNodeId(row.canonicalKey),
    kind: 'supply',
    canonicalKey: row.canonicalKey,
    itemName: `${row.itemName} supply`,
    targetId: null,
    stages: [
      {
        kind: 'supply',
        label: 'Available supply consumed',
        quantity: row.availableUsedQuantity,
        notes: row.supply?.breakdowns.map((breakdown) => (
          `${breakdown.label}: ${breakdown.quantity.toLocaleString()}`
        )) ?? [],
      },
    ],
    provenance: buildItemProvenance(row),
  };
}

function groupEdgesByFromNodeId(
  edges: TargetOutputPlanningGraphEdge[],
): Record<string, TargetOutputPlanningGraphEdge[]> {
  const grouped: Record<string, TargetOutputPlanningGraphEdge[]> = {};

  for (const edge of edges) {
    grouped[edge.fromNodeId] = [...(grouped[edge.fromNodeId] ?? []), edge];
  }

  return Object.fromEntries(
    Object.entries(grouped).map(([nodeId, nodeEdges]) => [
      nodeId,
      nodeEdges.sort((left, right) => right.quantity - left.quantity || left.label.localeCompare(right.label)),
    ]),
  );
}

export function buildTargetOutputPlanningGraph(
  result: TargetOutputPlannerResult,
): TargetOutputPlanningGraph {
  const nodes = new Map<string, TargetOutputPlanningGraphNode>();
  const edges: TargetOutputPlanningGraphEdge[] = [];

  for (const summary of result.targetSummaries) {
    const targetNode = buildTargetNode(summary.goal);
    nodes.set(targetNode.nodeId, targetNode);

    edges.push({
      edgeId: `target-demand:${summary.goal.targetId}`,
      kind: 'target_demand',
      fromNodeId: targetNode.nodeId,
      toNodeId: toItemNodeId(summary.goal.canonicalKey),
      quantity: summary.goal.desiredQuantity,
      label: 'Desired output',
      targetContributions: [
        {
          targetId: summary.goal.targetId,
          targetLabel: summary.goal.targetLabel,
          quantity: summary.goal.desiredQuantity,
        },
      ],
    });
  }

  for (const row of result.rows) {
    const itemNode: TargetOutputPlanningGraphNode = {
      nodeId: toItemNodeId(row.canonicalKey),
      kind: 'item',
      canonicalKey: row.canonicalKey,
      itemName: row.itemName,
      targetId: null,
      stages: buildItemStages(row),
      provenance: buildItemProvenance(row),
    };

    nodes.set(itemNode.nodeId, itemNode);

    if (row.availableUsedQuantity > 0) {
      const supplyNode = buildSupplyNode(row);
      nodes.set(supplyNode.nodeId, supplyNode);
      edges.push({
        edgeId: `supply-offset:${row.canonicalKey}`,
        kind: 'supply_offset',
        fromNodeId: supplyNode.nodeId,
        toNodeId: itemNode.nodeId,
        quantity: row.availableUsedQuantity,
        label: 'Supply offsets demand',
        targetContributions: row.contributions,
      });
    }
  }

  for (const edge of result.expansionEdges) {
    edges.push({
      edgeId: `recipe-input:${edge.fromCanonicalKey}:${edge.toCanonicalKey}:${edges.length}`,
      kind: 'recipe_input',
      fromNodeId: toItemNodeId(edge.fromCanonicalKey),
      toNodeId: toItemNodeId(edge.toCanonicalKey),
      quantity: edge.quantity,
      label: `${edge.craftOperations.toLocaleString()} craft${edge.craftOperations === 1 ? '' : 's'}`,
      targetContributions: edge.contributions,
    });
  }

  const publicNodes = Array.from(nodes.values()).sort((left, right) => {
    return left.kind.localeCompare(right.kind) || left.itemName.localeCompare(right.itemName);
  });

  return {
    nodes: publicNodes,
    nodesById: Object.fromEntries(publicNodes.map((node) => [node.nodeId, node])),
    edges,
    edgesByFromNodeId: groupEdgesByFromNodeId(edges),
    treeRoots: result.targetSummaries.map((summary: TargetOutputPlannerTargetSummary) => ({
      targetId: summary.goal.targetId,
      targetLabel: summary.goal.targetLabel,
      targetNodeId: toTargetNodeId(summary.goal.targetId),
      itemNodeId: toItemNodeId(summary.goal.canonicalKey),
      desiredQuantity: summary.goal.desiredQuantity,
    })),
  };
}
