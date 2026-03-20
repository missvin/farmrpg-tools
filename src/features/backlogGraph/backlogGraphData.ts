export const BACKLOG_GRAPH_COLUMNS = [
  'backlog_id',
  'parent_id',
  'title',
  'type',
  'status',
  'priority',
  'effort',
  'area',
  'user_value',
  'proposed_solution',
  'scope_v1',
  'dependencies',
  'target_version',
  'source',
  'notes',
  'friendly_title',
  'friendly_summary',
  'friendly_description',
  'release_notes',
] as const;

export type BacklogGraphWarningCode =
  | 'duplicate_backlog_id'
  | 'missing_backlog_id'
  | 'missing_title'
  | 'missing_parent_reference'
  | 'unknown_dependency_reference'
  | 'malformed_dependency_reference'
  | 'self_parent_reference'
  | 'self_dependency_reference';

export type BacklogGraphWarning = {
  code: BacklogGraphWarningCode;
  message: string;
  backlogId?: string;
  field?: 'backlog_id' | 'title' | 'parent_id' | 'dependencies';
  referenceId?: string;
};

export type BacklogGraphDetail = {
  title: string;
  friendlyTitle: string;
  friendlySummary: string | null;
  friendlyDescription: string | null;
  userValue: string;
  proposedSolution: string;
  scopeV1: string;
  dependenciesText: string;
  targetVersion: string;
  source: string;
  notes: string;
  releaseNotes: string;
};

export type BacklogGraphNode = {
  id: string;
  parentId: string | null;
  title: string;
  displayTitle: string;
  displaySummary: string | null;
  displayDescription: string | null;
  type: string;
  status: string;
  priority: string;
  effort: string;
  area: string;
  targetVersion: string;
  source: string;
  detail: BacklogGraphDetail;
};

export type BacklogGraphEdge = {
  from: string;
  to: string;
  relationship: 'parent_child' | 'dependency';
};

export type BacklogGraphData = {
  nodes: BacklogGraphNode[];
  edges: BacklogGraphEdge[];
  byId: Record<string, BacklogGraphNode>;
  warnings: BacklogGraphWarning[];
};

type BacklogGraphRow = {
  backlogId: string;
  parentId: string | null;
  title: string;
  type: string;
  status: string;
  priority: string;
  effort: string;
  area: string;
  userValue: string;
  proposedSolution: string;
  scopeV1: string;
  dependencies: string;
  targetVersion: string;
  source: string;
  notes: string;
  friendlyTitle: string | null;
  friendlySummary: string | null;
  friendlyDescription: string | null;
  releaseNotes: string;
};

function parseCsvRow(line: string): string[] {
  const values: string[] = [];
  let currentValue = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        currentValue += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }

      continue;
    }

    if (character === ',' && !inQuotes) {
      values.push(currentValue);
      currentValue = '';
      continue;
    }

    currentValue += character;
  }

  values.push(currentValue);
  return values;
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase();
}

function readField(values: string[], headerIndex: Record<string, number>, fieldName: string): string {
  const index = headerIndex[fieldName];
  return index === undefined ? '' : values[index] ?? '';
}

