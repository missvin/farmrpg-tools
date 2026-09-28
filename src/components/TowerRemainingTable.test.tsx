import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useNavigate, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { TowerRemainingTable } from './TowerRemainingTable';
import { deriveTowerRemainingRows, sortTowerRemainingRows } from '../lib/towerRemainingRows';
import type { TowerRequirementEntry } from '../lib/loadTowerRequirements';
import type { MasterySnapshot } from '../lib/storage/masterySnapshots';
import type { RecipeGraph, RecipeNode } from '../lib/loadRecipeGraph';
import { CRAFTING_MODIFIER_STATE_STORAGE_KEY, createDefaultCraftingModifierState, saveCraftingModifierState } from '../lib/craftingModifierState';

const snapshot: MasterySnapshot = {
  snapshotId: 'tower-test', createdAt: '2026-09-28', rawText: '',
  masteryByItem: { 'propeller hat': 82_000, board: 110_000 },
  parseSummary: {
    itemsParsed: 2, parsedRowsCount: 2, tiersDetected: [], duplicateRowsCount: 0,
    skippedNonItemLinesCount: 0, skippedNonItemLineSamples: [], unknownItemsCount: 0, warnings: [],
  },
};
function requirement(towerLevel: number, itemName: string, masteryLevelNeeded: 'GM' | 'MM'): TowerRequirementEntry {
  return { towerLevel, itemName, masteryLevelNeeded, canonicalKey: itemName.toLowerCase(),
    towerLevelRange: '301-350', slotIndex: 1, farmrpgItemId: null, buddySlug: null,
    notes: null, sourceSheet: null, sourceRow: null };
}
const requirements = { entries: [
  requirement(340, 'Propeller Hat', 'MM'), requirement(301, 'Propeller Hat', 'GM'),
  requirement(302, 'Board', 'GM'), requirement(303, 'Gold Flier', 'GM'),
], byCanonicalKey: {} };
const rows = deriveTowerRemainingRows(snapshot, requirements, null);
const recipes = Object.entries({ 'propeller hat': ['Steel', 'Red Dye'], 'gold flier': ['Twine'], steel: ['Iron'] }).map(([key, inputs]): RecipeNode => ({
  outputCanonicalKey: key, outputItemName: key, recipeType: 'craft', recipeBookItemName: null, recipeBookCanonicalKey: null,
  cookingLevel: null, baseTime: null, sourceBuddyUrl: '', inputs: inputs.map((itemName, inputOrder) => ({ itemName, canonicalKey: itemName.toLowerCase(), inputOrder, quantity: 1 })),
}));
const graph: RecipeGraph = { recipes, byOutputCanonicalKey: Object.fromEntries(recipes.map((r) => [r.outputCanonicalKey, r])), byInputCanonicalKey: {}, craftRecipes: recipes, cookingRecipes: [] };
function NavigationProbe() {
  const navigate = useNavigate();
  const location = useLocation();
  return <><button onClick={() => navigate(-1)}>Back</button><output aria-label="Current URL">{location.search}</output></>;
}

