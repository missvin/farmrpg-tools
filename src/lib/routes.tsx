import { lazy, type ReactElement } from 'react';

import { DashboardPage } from '../pages/DashboardPage';
import { ImportPage } from '../pages/ImportPage';

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
const MasteryGoalsPage = lazy(() =>
  import('../pages/MasteryGoalsPage').then((module) => ({ default: module.MasteryGoalsPage })),
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
const SettingsPage = lazy(() => import('../pages/SettingsPage').then((module) => ({ default: module.SettingsPage })));
const SortedPage = lazy(() => import('../pages/SortedPage').then((module) => ({ default: module.SortedPage })));
const TowerPage = lazy(() => import('../pages/TowerPage').then((module) => ({ default: module.TowerPage })));
const TowerProgressPage = lazy(() =>
  import('../pages/TowerProgressPage').then((module) => ({ default: module.TowerProgressPage })),
);
const TowerReferenceMaintenancePage = lazy(() =>
  import('../pages/TowerReferenceMaintenancePage').then((module) => ({
    default: module.TowerReferenceMaintenancePage,
  })),
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
    label: 'Import',
    element: <ImportPage />,
  },
  {
    path: '/import-help',
    label: 'Import Help',
    element: <ImportHelpPage />,
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
    path: '/quest-planner',
    label: 'Quest Planner',
    element: <QuestPlannerPage />,
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
    label: 'Tower Progress',
    element: <TowerProgressPage />,
  },
  {
    path: '/tower-reference-maintenance',
    label: 'Tower Reference Maintenance',
    element: <TowerReferenceMaintenancePage />,
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
      { to: '/mastery-goals', label: 'Mastery Goals' },
      { to: '/quest-planner', label: 'Quest Planner' },
      { to: '/acquisition-breakdown', label: 'Acquisition Breakdown' },
    ],
  },
  {
    title: 'Progress',
    items: [
      { to: '/tower-progress', label: 'Tower Progress' },
      { to: '/museum-completion', label: 'Museum Completion' },
      { to: '/sorted', label: 'Sorted' },
      { to: '/tower', label: 'Tower' },
    ],
  },
  {
    title: 'Data',
    items: [
      { to: '/import', label: 'Import' },
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
      { to: '/backlog-graph', label: 'Backlog Graph' },
    ],
  },
];
