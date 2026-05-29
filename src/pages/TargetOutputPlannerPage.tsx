import { useEffect, useId, useMemo, useState } from 'react';

import { ItemProfileLink } from '../components/ItemProfileLink';
import { PageIntro } from '../components/PageIntro';
import {
  createDefaultAcquisitionPlannerInputState,
  loadAcquisitionPlannerInputState,
  type AcquisitionPlannerInputState,
} from '../lib/acquisitionPlannerState';
import { deriveAvailableSupplyPool, type AvailableSupplyPool } from '../lib/availableSupply';
import {
  createDefaultCraftingModifierState,
  loadCraftingModifierState,
  type UserCraftingModifierState,
} from '../lib/craftingModifierState';
import { getItemIcon } from '../lib/itemIconManifest';
import { loadPetSourceReference, type PetSourceReferenceData } from '../lib/loadPetSourceReference';
import { loadRecipeGraph, type RecipeGraph } from '../lib/loadRecipeGraph';
import {
  buildTargetOutputPlannerResult,
  type TargetOutputPlannerItemRow,
  type TargetOutputPlannerResult,
  type TargetOutputPlannerUnresolvedReason,
} from '../lib/targetOutputPlannerEngine';
import {
  buildTargetOutputPlanningGraph,
  type TargetOutputPlanningGraph,
  type TargetOutputPlanningGraphEdge,
  type TargetOutputPlanningGraphNode,
  type TargetOutputPlanningGraphStage,
} from '../lib/targetOutputPlanningGraph';
import {
  addTargetOutputPlannerTarget,
  loadTargetOutputPlannerState,
  removeTargetOutputPlannerTarget,
  removeTargetOutputSupplyOverride,
  saveTargetOutputPlannerState,
  upsertTargetOutputSupplyOverride,
  type TargetOutputPlannerState,
} from '../lib/targetOutputPlannerState';

type TargetPlannerResources = {
  recipeGraph: RecipeGraph;
  acquisitionState: AcquisitionPlannerInputState;
  modifierState: UserCraftingModifierState;
  petSourceReference: Pick<PetSourceReferenceData, 'byPetAndItemKey'> | null;
  warnings: string[];
};

type ResourceState = {
  isLoading: boolean;
  error: string | null;
  resources: TargetPlannerResources | null;
};

type ItemOption = {
  canonicalKey: string;
  itemName: string;
};

function formatQuantity(value: number): string {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: value < 100 ? 1 : 0,
  });
}

function parsePositiveNumber(value: string): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0;
}

function getItemIconSrc(canonicalKey: string): string | null {
  return getItemIcon(canonicalKey)?.src ?? null;
}

function getItemOptions(recipeGraph: RecipeGraph): ItemOption[] {
  const optionsByCanonicalKey = new Map<string, ItemOption>();

  for (const recipe of recipeGraph.recipes) {
    optionsByCanonicalKey.set(recipe.outputCanonicalKey, {
      canonicalKey: recipe.outputCanonicalKey,
      itemName: recipe.outputItemName,
    });

    for (const input of recipe.inputs) {
      if (!optionsByCanonicalKey.has(input.canonicalKey)) {
        optionsByCanonicalKey.set(input.canonicalKey, {
          canonicalKey: input.canonicalKey,
          itemName: input.itemName,
        });
      }
    }
  }

  return Array.from(optionsByCanonicalKey.values()).sort((left, right) => {
    return left.itemName.localeCompare(right.itemName) || left.canonicalKey.localeCompare(right.canonicalKey);
  });
}

function formatUnresolvedReason(reason: TargetOutputPlannerUnresolvedReason | null): string {
  switch (reason) {
    case 'leaf_item':
      return 'Needs source';
    case 'cooking_recipe_not_expanded':
      return 'Cooking recipe';
    case 'excluded_recipe':
      return 'Recipe excluded';
    case 'auto_supplied':
      return 'Auto supplied';
    case 'no_remaining_quantity':
      return 'Covered';
    case null:
      return 'Craft inputs expanded';
  }
}

function getGraphEdgeQuantityForTarget(edge: TargetOutputPlanningGraphEdge, targetId: string): number {
  const contribution = edge.targetContributions.find((entry) => entry.targetId === targetId);
  return contribution?.quantity ?? 0;
}

