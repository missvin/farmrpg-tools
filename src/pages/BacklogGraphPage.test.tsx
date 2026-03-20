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
    {
      id: 'BL-056',
      parentId: 'BL-055',
      title: 'Internal backlog dependency graph page',
      displayTitle: 'Backlog Graph Page',
      displaySummary: 'Show a read-only graph view with selected-item detail.',
      displayDescription: 'Add a readable internal backlog graph page.',
      type: 'feature',
      status: 'shipped',
      priority: 'medium',
      effort: 'm',
      area: 'planning',
      targetVersion: 'future',
      source: 'chat',
      detail: {
        title: 'Internal backlog dependency graph page',
        friendlyTitle: 'Backlog Graph Page',
        friendlySummary: 'Show a read-only graph view with selected-item detail.',
        friendlyDescription: 'Add a readable internal backlog graph page.',
        userValue: 'Make backlog dependency structure easier to inspect.',
        proposedSolution: 'Add a first graph page.',
        scopeV1: 'Read-only graph page',
        dependenciesText: 'BL-055',
        targetVersion: 'future',
        source: 'chat',
        notes: 'Keep the first graph page modest and readable.',
        releaseNotes: 'Added a read-only internal backlog graph page.',
      },
    },
    {
      id: 'BL-999',
      parentId: null,
      title: 'External workflow note',
      displayTitle: 'External Workflow Note',
      displaySummary: 'Non-planning row used to verify filters.',
      displayDescription: 'A non-planning row for test coverage.',
      type: 'tooling',
      status: 'inbox',
      priority: 'low',
      effort: 's',
      area: 'reference_data',
      targetVersion: 'future',
      source: 'chat',
      detail: {
        title: 'External workflow note',
        friendlyTitle: 'External Workflow Note',
        friendlySummary: 'Non-planning row used to verify filters.',
        friendlyDescription: 'A non-planning row for test coverage.',
        userValue: 'Verify graph filters.',
        proposedSolution: 'Add a distinct area/status row to the fixture.',
        scopeV1: 'Test fixture only',
        dependenciesText: '',
        targetVersion: 'future',
        source: 'chat',
        notes: 'Used only in tests.',
        releaseNotes: '',
      },
    },
    {
      id: 'BL-057',
      parentId: 'BL-056',
      title: 'Backlog graph focus and filter controls',
      displayTitle: 'Graph Focus Controls',
      displaySummary: 'Add small focus controls to keep the graph readable.',
      displayDescription: 'Add lightweight filters and focus controls for the graph page.',
      type: 'ux',
      status: 'inbox',
      priority: 'low',
      effort: 's',
      area: 'planning',
      targetVersion: 'future',
      source: 'chat',
      detail: {
        title: 'Backlog graph focus and filter controls',
        friendlyTitle: 'Graph Focus Controls',
        friendlySummary: 'Add small focus controls to keep the graph readable.',
        friendlyDescription: 'Add lightweight filters and focus controls for the graph page.',
        userValue: 'Make the graph more readable as the backlog grows.',
        proposedSolution: 'Add small focus and filter controls.',
        scopeV1: 'Lightweight focus/filter UI only',
        dependenciesText: 'BL-056',
        targetVersion: 'future',
        source: 'chat',
        notes: 'Keep this modest and local-only.',
        releaseNotes: '',
      },
    },
    {
      id: 'BL-058',
      parentId: 'BL-056',
      title: 'Color-coded backlog graph nodes by status',
      displayTitle: 'Status Color Nodes',
      displaySummary: 'Add status-based color cues so backlog graph nodes are easier to scan.',
      displayDescription: 'Apply a small status-to-color mapping in backlog graph UI code.',
      type: 'ux',
      status: 'in_progress',
      priority: 'low',
      effort: 'xs',
      area: 'planning',
      targetVersion: 'future',
      source: 'chat',
      detail: {
        title: 'Color-coded backlog graph nodes by status',
        friendlyTitle: 'Status Color Nodes',
        friendlySummary: 'Add status-based color cues so backlog graph nodes are easier to scan.',
        friendlyDescription: 'Apply a small status-to-color mapping in backlog graph UI code.',
        userValue: 'Make graph scanning easier.',
        proposedSolution: 'Map statuses to visual node treatments in app code.',
        scopeV1: 'Visual-only status styling',
        dependenciesText: 'BL-056; BL-057',
        targetVersion: 'future',
        source: 'chat',
        notes: 'Keep color secondary to text labels and badges.',
        releaseNotes: '',
      },
    },
    {
      id: 'BL-998',
      parentId: null,
      title: 'Unknown status backlog item',
      displayTitle: 'Unknown Status Item',
      displaySummary: 'Used to verify fallback styling.',
      displayDescription: 'A fixture row with an unexpected status value.',
      type: 'tooling',
      status: 'mystery',
      priority: 'low',
      effort: 's',
      area: 'planning',
      targetVersion: 'future',
      source: 'chat',
      detail: {
        title: 'Unknown status backlog item',
        friendlyTitle: 'Unknown Status Item',
        friendlySummary: 'Used to verify fallback styling.',
        friendlyDescription: 'A fixture row with an unexpected status value.',
        userValue: 'Verify fallback styling behavior.',
        proposedSolution: 'Add an unexpected status to the test fixture.',
        scopeV1: 'Test fixture only',
        dependenciesText: '',
        targetVersion: 'future',
        source: 'chat',
        notes: 'Used only in tests.',
        releaseNotes: '',
      },
    },
  ],
  edges: [
    { from: 'BL-053', to: 'BL-054', relationship: 'parent_child' as const },
    { from: 'BL-053', to: 'BL-055', relationship: 'parent_child' as const },
    { from: 'BL-055', to: 'BL-056', relationship: 'parent_child' as const },
    { from: 'BL-056', to: 'BL-057', relationship: 'parent_child' as const },
    { from: 'BL-056', to: 'BL-058', relationship: 'parent_child' as const },
    { from: 'BL-053', to: 'BL-054', relationship: 'dependency' as const },
    { from: 'BL-053', to: 'BL-055', relationship: 'dependency' as const },
    { from: 'BL-054', to: 'BL-055', relationship: 'dependency' as const },
    { from: 'BL-055', to: 'BL-056', relationship: 'dependency' as const },
    { from: 'BL-056', to: 'BL-057', relationship: 'dependency' as const },
    { from: 'BL-057', to: 'BL-058', relationship: 'dependency' as const },
    { from: 'BL-999', to: 'BL-053', relationship: 'dependency' as const },
    { from: 'BL-998', to: 'BL-053', relationship: 'dependency' as const },
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
    expect(screen.getAllByText('Friendly Backlog Labels')).toHaveLength(1);
    expect(screen.getAllByText('Backlog Graph Loader')).toHaveLength(1);
    expect(screen.getAllByText('Child + Dependent')).toHaveLength(2);
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

  it('supports expanded focus mode for recursive ancestry and descendants', async () => {
    const user = userEvent.setup();
    loadBacklogGraphMock.mockResolvedValue(GRAPH_FIXTURE);

    render(<BacklogGraphPage />);

    await screen.findByRole('heading', { name: 'Dependency Neighborhood' });
    await user.selectOptions(screen.getByLabelText('Backlog item'), 'BL-055');
    await user.selectOptions(screen.getByLabelText('Focus mode'), 'expanded');

    expect(screen.getByText('Expanded ancestry + descendants')).toBeInTheDocument();
    expect(screen.getAllByText('Ancestor').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Descendant').length).toBeGreaterThan(0);
    expect(screen.getByText('Backlog Graph Page')).toBeInTheDocument();
    expect(screen.getByText('External Workflow Note')).toBeInTheDocument();
  });

  it('switches into whole-backlog overview mode and renders the full filtered graph', async () => {
    const user = userEvent.setup();
    loadBacklogGraphMock.mockResolvedValue(GRAPH_FIXTURE);

    render(<BacklogGraphPage />);

    await screen.findByRole('heading', { name: 'Dependency Neighborhood' });
    await user.selectOptions(screen.getByLabelText('Graph mode'), 'overview');

    expect(screen.getByRole('heading', { name: 'Whole-Backlog Overview' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Dependency Neighborhood' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Backlog Runtime Boundary (BL-053)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Graph Focus Controls (BL-057)' })).toBeInTheDocument();
    expect(screen.getByText('Showing 8 backlog items in whole-backlog overview mode.')).toBeInTheDocument();
  });

  it('keeps shared selection and detail behavior when selecting nodes in overview mode', async () => {
    const user = userEvent.setup();
    loadBacklogGraphMock.mockResolvedValue(GRAPH_FIXTURE);

    render(<BacklogGraphPage />);

    await screen.findByRole('heading', { name: 'Dependency Neighborhood' });
    await user.selectOptions(screen.getByLabelText('Graph mode'), 'overview');
    await user.click(screen.getByRole('button', { name: 'Status Color Nodes (BL-058)' }));

    const detailSection = screen.getByRole('heading', { name: 'Selected Item Detail' }).closest('section') as HTMLElement;

    expect(detailSection).toBeInTheDocument();
    expect(within(detailSection).getByText('Status Color Nodes')).toBeInTheDocument();
    expect(
      within(detailSection).getByText('Apply a small status-to-color mapping in backlog graph UI code.'),
    ).toBeInTheDocument();
    expect(within(detailSection).getByText('Map statuses to visual node treatments in app code.')).toBeInTheDocument();
  });

  it('supports practical zoom controls and overview reset behavior', async () => {
    const user = userEvent.setup();
    loadBacklogGraphMock.mockResolvedValue(GRAPH_FIXTURE);

    render(<BacklogGraphPage />);

    await screen.findByRole('heading', { name: 'Dependency Neighborhood' });
    await user.selectOptions(screen.getByLabelText('Graph mode'), 'overview');

    const zoomValue = screen.getByTestId('backlog-overview-zoom-value');
    const stage = screen.getByTestId('backlog-overview-stage');
    const initialTransform = stage.getAttribute('style') ?? '';
    const initialZoomText = zoomValue.textContent;

    await user.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(zoomValue.textContent).not.toBe(initialZoomText);
    expect((stage.getAttribute('style') ?? '')).not.toBe(initialTransform);

    await user.click(screen.getByRole('button', { name: 'Pan right' }));
    await user.click(screen.getByRole('button', { name: 'Pan down' }));

    expect((stage.getAttribute('style') ?? '')).toContain('translate(60px, 60px)');

    await user.click(screen.getByRole('button', { name: 'Reset overview' }));
    expect(zoomValue).toHaveTextContent(/^Zoom: \d+%$/);
    expect((stage.getAttribute('style') ?? '')).toContain('translate(0px, 0px)');
  });

  it('filters the graph by area and resets back to the full view', async () => {
    const user = userEvent.setup();
    loadBacklogGraphMock.mockResolvedValue(GRAPH_FIXTURE);

    render(<BacklogGraphPage />);

    await screen.findByRole('heading', { name: 'Dependency Neighborhood' });
    await user.selectOptions(screen.getByLabelText('Area filter'), 'reference_data');

    expect(screen.getByText('Showing 1 backlog item in immediate neighborhood mode.')).toBeInTheDocument();
    expect(screen.getByLabelText('Backlog item')).toHaveValue('BL-999');
    expect(screen.getByText('No immediate downstream relationships.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reset graph view' }));

    expect(screen.getByText('Showing 8 backlog items in immediate neighborhood mode.')).toBeInTheDocument();
    expect(screen.getByLabelText('Area filter')).toHaveValue('');
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

  it('applies status-based node styling for common statuses and a safe fallback', async () => {
    const user = userEvent.setup();
    loadBacklogGraphMock.mockResolvedValue(GRAPH_FIXTURE);

    render(<BacklogGraphPage />);

    await screen.findByRole('heading', { name: 'Dependency Neighborhood' });

    let selectedSection = screen.getByRole('heading', { name: 'Selected' }).closest('section') as HTMLElement;
    const shippedCard = within(selectedSection).getByText('Backlog Runtime Boundary').closest('article');
    expect(shippedCard).toHaveClass('backlog-node-card--status-shipped');
    expect(shippedCard).toHaveClass('backlog-node-card--selected');

    await user.selectOptions(screen.getByLabelText('Backlog item'), 'BL-057');
    selectedSection = screen.getByRole('heading', { name: 'Selected' }).closest('section') as HTMLElement;
    const inboxCard = within(selectedSection).getByText('Graph Focus Controls').closest('article');
    expect(inboxCard).toHaveClass('backlog-node-card--status-inbox');

    await user.selectOptions(screen.getByLabelText('Backlog item'), 'BL-058');
    selectedSection = screen.getByRole('heading', { name: 'Selected' }).closest('section') as HTMLElement;
    const inProgressCard = within(selectedSection).getByText('Status Color Nodes').closest('article');
    expect(inProgressCard).toHaveClass('backlog-node-card--status-in-progress');

    await user.selectOptions(screen.getByLabelText('Backlog item'), 'BL-998');
    selectedSection = screen.getByRole('heading', { name: 'Selected' }).closest('section') as HTMLElement;
    const fallbackCard = within(selectedSection).getByText('Unknown Status Item').closest('article');
    expect(fallbackCard).toHaveClass('backlog-node-card--status-unknown');
  });
});
