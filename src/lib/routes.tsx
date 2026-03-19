import type { ReactElement } from 'react';

import { BacklogGraphPage } from '../pages/BacklogGraphPage';
import { ComparePage } from '../pages/ComparePage';
import { DashboardPage } from '../pages/DashboardPage';
import { HistoryPage } from '../pages/HistoryPage';
import { IngredientDemandPage } from '../pages/IngredientDemandPage';
import { ImportPage } from '../pages/ImportPage';
import { MuseumToolsPage } from '../pages/MuseumToolsPage';
import { SettingsPage } from '../pages/SettingsPage';
import { SortedPage } from '../pages/SortedPage';
import { TowerPage } from '../pages/TowerPage';
import { TowerProgressPage } from '../pages/TowerProgressPage';

type AppRoute = {
  path: string;
  label: string;
  element: ReactElement;
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

export const navigationItems = appRoutes.map(({ path, label }) => ({
  to: path,
  label,
}));