function toOptionalDisplayField(value: string): string | null {
  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function parseDependencyTokens(rawDependencies: string): string[] {
  return rawDependencies
    .split(';')
    .map((token) => token.trim())
    .filter(Boolean);
}

function isBacklogId(value: string): boolean {
  return /^BL-\d+$/.test(value);
}

function buildBacklogGraphNode(row: BacklogGraphRow): BacklogGraphNode {
  const displayTitle = row.friendlyTitle ?? row.title;

  return {
    id: row.backlogId,
    parentId: row.parentId,
    title: row.title,
    displayTitle,
    displaySummary: row.friendlySummary,
    displayDescription: row.friendlyDescription,
    type: row.type,
    status: row.status,
    priority: row.priority,
    effort: row.effort,
    area: row.area,
    targetVersion: row.targetVersion,
    source: row.source,
    detail: {
      title: row.title,
      friendlyTitle: displayTitle,
      friendlySummary: row.friendlySummary,
      friendlyDescription: row.friendlyDescription,
      userValue: row.userValue,
      proposedSolution: row.proposedSolution,
      scopeV1: row.scopeV1,
      dependenciesText: row.dependencies,
      targetVersion: row.targetVersion,
      source: row.source,
      notes: row.notes,
      releaseNotes: row.releaseNotes,
    },
  };
}

export function parseBacklogGraphCsv(csvText: string): BacklogGraphData {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return {
      nodes: [],
      edges: [],
      byId: {},
      warnings: [],
    };
  }

  const headers = parseCsvRow(lines[0]).map(normalizeHeader);
  const missingColumns = BACKLOG_GRAPH_COLUMNS.filter((column) => !headers.includes(column));

  if (missingColumns.length > 0) {
    throw new Error(`Invalid backlog graph data schema (missing columns: ${missingColumns.join(', ')}).`);
  }

  const headerIndex = headers.reduce<Record<string, number>>((indexByHeader, header, index) => {
    indexByHeader[header] = index;
    return indexByHeader;
  }, {});

  const warnings: BacklogGraphWarning[] = [];
  const rows: BacklogGraphRow[] = [];
  const seenBacklogIds = new Set<string>();

  for (const line of lines.slice(1)) {
    const values = parseCsvRow(line);
    const backlogId = readField(values, headerIndex, 'backlog_id').trim();

    if (!backlogId) {
      warnings.push({
        code: 'missing_backlog_id',
        field: 'backlog_id',
        message: 'Skipped backlog row without backlog_id.',
      });
      continue;
    }

    if (seenBacklogIds.has(backlogId)) {
      warnings.push({
        code: 'duplicate_backlog_id',
        backlogId,
        field: 'backlog_id',
        message: `Skipped duplicate backlog row "${backlogId}".`,
      });
      continue;
    }

    seenBacklogIds.add(backlogId);

    const title = readField(values, headerIndex, 'title').trim();

    if (!title) {
      warnings.push({
        code: 'missing_title',
        backlogId,
        field: 'title',
        message: `Backlog row "${backlogId}" is missing a title.`,
      });
    }

    rows.push({
      backlogId,
      parentId: toOptionalDisplayField(readField(values, headerIndex, 'parent_id')),
      title,
      type: readField(values, headerIndex, 'type').trim(),
      status: readField(values, headerIndex, 'status').trim(),
      priority: readField(values, headerIndex, 'priority').trim(),
      effort: readField(values, headerIndex, 'effort').trim(),
      area: readField(values, headerIndex, 'area').trim(),
      userValue: readField(values, headerIndex, 'user_value').trim(),
      proposedSolution: readField(values, headerIndex, 'proposed_solution').trim(),
      scopeV1: readField(values, headerIndex, 'scope_v1').trim(),
      dependencies: readField(values, headerIndex, 'dependencies').trim(),
      targetVersion: readField(values, headerIndex, 'target_version').trim(),
      source: readField(values, headerIndex, 'source').trim(),
      notes: readField(values, headerIndex, 'notes').trim(),
      friendlyTitle: toOptionalDisplayField(readField(values, headerIndex, 'friendly_title')),
      friendlySummary: toOptionalDisplayField(readField(values, headerIndex, 'friendly_summary')),
      friendlyDescription: toOptionalDisplayField(readField(values, headerIndex, 'friendly_description')),
      releaseNotes: readField(values, headerIndex, 'release_notes').trim(),
    });
  }

  const nodes = rows.map(buildBacklogGraphNode);
  const byId = nodes.reduce<Record<string, BacklogGraphNode>>((result, node) => {
    result[node.id] = node;
    return result;
  }, {});
  const edges: BacklogGraphEdge[] = [];
  const seenEdges = new Set<string>();

  function pushEdge(edge: BacklogGraphEdge): void {
    const edgeKey = `${edge.relationship}:${edge.from}->${edge.to}`;

    if (seenEdges.has(edgeKey)) {
      return;
    }

    seenEdges.add(edgeKey);
    edges.push(edge);
  }

  for (const row of rows) {
    if (row.parentId) {
      if (row.parentId === row.backlogId) {
        warnings.push({
          code: 'self_parent_reference',
          backlogId: row.backlogId,
          field: 'parent_id',
          referenceId: row.parentId,
          message: `Backlog row "${row.backlogId}" cannot reference itself as parent.`,
        });
      } else if (!byId[row.parentId]) {
        warnings.push({
          code: 'missing_parent_reference',
          backlogId: row.backlogId,
          field: 'parent_id',
          referenceId: row.parentId,
          message: `Backlog row "${row.backlogId}" references missing parent "${row.parentId}".`,
        });
      } else {
        pushEdge({
          from: row.parentId,
          to: row.backlogId,
          relationship: 'parent_child',
        });
      }
    }

    for (const token of parseDependencyTokens(row.dependencies)) {
      if (!token.toUpperCase().startsWith('BL-')) {
        continue;
      }

      if (!isBacklogId(token)) {
        warnings.push({
          code: 'malformed_dependency_reference',
          backlogId: row.backlogId,
          field: 'dependencies',
          referenceId: token,
          message: `Backlog row "${row.backlogId}" has malformed dependency reference "${token}".`,
        });
        continue;
      }

      if (token === row.backlogId) {
        warnings.push({
          code: 'self_dependency_reference',
          backlogId: row.backlogId,
          field: 'dependencies',
          referenceId: token,
          message: `Backlog row "${row.backlogId}" cannot depend on itself.`,
        });
        continue;
      }

      if (!byId[token]) {
        warnings.push({
          code: 'unknown_dependency_reference',
          backlogId: row.backlogId,
          field: 'dependencies',
          referenceId: token,
          message: `Backlog row "${row.backlogId}" references unknown dependency "${token}".`,
        });
        continue;
      }

      pushEdge({
        from: token,
        to: row.backlogId,
        relationship: 'dependency',
      });
    }
  }

  return {
    nodes,
    edges,
    byId,
    warnings,
  };
}

export async function loadBacklogGraphFromCsvUrl(csvUrl: string): Promise<BacklogGraphData> {
  const response = await fetch(csvUrl);

  if (!response.ok) {
    throw new Error('Unable to load local backlog graph data.');
  }

  const csvText = await response.text();
  return parseBacklogGraphCsv(csvText);
}