describe('Tower remaining requirements', () => {
  it('collapses material controls and optionally shows row-target amounts beside linked icons', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><TowerRemainingTable rows={rows} targetItem={null} targetLevel={null} recipeGraph={graph} /></MemoryRouter>);
    const panel = document.querySelector<HTMLDetailsElement>('.tower-material-panel')!;
    expect(panel).toHaveAttribute('open');
    const gmRow = within(screen.getByRole('table')).getByRole('row', { name: /301 Propeller Hat/ });
    const materialCell = within(gmRow).getAllByRole('cell')[5];
    expect(within(materialCell).getByRole('link', { name: 'Steel' })).toHaveAttribute('href', '/items/steel');
    expect(materialCell.querySelector('.tower-material-quantity')).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Show material amounts inline' }));
    expect(materialCell.querySelector('.tower-material-quantity')).toHaveTextContent('18,000');
    expect(within(materialCell).getByRole('link', { name: 'Steel' })).toHaveAttribute('href', '/items/steel');
    const mmCell = within(screen.getByRole('row', { name: /340 Propeller Hat/ })).getAllByRole('cell')[5];
    expect(mmCell.querySelector('.tower-material-quantity')).toHaveTextContent('918,000');
    const unknownCell = within(screen.getByRole('row', { name: /303 Gold Flier/ })).getAllByRole('cell')[5];
    expect(unknownCell.querySelector('.tower-material-quantity')).toHaveTextContent('Unavailable');
    await user.click(screen.getByRole('checkbox', { name: 'Filter by Steel', exact: true }));
    expect(panel.querySelector('summary')).toHaveTextContent('1 selected · Any');
    await user.click(panel.querySelector('summary')!);
    expect(panel).not.toHaveAttribute('open');
    expect(materialCell.querySelector('.tower-material-quantity')).toHaveTextContent('18,000');
    await user.click(panel.querySelector('summary')!);
    expect(panel).toHaveAttribute('open');
    await user.click(screen.getByRole('checkbox', { name: 'Show material amounts inline' }));
    expect(materialCell.querySelector('.tower-material-quantity')).not.toBeInTheDocument();
  });

  it('shows independent saved Steel and Steel Wire hours on icons and inline amounts', async () => {
    const previous = localStorage.getItem('farmrpg-tools.towerProductionRates.v1');
    const user = userEvent.setup();
    const wire = { ...recipes[2], outputCanonicalKey: 'steel wire', outputItemName: 'Steel Wire',
      inputs: ['Iron', 'Stone', 'Carbon Sphere'].map((itemName, inputOrder) => ({
        itemName, canonicalKey: itemName.toLowerCase(), inputOrder, quantity: 1,
      })) };
    const hat = { ...recipes[0], inputs: [...recipes[0].inputs, {
      itemName: 'Steel Wire', canonicalKey: 'steel wire', inputOrder: 2, quantity: 1,
    }] };
    const wireRecipes = [hat, ...recipes, wire].filter((recipe, index) => index !== 1);
    const wireGraph = { ...graph, recipes: wireRecipes, craftRecipes: wireRecipes,
      byOutputCanonicalKey: Object.fromEntries(wireRecipes.map((recipe) => [recipe.outputCanonicalKey, recipe])) };
    try {
      localStorage.removeItem('farmrpg-tools.towerProductionRates.v1');
      const view = render(<MemoryRouter><TowerRemainingTable rows={rows} targetItem={null} targetLevel={null} recipeGraph={wireGraph} /></MemoryRouter>);
      await user.click(screen.getByText(/Assumptions · Resource Saver/));
      await user.type(screen.getByLabelText('Steel per hour'), '500');
      await user.type(screen.getByLabelText('Steel Wire per hour'), '3000');
      await user.click(screen.getByRole('button', { name: 'Save production rates' }));
      expect(screen.getByRole('status')).toHaveTextContent('Hourly rates saved');
      const gm = within(screen.getByRole('table')).getByRole('row', { name: /301 Propeller Hat/ });
      const steel = within(gm).getByRole('link', { name: 'Steel', exact: true });
      const steelWire = within(gm).getByRole('link', { name: 'Steel Wire', exact: true });
      await user.hover(steel);
      expect(screen.getByRole('tooltip')).toHaveTextContent('1d 12h at 500/hour');
      await user.unhover(steel);
      await user.hover(steelWire);
      expect(screen.getByRole('tooltip')).toHaveTextContent('6 hours at 3,000/hour');
      expect(steelWire).toHaveAttribute('href', '/items/steel%20wire');
      await user.click(screen.getByRole('checkbox', { name: 'Show material amounts inline' }));
      const materialCell = within(gm).getAllByRole('cell')[5];
      expect(materialCell).toHaveTextContent('18,000 · 1d 12h');
      expect(materialCell).toHaveTextContent('18,000 · 6h');
      view.unmount();
      expect(JSON.parse(localStorage.getItem('farmrpg-tools.towerProductionRates.v1')!)).toMatchObject({
        steelPerHour: 500, steelWirePerHour: 3000,
      });
    } finally {
      if (previous === null) localStorage.removeItem('farmrpg-tools.towerProductionRates.v1');
      else localStorage.setItem('farmrpg-tools.towerProductionRates.v1', previous);
    }
  });

  it('uses the row tier in a compact material tooltip', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><TowerRemainingTable rows={rows} targetItem={null} targetLevel={null} recipeGraph={graph} /></MemoryRouter>);
    await user.hover(within(screen.getByRole('table')).getAllByRole('link', { name: 'Steel', exact: true })[1]);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Steel: 918,000 remaining for this MM');
    expect(screen.getByRole('tooltip')).not.toHaveTextContent('Crafting total with saved modifiers');
  });
  it('uses saved recipe policy for material icons and filtering, including explicit opt-in', async () => {
    const user = userEvent.setup();
    const policyRecipes = [
      { ...recipes[0], outputCanonicalKey: 'veggie juice', outputItemName: 'Veggie Juice', inputs: [{ canonicalKey: 'unpolished shimmer stone', itemName: 'Unpolished Shimmer Stone', inputOrder: 1, quantity: 4 }] },
      { ...recipes[0], outputCanonicalKey: 'unpolished shimmer stone', outputItemName: 'Unpolished Shimmer Stone', inputs: [{ canonicalKey: 'emberstone', itemName: 'Emberstone', inputOrder: 1, quantity: 1 }] },
    ];
    const policyGraph = { ...graph, recipes: policyRecipes, craftRecipes: policyRecipes, byOutputCanonicalKey: Object.fromEntries(policyRecipes.map((r) => [r.outputCanonicalKey, r])) };
    const policyRows = deriveTowerRemainingRows({ ...snapshot, masteryByItem: { 'veggie juice': 67813 } }, { entries: [requirement(308, 'Veggie Juice', 'GM')], byCanonicalKey: {} }, null);
    const previous = localStorage.getItem(CRAFTING_MODIFIER_STATE_STORAGE_KEY);
    const state = createDefaultCraftingModifierState();
    try {
      saveCraftingModifierState(state);
      const view = render(<MemoryRouter><TowerRemainingTable rows={policyRows} targetItem={null} targetLevel={null} recipeGraph={policyGraph} /></MemoryRouter>);
      expect(within(screen.getByRole('table')).queryByRole('link', { name: 'Emberstone' })).not.toBeInTheDocument();
      await user.click(screen.getByRole('checkbox', { name: 'Filter by Emberstone' }));
      expect(screen.getByText(/No requirements match/)).toBeInTheDocument();
      view.unmount();
      state.planning.includeExcludedRecipes = true;
      saveCraftingModifierState(state);
      render(<MemoryRouter initialEntries={['/tower-progress?material=emberstone']}><TowerRemainingTable rows={policyRows} targetItem={null} targetLevel={null} recipeGraph={policyGraph} /></MemoryRouter>);
      expect(within(screen.getByRole('table')).getByRole('link', { name: 'Veggie Juice' })).toBeInTheDocument();
      await user.hover(within(screen.getByRole('table')).getByRole('link', { name: 'Emberstone' }));
      expect(screen.getByRole('tooltip')).toHaveTextContent('128,748 remaining for this GM');
    } finally {
      if (previous === null) localStorage.removeItem(CRAFTING_MODIFIER_STATE_STORAGE_KEY);
      else localStorage.setItem(CRAFTING_MODIFIER_STATE_STORAGE_KEY, previous);
    }
  });
  it('shows row-specific material details, later targets beyond cutoff, and linked saved assumptions', async () => {
    const user = userEvent.setup();
    const cutoffRows = deriveTowerRemainingRows(snapshot, requirements, 303);
    render(<MemoryRouter><TowerRemainingTable rows={cutoffRows} targetItem={null} targetLevel={null} recipeGraph={graph} /></MemoryRouter>);
    expect(screen.getByText('GM*')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Propeller Hat T301 later requirement' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('MM at T340 (beyond this cutoff)');
    await user.keyboard('{Escape}');
    const icon = within(screen.getByRole('table')).getByRole('link', { name: 'Steel', exact: true });
    expect(screen.queryByRole('button', { name: /Steel needed for/ })).not.toBeInTheDocument();
    await user.hover(icon);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Steel: 18,000 remaining for this GM');
    expect(screen.getByRole('tooltip')).not.toHaveTextContent('mastery remaining');
    fireEvent.scroll(window);
    expect(screen.getByRole('tooltip')).toHaveTextContent('18,000 remaining for this GM');
    expect(icon).toHaveAttribute('href', '/items/steel');
    expect(icon).toHaveAttribute('aria-describedby');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    await user.unhover(icon);
    act(() => icon.focus());
    expect(icon).toHaveFocus();
    expect(screen.getByRole('tooltip')).toHaveTextContent('18,000 remaining for this GM');
    await user.click(screen.getByText(/Assumptions · Resource Saver/));
    expect(screen.getByRole('link', { name: 'Edit crafting assumptions' })).toHaveAttribute('href', '/ingredient-demand#ingredient-demand-controls-title');
    expect(screen.getByRole('link', { name: 'Fishing settings' })).toHaveAttribute('href', '/settings#settings-drop-rate-title');
  });
  it('filters Any/All, limits row icons, sorts materials, and restores URL selections through back and Clear', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/tower-progress?through=350']}><NavigationProbe /><TowerRemainingTable rows={rows} targetItem={null} targetLevel={null} recipeGraph={graph} /></MemoryRouter>);
    const bodyRows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(bodyRows()).toHaveLength(3);
    expect(screen.queryByRole('checkbox', { name: 'Filter by Fishing Net' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Key materials' }));
    expect(bodyRows().map((row) => within(row).getAllByRole('cell')[0].textContent)).toEqual(['301', '340', '303']);
    await user.click(screen.getByRole('button', { name: 'Key materials' }));
    expect(within(bodyRows()[0]).getByText('303')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Filter by Steel', exact: true }));
    expect(bodyRows()).toHaveLength(2);
    expect(within(bodyRows()[0]).queryByRole('link', { name: 'Red Dye' })).not.toBeInTheDocument();
    expect(within(bodyRows()[0]).getByRole('link', { name: 'Steel' })).toHaveAttribute('href', '/items/steel');
    await user.click(screen.getByRole('checkbox', { name: 'Filter by Twine' }));
    expect(bodyRows()).toHaveLength(3);
    await user.click(screen.getByRole('radio', { name: 'All' }));
    expect(screen.getByText(/No requirements match/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(bodyRows()).toHaveLength(3);
    expect(screen.getByLabelText('Current URL')).toHaveTextContent('through=350');
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByLabelText('Current URL')).toHaveTextContent('?through=350');
    expect(screen.getByRole('checkbox', { name: 'Filter by Steel', exact: true })).not.toBeChecked();
  });

  it('supports dye group overrides and Fishing Net only through searchable Other materials', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><TowerRemainingTable rows={rows} targetItem={null} targetLevel={null} recipeGraph={graph} /></MemoryRouter>);
    const dyeChip = screen.getByRole('checkbox', { name: 'Dyes', exact: true }).closest('label')!;
    expect(dyeChip.querySelectorAll('.tower-dye-stack img')).toHaveLength(3);
    await user.click(dyeChip);
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(3);
    await user.click(screen.getByText('Dye colors', { selector: 'summary' }));
    await user.click(screen.getByRole('checkbox', { name: 'Filter by Red Dye' }));
    expect(screen.getByRole('checkbox', { name: 'Dyes', exact: true })).toBePartiallyChecked();
    expect(screen.getByText(/No requirements match/)).toBeInTheDocument();
    await user.click(screen.getByText('Other materials', { selector: 'summary' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search materials' }), 'fishing net');
    expect(screen.getByRole('checkbox', { name: 'Filter by Fishing Net' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Filter by Fishing Net' }).closest('label')).toHaveTextContent('Fishing Net');
  });

  it('restores deep-linked material selection and retains linked text for an ingredient without an icon', () => {
    const missingRecipe = { ...recipes[0], inputs: [{ itemName: 'Test Material', canonicalKey: 'test material', inputOrder: 0, quantity: 1 }] };
    const missingGraph = { ...graph, recipes: [missingRecipe], byOutputCanonicalKey: { 'propeller hat': missingRecipe } };
    render(<MemoryRouter initialEntries={['/tower-progress?material=test+material&materialMatch=all']}><TowerRemainingTable rows={rows} targetItem={null} targetLevel={null} recipeGraph={missingGraph} /></MemoryRouter>);
    expect(screen.getByRole('radio', { name: 'All' })).toBeChecked();
    const links = within(screen.getByRole('table')).getAllByRole('link', { name: 'Test Material' });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveTextContent('Test Material');
    expect(links[0]).toHaveAttribute('href', '/items/test%20material');
  });
  it('keeps row targets independent, including completed rows and unknown PJ baselines', () => {
    const gm = rows.find((row) => row.towerLevel === 301)!;
    const mm = rows.find((row) => row.towerLevel === 340)!;
    expect(gm.remainingToRequirement).toBe(18_000);
    expect(mm.remainingToRequirement).toBe(918_000);
    expect(gm.pumpkinJuices).toBe(3);
    expect(mm.pumpkinJuices).toBeGreaterThan(gm.pumpkinJuices!);
    expect(rows.find((row) => row.towerLevel === 302)?.pumpkinJuices).toBe(0);
    expect(rows.find((row) => row.towerLevel === 303)?.pumpkinJuices).toBeNull();
    expect(deriveTowerRemainingRows(snapshot, requirements, 302).map((row) => row.towerLevel)).toEqual([301, 302]);
    for (const descending of [true, false]) {
      expect(sortTowerRemainingRows(rows, 'pj', descending).at(-1)?.towerLevel).toBe(303);
    }
    expect(sortTowerRemainingRows(rows, 'tier', false).at(-1)?.masteryLevelNeeded).toBe('MM');
    expect(sortTowerRemainingRows(rows, 'item', false)[0].itemName).toBe('Board');
  });

  it('defaults to incomplete level order and supports sorting, icons, and accessible mastery details', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><TowerRemainingTable rows={rows} targetItem={null} targetLevel={null} /></MemoryRouter>);
    expect(screen.getByRole('checkbox', { name: 'Incomplete only' })).toBeChecked();
    expect(screen.queryByRole('link', { name: 'Board' })).not.toBeInTheDocument();
    const tableRows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(tableRows().map((row) => within(row).getAllByRole('cell')[0].textContent)).toEqual(['301', '303', '340']);
    expect(screen.getAllByRole('link', { name: 'Propeller Hat' })[0]).toHaveAttribute('href', '/items/propeller%20hat');
    const detailButton = screen.getByRole('button', { name: 'Propeller Hat T301 GM mastery details' });
    expect(detailButton.closest('td')).toHaveStyle('--tower-percent-fill: 82%');
    await user.click(detailButton);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Current 82,000 · Target 100,000 · Remaining 18,000 · Complete 82.0%');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remaining' }));
    expect(within(tableRows()[0]).getByText('301')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remaining' }));
    expect(within(tableRows()[0]).getByText('340')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Remaining' })).toHaveAttribute('aria-sort', 'descending');
    await user.click(screen.getByRole('checkbox', { name: 'Incomplete only' }));
    expect(screen.getByRole('link', { name: 'Board' })).toBeInTheDocument();
  });

  it('reveals and scrolls to an explicitly linked completed requirement', async () => {
    const scroll = vi.fn();
    const original = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scroll;
    try {
      render(<MemoryRouter><TowerRemainingTable rows={rows} targetItem="board" targetLevel={302} /></MemoryRouter>);
      expect(screen.getByRole('link', { name: 'Board' })).toBeInTheDocument();
      expect(screen.getByText(/Linked completed requirement included/)).toBeInTheDocument();
      await vi.waitFor(() => expect(scroll).toHaveBeenCalled());
    } finally { HTMLElement.prototype.scrollIntoView = original; }
  });
});
