import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BacklogGraphPage } from './BacklogGraphPage';

const loadBacklogGraphMock = vi.fn();

vi.mock('../lib/loadBacklogGraph', async () => {
  const actual = await vi.importActual<typeof import('../lib/loadBacklogGraph')>('../lib/loadBacklogGraph');

  return {
    ...actual,
    loadBacklogGraph: (...args: unknown[]) => loadBacklogGraphMock(...args),
  };
});

const GRAPH_FIXTURE = {
  nodes: [
    {
      id: 'BL-053',
      parentId: null,
      title: 'Runtime backlog metadata boundary exception',
      displayTitle: 'Backlog Runtime Boundary',
      displaySummary: 'Allow a small internal backlog view to read backlog metadata locally.',
      displayDescription: 'Document the narrow exception for internal backlog visualization.',
      type: 'architecture',
      status: 'shipped',
      priority: 'medium',
      effort: 's',
      area: 'planning',
      targetVersion: 'v1.7',
      source: 'chat',
      detail: {
        title: 'Runtime backlog metadata boundary exception',
        friendlyTitle: 'Backlog Runtime Boundary',
        friendlySummary: 'Allow a small internal backlog view to read backlog metadata locally.',
        friendlyDescription: 'Document the narrow exception for internal backlog visualization.',
        userValue: 'Let an internal backlog view read curated metadata locally.',
        proposedSolution: 'Document a narrow runtime exception.',
        scopeV1: 'Planning/docs boundary only',
        dependenciesText: 'Current planning-file workflow; local-first architecture',
        targetVersion: 'v1.7',
        source: 'chat',
        notes: 'Boundary clarification only.',
        releaseNotes: 'Documented the narrow runtime boundary exception.',
      },
    },
    {
      id: 'BL-054',
      parentId: 'BL-053',
      title: 'Display-oriented backlog metadata fields',
      displayTitle: 'Friendly Backlog Labels',
      displaySummary: 'Add short presentation fields for future internal backlog cards.',
      displayDescription: 'Extend backlog rows with optional friendly fields.',
      type: 'tooling',
      status: 'shipped',
      priority: 'medium',
      effort: 's',
      area: 'planning',
      targetVersion: 'v1.7',
      source: 'chat',
      detail: {
        title: 'Display-oriented backlog metadata fields',
        friendlyTitle: 'Friendly Backlog Labels',
        friendlySummary: 'Add short presentation fields for future internal backlog cards.',
        friendlyDescription: 'Extend backlog rows with optional friendly fields.',
        userValue: 'Make future internal planning UI text more readable.',
        proposedSolution: 'Add friendly_title, friendly_summary, and friendly_description.',
        scopeV1: 'Schema only',
        dependenciesText: 'BL-053; planning/backlog.csv schema conventions',
        targetVersion: 'v1.7',
        source: 'chat',
        notes: 'Keep these fields optional.',
        releaseNotes: 'Added optional friendly backlog metadata fields.',
      },
    },
    {
      id: 'BL-055',
      parentId: 'BL-053',
      title: 'Backlog dependency graph loader',
      displayTitle: 'Backlog Graph Loader',
      displaySummary: 'Parse backlog rows into graph-ready nodes and edges.',
      displayDescription: 'Build a pure local backlog loader with non-fatal warnings.',
      type: 'architecture',
      status: 'shipped',
      priority: 'medium',
      effort: 'm',
      area: 'planning',
      targetVersion: 'v1.7',
      source: 'chat',
      detail: {
        title: 'Backlog dependency graph loader',
        friendlyTitle: 'Backlog Graph Loader',
        friendlySummary: 'Parse backlog rows into graph-ready nodes and edges.',
        friendlyDescription: 'Build a pure local backlog loader with non-fatal warnings.',
        userValue: 'Turn backlog rows into graph-ready support data.',
        proposedSolution: 'Parse backlog rows into nodes, edges, and warnings.',
        scopeV1: 'Pure loader/derivation only',
        dependenciesText: 'BL-053; BL-054; planning/backlog.csv',
        targetVersion: 'v1.7',
        source: 'chat',
        notes: 'Keep loader warning-tolerant.',
        releaseNotes: 'Added a local backlog graph loader.',
      },
    },
  ],
  edges: [
    { from: 'BL-053', to: 'BL-054', relationship: 'parent_child' as const },
    { from: 'BL-053', to: 'BL-055', relationship: 'parent_child' as const },
    { from: 'BL-053', to: 'BL-054', relationship: 'dependency' as const },
    { from: 'BL-053', to: 'BL-055', relationship: 'dependency' as const },
    { from: 'BL-054', to: 'BL-055', relationship: 'dependency' as const },
  ],
  byId: {} as Record<string, (typeof GRAPH_FIXTURE.nodes)[number]>,
  warnings: [],
};

