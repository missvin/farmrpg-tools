import { describe, expect, it, vi } from 'vitest';

import { loadBacklogGraph, parseBacklogGraphCsv } from './loadBacklogGraph';

const BACKLOG_CSV = `"backlog_id","parent_id","title","type","status","priority","effort","area","user_value","proposed_solution","scope_v1","dependencies","target_version","source","notes","friendly_title","friendly_summary","friendly_description","release_notes"
"BL-053","","Runtime backlog metadata boundary exception","architecture","shipped","medium","s","planning","value","solution","scope","Current planning-file workflow; local-first architecture","v1.7","chat","note","Backlog Runtime Boundary","Allow a small internal backlog view to read backlog metadata locally without turning planning files into normal app data.","Document the narrow exception for a read-only internal backlog view.","release"
"BL-054","BL-053","Display-oriented backlog metadata fields","tooling","shipped","medium","s","planning","value","solution","scope","BL-053; planning/backlog.csv schema conventions","v1.7","chat","note","","","",""
"BL-055","BL-053","Backlog dependency graph loader","architecture","inbox","medium","m","planning","value","solution","scope","BL-053; BL-054","v1.7","chat","note","Backlog Graph Loader","Parse backlog rows into graph-ready nodes, edges, and warnings for an internal planning view.","Build a pure local backlog loader.",""
`;

describe('parseBacklogGraphCsv', () => {
  it('parses graph-ready nodes and parent/dependency edges with friendly-field fallback', () => {
    const graph = parseBacklogGraphCsv(BACKLOG_CSV);

    expect(graph.nodes).toHaveLength(3);
    expect(graph.byId['BL-053']).toMatchObject({
      id: 'BL-053',
      displayTitle: 'Backlog Runtime Boundary',
      displaySummary:
        'Allow a small internal backlog view to read backlog metadata locally without turning planning files into normal app data.',
      displayDescription: 'Document the narrow exception for a read-only internal backlog view.',
    });
    expect(graph.byId['BL-054']).toMatchObject({
      title: 'Display-oriented backlog metadata fields',
      displayTitle: 'Display-oriented backlog metadata fields',
      displaySummary: null,
      displayDescription: null,
    });
    expect(graph.edges).toEqual([
      { from: 'BL-053', to: 'BL-054', relationship: 'parent_child' },
      { from: 'BL-053', to: 'BL-054', relationship: 'dependency' },
      { from: 'BL-053', to: 'BL-055', relationship: 'parent_child' },
      { from: 'BL-053', to: 'BL-055', relationship: 'dependency' },
      { from: 'BL-054', to: 'BL-055', relationship: 'dependency' },
    ]);
    expect(graph.warnings).toEqual([]);
  });

  it('collects warnings for duplicate ids, missing refs, malformed dependency tokens, and self references', () => {
    const graph = parseBacklogGraphCsv(`"backlog_id","parent_id","title","type","status","priority","effort","area","user_value","proposed_solution","scope_v1","dependencies","target_version","source","notes","friendly_title","friendly_summary","friendly_description","release_notes"
"BL-100","","Good row","feature","inbox","medium","s","planning","value","solution","scope","BL-999; BL-bad; external dependency","future","chat","note","","","",""
"BL-100","","Duplicate row","feature","inbox","medium","s","planning","value","solution","scope","","future","chat","note","","","",""
"BL-101","BL-404","Missing parent","feature","inbox","medium","s","planning","value","solution","scope","BL-101","future","chat","note","","","",""
`);

    expect(graph.nodes.map((node) => node.id)).toEqual(['BL-100', 'BL-101']);
    expect(graph.edges).toEqual([]);
    expect(graph.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'duplicate_backlog_id',
          backlogId: 'BL-100',
        }),
        expect.objectContaining({
          code: 'unknown_dependency_reference',
          backlogId: 'BL-100',
          referenceId: 'BL-999',
        }),
        expect.objectContaining({
          code: 'malformed_dependency_reference',
          backlogId: 'BL-100',
          referenceId: 'BL-bad',
        }),
        expect.objectContaining({
          code: 'missing_parent_reference',
          backlogId: 'BL-101',
          referenceId: 'BL-404',
        }),
        expect.objectContaining({
          code: 'self_dependency_reference',
          backlogId: 'BL-101',
          referenceId: 'BL-101',
        }),
      ]),
    );
  });

  it('skips rows without backlog ids and warns about missing titles', () => {
    const graph = parseBacklogGraphCsv(`"backlog_id","parent_id","title","type","status","priority","effort","area","user_value","proposed_solution","scope_v1","dependencies","target_version","source","notes","friendly_title","friendly_summary","friendly_description","release_notes"
"","","Missing id","feature","inbox","medium","s","planning","value","solution","scope","","future","chat","note","","","",""
"BL-200","","","feature","inbox","medium","s","planning","value","solution","scope","","future","chat","note","","","",""
`);

    expect(graph.nodes).toHaveLength(1);
    expect(graph.byId['BL-200'].displayTitle).toBe('');
    expect(graph.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'missing_backlog_id',
        }),
        expect.objectContaining({
          code: 'missing_title',
          backlogId: 'BL-200',
        }),
      ]),
    );
  });

  it('loads the local backlog CSV through fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(BACKLOG_CSV, { status: 200 }));

    vi.stubGlobal('fetch', fetchMock);

    const graph = await loadBacklogGraph();

    expect(fetchMock).toHaveBeenCalledWith('/planning/backlog.csv');
    expect(graph.nodes).toHaveLength(3);
    expect(graph.byId['BL-055'].detail.friendlyTitle).toBe('Backlog Graph Loader');
  });
});
