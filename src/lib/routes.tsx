import type { ReactElement } from 'react';

import { ComparePage } from '../pages/ComparePage';
import { DashboardPage } from '../pages/DashboardPage';
import { HistoryPage } from '../pages/HistoryPage';
import { ImportPage } from '../pages/ImportPage';
import { SettingsPage } from '../pages/SettingsPage';
import { SortedPage } from '../pages/SortedPage';

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
    path: '/sorted',
    label: 'Sorted',
    element: <SortedPage />,
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
