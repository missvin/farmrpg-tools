import { lazy, type ReactElement } from 'react';

import { DashboardPage } from '../pages/DashboardPage';
import { ImportPage } from '../pages/ImportPage';
import { ImportInventoryPage } from '../pages/ImportInventoryPage';
import { ImportPetItemsPage } from '../pages/ImportPetItemsPage';
import { LocksmithImportPage } from '../pages/LocksmithImportPage';

const ImportHelpPage = lazy(() =>
  import('../pages/ImportHelpPage').then((module) => ({ default: module.ImportHelpPage })),
);
const BacklogGraphPage = lazy(() =>
  import('../pages/BacklogGraphPage').then((module) => ({ default: module.BacklogGraphPage })),
);
const AcquisitionBreakdownPage = lazy(() =>
  import('../pages/AcquisitionBreakdownPage').then((module) => ({ default: module.AcquisitionBreakdownPage })),
);
const ComparePage = lazy(() => import('../pages/ComparePage').then((module) => ({ default: module.ComparePage })));
const CraftMaterialMatrixPage = lazy(() =>
  import('../pages/CraftMaterialMatrixPage').then((module) => ({ default: module.CraftMaterialMatrixPage })),
);
const HistoryPage = lazy(() => import('../pages/HistoryPage').then((module) => ({ default: module.HistoryPage })));
const IngredientDemandListPage = lazy(() =>
  import('../pages/IngredientDemandListPage').then((module) => ({ default: module.IngredientDemandListPage })),
);
const IngredientDemandPage = lazy(() =>
  import('../pages/IngredientDemandPage').then((module) => ({ default: module.IngredientDemandPage })),
);
const ItemProfilePage = lazy(() =>
  import('../pages/ItemProfilePage').then((module) => ({ default: module.ItemProfilePage })),
);
const LargeNetPlannerPage = lazy(() =>
  import('../pages/LargeNetPlannerPage').then((module) => ({ default: module.LargeNetPlannerPage })),
);
const MasteryGoalsPage = lazy(() =>
  import('../pages/MasteryGoalsPage').then((module) => ({ default: module.MasteryGoalsPage })),
);
const MemoryHelperPage = lazy(() =>
  import('../pages/MemoryHelperPage').then((module) => ({ default: module.MemoryHelperPage })),
);
const MuseumCompletionPage = lazy(() =>
  import('../pages/MuseumCompletionPage').then((module) => ({ default: module.MuseumCompletionPage })),
);
const MuseumToolsPage = lazy(() =>
  import('../pages/MuseumToolsPage').then((module) => ({ default: module.MuseumToolsPage })),
);
const QuestPlannerPage = lazy(() =>
  import('../pages/QuestPlannerPage').then((module) => ({ default: module.QuestPlannerPage })),
);
const RatingSourceWorkbenchPage = lazy(() =>
  import('../pages/RatingSourceWorkbenchPage').then((module) => ({ default: module.RatingSourceWorkbenchPage })),
);
const QuestHistoryPage = lazy(() =>
  import('../pages/QuestHistoryPage').then((module) => ({ default: module.QuestHistoryPage })),
);
const SettingsPage = lazy(() => import('../pages/SettingsPage').then((module) => ({ default: module.SettingsPage })));
const SortedPage = lazy(() => import('../pages/SortedPage').then((module) => ({ default: module.SortedPage })));
const TargetOutputPlannerPage = lazy(() =>
  import('../pages/TargetOutputPlannerPage').then((module) => ({ default: module.TargetOutputPlannerPage })),
);
const TowerPage = lazy(() => import('../pages/TowerPage').then((module) => ({ default: module.TowerPage })));
const TowerProgressPage = lazy(() =>
  import('../pages/TowerProgressPage').then((module) => ({ default: module.TowerProgressPage })),
);
const TowerReferenceMaintenancePage = lazy(() =>
  import('../pages/TowerReferenceMaintenancePage').then((module) => ({
    default: module.TowerReferenceMaintenancePage,
  })),
);
const UnknownItemReviewPage = lazy(() =>
  import('../pages/UnknownItemReviewPage').then((module) => ({ default: module.UnknownItemReviewPage })),
);

type AppRoute = {
  path: string;
  label: string;
  element: ReactElement;
};

type NavigationSection = {
  title: string;
  items: {
    to: string;
    label: string;
  }[];
};