function formatStage(stage: TargetOutputPlanningGraphStage): string {
  return stage.quantity === null
    ? stage.label
    : `${stage.label}: ${formatQuantity(stage.quantity)}`;
}

function TargetPlanningTreeNode({
  graph,
  node,
  targetId,
  depth,
  seenNodeIds,
}: {
  graph: TargetOutputPlanningGraph;
  node: TargetOutputPlanningGraphNode;
  targetId: string;
  depth: number;
  seenNodeIds: Set<string>;
}) {
  const childEdges = (graph.edgesByFromNodeId[node.nodeId] ?? []).filter((edge) => {
    if (edge.kind !== 'recipe_input' && edge.kind !== 'target_demand') {
      return false;
    }

    return getGraphEdgeQuantityForTarget(edge, targetId) > 0;
  });
  const isItemNode = node.kind === 'item' && node.canonicalKey !== null;
  const iconSrc = isItemNode ? getItemIconSrc(node.canonicalKey ?? '') : null;

  return (
    <li className="target-planning-tree__node">
      <details open={depth < 2}>
        <summary>
          {isItemNode ? (
            <ItemProfileLink
              canonicalKey={node.canonicalKey ?? ''}
              itemName={node.itemName}
              iconSrc={iconSrc}
              className="target-planning-tree__item-link"
            />
          ) : (
            <strong>{node.itemName}</strong>
          )}
          <span className="target-planning-tree__kind">{node.kind}</span>
        </summary>
        <ul className="target-planning-tree__stages">
          {node.stages.map((stage) => (
            <li key={`${stage.kind}:${stage.label}`}>
              {formatStage(stage)}
              {stage.notes.length > 0 ? (
                <span className="subtle-text"> ({stage.notes.join('; ')})</span>
              ) : null}
            </li>
          ))}
        </ul>
        {node.provenance.length > 0 ? (
          <p className="subtle-text">{node.provenance.join(' ')}</p>
        ) : null}
      </details>
      {childEdges.length > 0 ? (
        <ul className="target-planning-tree__children">
          {childEdges.map((edge) => {
            const childNode = graph.nodesById[edge.toNodeId];
            const edgeQuantity = getGraphEdgeQuantityForTarget(edge, targetId);

            if (!childNode) {
              return null;
            }

            if (seenNodeIds.has(childNode.nodeId)) {
              return (
                <li className="target-planning-tree__edge" key={edge.edgeId}>
                  <span>{edge.label}: {formatQuantity(edgeQuantity)}</span>
                  <span className="subtle-text"> Already shown above.</span>
                </li>
              );
            }

            return (
              <li className="target-planning-tree__edge" key={edge.edgeId}>
                <span>{edge.label}: {formatQuantity(edgeQuantity)}</span>
                <TargetPlanningTreeNode
                  graph={graph}
                  node={childNode}
                  targetId={targetId}
                  depth={depth + 1}
                  seenNodeIds={new Set([...seenNodeIds, childNode.nodeId])}
                />
              </li>
            );
          })}
        </ul>
      ) : null}
    </li>
  );
}