GRAPH_FIXTURE.byId = Object.fromEntries(GRAPH_FIXTURE.nodes.map((node) => [node.id, node]));

describe('BacklogGraphPage', () => {
  beforeEach(() => {
    loadBacklogGraphMock.mockReset();
  });

  it('renders the selected backlog neighborhood and detail card using friendly fields', async () => {
    loadBacklogGraphMock.mockResolvedValue(GRAPH_FIXTURE);

    render(<BacklogGraphPage />);

    expect(await screen.findByRole('heading', { name: 'Dependency Neighborhood' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Selected Item Detail' })).toBeInTheDocument();
    expect(screen.getAllByText('Backlog Runtime Boundary')).toHaveLength(2);
    expect(
      screen.getAllByText('Allow a small internal backlog view to read backlog metadata locally.'),
    ).toHaveLength(2);
    expect(screen.getByText('Document the narrow exception for internal backlog visualization.')).toBeInTheDocument();
    expect(screen.getAllByText('Friendly Backlog Labels').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Backlog Graph Loader').length).toBeGreaterThan(0);
    expect(screen.getByText('Runtime backlog metadata boundary exception')).toBeInTheDocument();
    expect(screen.getByText('Document a narrow runtime exception.')).toBeInTheDocument();
  });

  it('updates the neighborhood and detail panel when the selected item changes', async () => {
    const user = userEvent.setup();
    loadBacklogGraphMock.mockResolvedValue(GRAPH_FIXTURE);

    render(<BacklogGraphPage />);

    await screen.findByRole('heading', { name: 'Dependency Neighborhood' });
    await user.selectOptions(screen.getByLabelText('Backlog item'), 'BL-055');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Selected Item Detail' })).toBeInTheDocument();
      expect(screen.getByText('Build a pure local backlog loader with non-fatal warnings.')).toBeInTheDocument();
    });

    const selectedSection = screen.getByRole('heading', { name: 'Selected' }).closest('section') as HTMLElement;
    expect(within(selectedSection).getByText('Backlog Graph Loader')).toBeInTheDocument();
    expect(screen.getByText('Parse backlog rows into nodes, edges, and warnings.')).toBeInTheDocument();
  });

  it('shows backlog warnings without failing the page', async () => {
    loadBacklogGraphMock.mockResolvedValue({
      ...GRAPH_FIXTURE,
      warnings: [
        {
          code: 'unknown_dependency_reference',
          backlogId: 'BL-055',
          field: 'dependencies',
          referenceId: 'BL-999',
          message: 'Backlog row "BL-055" references unknown dependency "BL-999".',
        },
      ],
    });

    render(<BacklogGraphPage />);

    expect(await screen.findByRole('heading', { name: 'Backlog Warnings' })).toBeInTheDocument();
    expect(screen.getByText('unknown_dependency_reference')).toBeInTheDocument();
    expect(screen.getByText('BL-055: Backlog row "BL-055" references unknown dependency "BL-999".')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dependency Neighborhood' })).toBeInTheDocument();
  });
});