export const appRoutes: AppRoute[] = [
  {
    path: '/',
    label: 'Dashboard',
    element: <DashboardPage />,
  },
  {
    path: '/import',
    label: 'Import Mastery',
    element: <ImportPage />,
  },
  {
    path: '/import-inventory',
    label: 'Import Inventory',
    element: <ImportInventoryPage />,
  },
  {
    path: '/import-pet-items',
    label: 'Import Pet Items',
    element: <ImportPetItemsPage />,
  },
  {
    path: '/import-locksmith',
    label: 'Locksmith Import',
    element: <LocksmithImportPage />,
  },
  {
    path: '/import-help',
    label: 'Import Help',
    element: <ImportHelpPage />,
  },
  {
    path: '/quest-history',
    label: 'Quest History',
    element: <QuestHistoryPage />,
  },
  {
    path: '/museum-tools',
    label: 'Museum Tools',
    element: <MuseumToolsPage />,
  },
  {
    path: '/backlog-graph',
    label: 'Backlog Graph',
    element: <BacklogGraphPage />,
  },
  {
    path: '/ingredient-demand',
    label: 'Ingredient Lookup',
    element: <IngredientDemandPage />,
  },
  {
    path: '/ingredient-demand-list',
    label: 'Material Planner',
    element: <IngredientDemandListPage />,
  },
  {
    path: '/craft-material-matrix',
    label: 'Craft Material Matrix',
    element: <CraftMaterialMatrixPage />,
  },
  {
    path: '/items/:canonicalKey',
    label: 'Item Profile',
    element: <ItemProfilePage />,
  },
  {
    path: '/mastery-goals',
    label: 'Mastery Goals',
    element: <MasteryGoalsPage />,
  },
  {
    path: '/memory-helper',
    label: "Borgen's Lost and Found",
    element: <MemoryHelperPage />,
  },
  {
    path: '/quest-planner',
    label: 'Quest Planner',
    element: <QuestPlannerPage />,
  },
  {
    path: '/target-planner',
    label: 'Target Planner',
    element: <TargetOutputPlannerPage />,
  },
  {
    path: '/large-net-planner',
    label: 'Large Net Planner',
    element: <LargeNetPlannerPage />,
  },
  {
    path: '/museum-completion',
    label: 'Museum Completion',
    element: <MuseumCompletionPage />,
  },
  {
    path: '/acquisition-breakdown',
    label: 'Acquisition Breakdown',
    element: <AcquisitionBreakdownPage />,
  },
  {
    path: '/sorted',
    label: 'Sorted',
    element: <SortedPage />,
  },
  {
    path: '/tower',
    label: 'Tower',
    element: <TowerPage />,
  },
  {
    path: '/tower-progress',
    label: 'Tower Items by Difficulty',
    element: <TowerProgressPage />,
  },
  {
    path: '/tower-reference-maintenance',
    label: 'Tower Reference Maintenance',
    element: <TowerReferenceMaintenancePage />,
  },
  {
    path: '/rating-source-workbench',
    label: 'Rating Source Workbench',
    element: <RatingSourceWorkbenchPage />,
  },
  {
    path: '/unknown-items',
    label: 'Unknown Item Review',
    element: <UnknownItemReviewPage />,
  },
  {
    path: '/history',
    label: 'History',
    element: <HistoryPage />,
  },
  {
    path: '/compare',
    label: 'Compare',
    element: <ComparePage />,
  },
  {
    path: '/settings',
    label: 'Settings',
    element: <SettingsPage />,
  },
];

export const navigationSections: NavigationSection[] = [
  {
    title: 'Plan',
    items: [
      { to: '/', label: 'Dashboard' },
      { to: '/ingredient-demand', label: 'Ingredient Lookup' },
      { to: '/ingredient-demand-list', label: 'Material Planner' },
      { to: '/craft-material-matrix', label: 'Craft Material Matrix' },
      { to: '/mastery-goals', label: 'Mastery Goals' },
      { to: '/quest-planner', label: 'Quest Planner' },
      { to: '/target-planner', label: 'Target Planner' },
      { to: '/large-net-planner', label: 'Large Net Planner' },
      { to: '/acquisition-breakdown', label: 'Acquisition Breakdown' },
    ],
  },
  {
    title: 'Import',
    items: [
      { to: '/import', label: 'Import Mastery' },
      { to: '/import-inventory', label: 'Import Inventory' },
      { to: '/import-pet-items', label: 'Import Pet Items' },
      { to: '/import-locksmith', label: 'Locksmith Import' },
      { to: '/quest-history', label: 'Quest History' },
    ],
  },
  {
    title: 'Progress',
    items: [
      { to: '/tower-progress', label: 'Tower Items by Difficulty' },
      { to: '/sorted', label: 'Sorted' },
      { to: '/tower', label: 'Tower' },
    ],
  },
  {
    title: 'Other',
    items: [
      { to: '/memory-helper', label: "Borgen's Lost and Found" },
      { to: '/museum-completion', label: 'Museum Completion' },
    ],
  },
  {
    title: 'Data',
    items: [
      { to: '/history', label: 'History' },
      { to: '/compare', label: 'Compare' },
      { to: '/settings', label: 'Settings' },
    ],
  },
  {
    title: 'Dev Tools',
    items: [
      { to: '/museum-tools', label: 'Museum Tools' },
      { to: '/tower-reference-maintenance', label: 'Tower Reference Maintenance' },
      { to: '/rating-source-workbench', label: 'Rating Source Workbench' },
      { to: '/unknown-items', label: 'Unknown Item Review' },
      { to: '/backlog-graph', label: 'Backlog Graph' },
    ],
  },
];