function TargetPlanningTree({ graph }: { graph: TargetOutputPlanningGraph | null }) {
  if (!graph || graph.treeRoots.length === 0) {
    return <p className="empty-state">Add targets to see the planning tree.</p>;
  }

  return (
    <div className="target-planning-tree">
      {graph.treeRoots.map((root) => {
        const targetNode = graph.nodesById[root.targetNodeId];

        if (!targetNode) {
          return null;
        }

        return (
          <section className="target-planning-tree__root" key={root.targetId}>
            <h3>{root.targetLabel}</h3>
            <ul className="target-planning-tree__children target-planning-tree__children--root">
              <TargetPlanningTreeNode
                graph={graph}
                node={targetNode}
                targetId={root.targetId}
                depth={0}
                seenNodeIds={new Set([targetNode.nodeId])}
              />
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function TargetPlanningProvenance({ graph }: { graph: TargetOutputPlanningGraph | null }) {
  const itemNodes = graph?.nodes.filter((node) => node.kind === 'item' && node.canonicalKey !== null) ?? [];

  if (itemNodes.length === 0) {
    return <p className="empty-state">Add targets to see supply and recipe explanations.</p>;
  }

  return (
    <div className="table-scroll">
      <table className="summary-table target-output-provenance-table">
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col">Stages</th>
            <th scope="col">Explanation</th>
          </tr>
        </thead>
        <tbody>
          {itemNodes.map((node) => (
            <tr key={node.nodeId}>
              <td>
                <ItemProfileLink
                  canonicalKey={node.canonicalKey ?? ''}
                  itemName={node.itemName}
                  iconSrc={getItemIconSrc(node.canonicalKey ?? '')}
                />
              </td>
              <td>
                {node.stages.map((stage) => (
                  <span className="target-output-chip" key={`${node.nodeId}:${stage.kind}:${stage.label}`}>
                    {formatStage(stage)}
                  </span>
                ))}
              </td>
              <td>{node.provenance.join(' ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TargetPlannerSummary({
  result,
  supplyPool,
}: {
  result: TargetOutputPlannerResult | null;
  supplyPool: AvailableSupplyPool;
}) {
  const targetCount = result?.problem.goals.length ?? 0;
  const remainingRows = result?.rows.filter((row) => row.remainingQuantity > 0).length ?? 0;
  const availableUsedQuantity = result?.rows.reduce((total, row) => total + row.availableUsedQuantity, 0) ?? 0;
  const craftOperations = result?.rows.reduce((total, row) => total + row.requiredCraftOperations, 0) ?? 0;

  return (
    <dl className="summary-grid">
      <div className="summary-grid__item">
        <dt>Targets</dt>
        <dd>{targetCount.toLocaleString()}</dd>
      </div>
      <div className="summary-grid__item">
        <dt>Supply rows</dt>
        <dd>{supplyPool.items.length.toLocaleString()}</dd>
      </div>
      <div className="summary-grid__item">
        <dt>Covered by supply</dt>
        <dd>{formatQuantity(availableUsedQuantity)}</dd>
      </div>
      <div className="summary-grid__item">
        <dt>Remaining items</dt>
        <dd>{remainingRows.toLocaleString()}</dd>
      </div>
      <div className="summary-grid__item">
        <dt>Crafts planned</dt>
        <dd>{formatQuantity(craftOperations)}</dd>
      </div>
    </dl>
  );
}

function TargetRowsTable({ rows }: { rows: TargetOutputPlannerItemRow[] }) {
  if (rows.length === 0) {
    return <p className="empty-state">Add targets to see combined remaining requirements.</p>;
  }

  return (
    <div className="table-scroll">
      <table className="summary-table target-output-table">
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col">Gross needed</th>
            <th scope="col">Supply used</th>
            <th scope="col">Still needed</th>
            <th scope="col">Crafts</th>
            <th scope="col">Targets</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.canonicalKey}>
              <td>
                <ItemProfileLink
                  canonicalKey={row.canonicalKey}
                  itemName={row.itemName}
                  iconSrc={getItemIconSrc(row.canonicalKey)}
                />
              </td>
              <td>{formatQuantity(row.grossRequiredQuantity)}</td>
              <td>
                {formatQuantity(row.availableUsedQuantity)}
                {row.supply && row.supply.breakdowns.length > 0 ? (
                  <span className="subtle-text">
                    {' '}
                    / {formatQuantity(row.availableQuantity)}
                  </span>
                ) : null}
              </td>
              <td>{formatQuantity(row.remainingQuantity)}</td>
              <td>{row.requiredCraftOperations > 0 ? formatQuantity(row.requiredCraftOperations) : '-'}</td>
              <td>
                {row.contributions.map((contribution) => (
                  <span className="target-output-chip" key={contribution.targetId}>
                    {contribution.targetLabel}: {formatQuantity(contribution.quantity)}
                  </span>
                ))}
              </td>
              <td>{formatUnresolvedReason(row.unresolvedReason)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TargetOutputPlannerPage() {
  const targetListId = useId();
  const overrideListId = useId();
  const [plannerState, setPlannerState] = useState<TargetOutputPlannerState>(() => loadTargetOutputPlannerState());
  const [targetItemName, setTargetItemName] = useState('');
  const [targetQuantity, setTargetQuantity] = useState('');
  const [overrideItemName, setOverrideItemName] = useState('');
  const [overrideQuantity, setOverrideQuantity] = useState('');
  const [resourceState, setResourceState] = useState<ResourceState>({
    isLoading: true,
    error: null,
    resources: null,
  });

  useEffect(() => {
    let isMounted = true;

    async function loadResources(): Promise<void> {
      try {
        const recipeGraph = await loadRecipeGraph();
        const warnings: string[] = [];
        let petSourceReference: Pick<PetSourceReferenceData, 'byPetAndItemKey'> | null = null;

        try {
          petSourceReference = await loadPetSourceReference();
        } catch {
          warnings.push('Pet source reference could not be loaded, so future pet unlock checks may be approximate.');
        }

        let acquisitionState: AcquisitionPlannerInputState;
        let modifierState: UserCraftingModifierState;

        try {
          acquisitionState = loadAcquisitionPlannerInputState();
        } catch {
          acquisitionState = createDefaultAcquisitionPlannerInputState();
        }

        try {
          modifierState = loadCraftingModifierState();
        } catch {
          modifierState = createDefaultCraftingModifierState();
        }

        if (!isMounted) {
          return;
        }

        setResourceState({
          isLoading: false,
          error: null,
          resources: {
            recipeGraph,
            acquisitionState,
            modifierState,
            petSourceReference,
            warnings,
          },
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setResourceState({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unable to load Target Planner data.',
          resources: null,
        });
      }
    }

    void loadResources();

    return () => {
      isMounted = false;
    };
  }, []);

  const itemOptions = useMemo(() => {
    return resourceState.resources ? getItemOptions(resourceState.resources.recipeGraph) : [];
  }, [resourceState.resources]);

  const supplyPool = useMemo(() => {
    if (!resourceState.resources) {
      return null;
    }

    return deriveAvailableSupplyPool({
      acquisitionState: resourceState.resources.acquisitionState,
      petSourceReference: resourceState.resources.petSourceReference,
      overrides: plannerState.supplyOverrides,
    });
  }, [plannerState.supplyOverrides, resourceState.resources]);

  const plannerResult = useMemo(() => {
    if (!resourceState.resources || !supplyPool || plannerState.targets.length === 0) {
      return null;
    }

    return buildTargetOutputPlannerResult({
      goals: plannerState.targets,
      recipeGraph: resourceState.resources.recipeGraph,
      modifierState: resourceState.resources.modifierState,
      supplyPool,
    });
  }, [plannerState.targets, resourceState.resources, supplyPool]);

  const planningGraph = useMemo(() => {
    return plannerResult ? buildTargetOutputPlanningGraph(plannerResult) : null;
  }, [plannerResult]);

  function persistPlannerState(nextState: TargetOutputPlannerState): void {
    const savedState = saveTargetOutputPlannerState(nextState);
    setPlannerState(savedState);
  }

  function handleAddTarget(): void {
    const nextState = addTargetOutputPlannerTarget(plannerState, {
      itemName: targetItemName,
      desiredQuantity: parsePositiveNumber(targetQuantity),
    });

    persistPlannerState(nextState);
    setTargetItemName('');
    setTargetQuantity('');
  }

  function handleSaveOverride(): void {
    const nextState = upsertTargetOutputSupplyOverride(plannerState, {
      itemName: overrideItemName,
      quantity: parsePositiveNumber(overrideQuantity),
    });

    persistPlannerState(nextState);
    setOverrideItemName('');
    setOverrideQuantity('');
  }

  const warnings = [
    ...(resourceState.resources?.warnings ?? []),
    ...(supplyPool?.warnings ?? []),
    ...(plannerResult?.warnings ?? []),
  ];

  return (
    <div className="page-stack">
      <PageIntro
        title="Target Planner"
        description="Plan several desired outputs together, spend shared local supply once, and see the remaining item and craft requirements."
        storageKey="target-output-planner"
      />

      {resourceState.isLoading ? (
        <section className="page-card route-loading" aria-label="Loading Target Planner">
          <p>Loading Target Planner...</p>
        </section>
      ) : null}

      {!resourceState.isLoading && resourceState.error ? (
        <section className="page-card status-alert status-alert--warning" aria-label="Target Planner error">
          <p>{resourceState.error}</p>
        </section>
      ) : null}

      {resourceState.resources && supplyPool ? (
        <>
          <section className="page-card">
            <TargetPlannerSummary result={plannerResult} supplyPool={supplyPool} />
            {warnings.length > 0 ? (
              <ul className="warning-list">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="page-card" aria-labelledby="target-output-controls-heading">
            <h2 id="target-output-controls-heading">Targets</h2>
            <div className="inline-control-row">
              <label className="field-label">
                Item
                <input
                  className="text-input"
                  list={targetListId}
                  value={targetItemName}
                  onChange={(event) => setTargetItemName(event.target.value)}
                  placeholder="Fancy Pipe"
                />
              </label>
              <label className="field-label">
                Quantity
                <input
                  className="text-input text-input--short"
                  type="number"
                  min="1"
                  value={targetQuantity}
                  onChange={(event) => setTargetQuantity(event.target.value)}
                />
              </label>
              <button type="button" className="button button--primary" onClick={handleAddTarget}>
                Add target
              </button>
            </div>
            <datalist id={targetListId}>
              {itemOptions.map((option) => (
                <option key={option.canonicalKey} value={option.itemName} />
              ))}
            </datalist>
            {plannerState.targets.length > 0 ? (
              <div className="table-scroll target-output-control-table">
                <table className="summary-table">
                  <thead>
                    <tr>
                      <th scope="col">Target</th>
                      <th scope="col">Quantity</th>
                      <th scope="col">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plannerState.targets.map((target) => (
                      <tr key={target.targetId}>
                        <td>
                          <ItemProfileLink
                            canonicalKey={target.canonicalKey}
                            itemName={target.itemName}
                            iconSrc={getItemIconSrc(target.canonicalKey)}
                          />
                        </td>
                        <td>{formatQuantity(target.desiredQuantity)}</td>
                        <td>
                          <button
                            type="button"
                            className="button"
                            onClick={() => persistPlannerState(removeTargetOutputPlannerTarget(plannerState, target.targetId ?? ''))}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-state">No targets added yet.</p>
            )}
          </section>

          <section className="page-card" aria-labelledby="target-output-overrides-heading">
            <h2 id="target-output-overrides-heading">Supply Overrides</h2>
            <div className="inline-control-row">
              <label className="field-label">
                Item
                <input
                  className="text-input"
                  list={overrideListId}
                  value={overrideItemName}
                  onChange={(event) => setOverrideItemName(event.target.value)}
                  placeholder="Frost Snapper Shell"
                />
              </label>
              <label className="field-label">
                Effective supply
                <input
                  className="text-input text-input--short"
                  type="number"
                  min="0"
                  value={overrideQuantity}
                  onChange={(event) => setOverrideQuantity(event.target.value)}
                />
              </label>
              <button type="button" className="button" onClick={handleSaveOverride}>
                Save override
              </button>
            </div>
            <datalist id={overrideListId}>
              {itemOptions.map((option) => (
                <option key={option.canonicalKey} value={option.itemName} />
              ))}
            </datalist>
            {plannerState.supplyOverrides.length > 0 ? (
              <div className="table-scroll target-output-control-table">
                <table className="summary-table">
                  <thead>
                    <tr>
                      <th scope="col">Item</th>
                      <th scope="col">Derived</th>
                      <th scope="col">Effective</th>
                      <th scope="col">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plannerState.supplyOverrides.map((override) => {
                      const supplyItem = supplyPool.byCanonicalKey[override.canonicalKey] ?? null;

                      return (
                        <tr key={override.canonicalKey}>
                          <td>
                            <ItemProfileLink
                              canonicalKey={override.canonicalKey}
                              itemName={override.itemName}
                              iconSrc={getItemIconSrc(override.canonicalKey)}
                            />
                          </td>
                          <td>{formatQuantity(supplyItem?.derivedQuantity ?? 0)}</td>
                          <td>{formatQuantity(override.quantity)}</td>
                          <td>
                            <button
                              type="button"
                              className="button"
                              onClick={() => persistPlannerState(
                                removeTargetOutputSupplyOverride(plannerState, override.canonicalKey),
                              )}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-state">No supply overrides saved.</p>
            )}
          </section>

          <section className="page-card" aria-labelledby="target-output-results-heading">
            <h2 id="target-output-results-heading">Combined Requirements</h2>
            <TargetRowsTable rows={plannerResult?.rows ?? []} />
          </section>

          <section className="page-card" aria-labelledby="target-output-tree-heading">
            <h2 id="target-output-tree-heading">Planning Tree</h2>
            <TargetPlanningTree graph={planningGraph} />
          </section>

          <section className="page-card" aria-labelledby="target-output-provenance-heading">
            <h2 id="target-output-provenance-heading">Why These Materials</h2>
            <TargetPlanningProvenance graph={planningGraph} />
          </section>
        </>
      ) : null}
    </div>
  );
}
