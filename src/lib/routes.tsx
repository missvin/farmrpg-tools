import { lazy, type ReactElement } from 'react';

import { DashboardPage } from '../pages/DashboardPage';
import { ImportPage } from '../pages/ImportPage';
import { ImportInventoryPage } from '../pages/ImportInventoryPage';
import { ImportPetItemsPage } from '../pages/ImportPetItemsPage';
import { LocksmithImportPage } from '../pages/LocksmithImportPage';
import { getRouteToolMetadata, type RouteToolId, type RouteToolMetadata } from './routeMetadata';

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
const ItemsLandingPage = lazy(() =>
  import('../pages/ItemsLandingPage').then((module) => ({ default: module.ItemsLandingPage })),
);
const ItemProfilePage = lazy(() =>
  import('../pages/ItemProfilePage').then((module) => ({ default: module.ItemProfilePage })),
);
const LargeNetPlannerPage = lazy(() =>
  import('../pages/LargeNetPlannerPage').then((module) => ({ default: module.LargeNetPlannerPage })),
);
const GoalsOverviewPage = lazy(() =>
  import('../pages/GoalsOverviewPage').then((module) => ({ default: module.GoalsOverviewPage })),
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

type AppRoute = RouteToolMetadata & {
  element: ReactElement;
};

type NavigationSection = {
  title: string;
  items: {
    routeId: RouteToolId;
    to: string;
    label: string;
  }[];
};

function appRoute(routeId: RouteToolId, element: ReactElement): AppRoute {
  return {
    ...getRouteToolMetadata(routeId),
    element,
  };
}

function navigationItem(routeId: RouteToolId): NavigationSection['items'][number] {
  const metadata = getRouteToolMetadata(routeId);

  return {
    routeId,
    to: metadata.path,
    label: metadata.label,
  };
}

export const appRoutes: AppRoute[] = [
  appRoute('home', <DashboardPage />),
  appRoute('importMastery', <ImportPage />),
  appRoute('importInventory', <ImportInventoryPage />),
  appRoute('importPetItems', <ImportPetItemsPage />),
  appRoute('importLocksmith', <LocksmithImportPage />),
  appRoute('importHelp', <ImportHelpPage />),
  appRoute('questHistory', <QuestHistoryPage />),
  appRoute('museumTools', <MuseumToolsPage />),
  appRoute('backlogGraph', <BacklogGraphPage />),
  appRoute('ingredientLookup', <IngredientDemandPage />),
  appRoute('materialPlanner', <IngredientDemandListPage />),
  appRoute('craftMaterialMatrix', <CraftMaterialMatrixPage />),
  appRoute('itemsLanding', <ItemsLandingPage />),
  appRoute('itemProfile', <ItemProfilePage />),
  appRoute('goalsOverview', <GoalsOverviewPage />),
  appRoute('masteryGoals', <MasteryGoalsPage />),
  appRoute('borgenHelper', <MemoryHelperPage />),
  appRoute('questPlanner', <QuestPlannerPage />),
  appRoute('targetPlanner', <TargetOutputPlannerPage />),
  appRoute('largeNetPlanner', <LargeNetPlannerPage />),
  appRoute('museumCompletion', <MuseumCompletionPage />),
  appRoute('acquisitionBreakdown', <AcquisitionBreakdownPage />),
  appRoute('sorted', <SortedPage />),
  appRoute('tower', <TowerPage />),
  appRoute('towerProgress', <TowerProgressPage />),
  appRoute('towerReferenceMaintenance', <TowerReferenceMaintenancePage />),
  appRoute('ratingSourceWorkbench', <RatingSourceWorkbenchPage />),
  appRoute('unknownItemReview', <UnknownItemReviewPage />),
  appRoute('history', <HistoryPage />),
  appRoute('compare', <ComparePage />),
  appRoute('settings', <SettingsPage />),
];

export const appRouteCompatibilityRedirects = appRoutes.flatMap((route) =>
  route.compatibilityPaths.map((path) => ({
    path,
    to: route.path,
  })),
);

export const navigationSections: NavigationSection[] = [
  {
    title: 'Home',
    items: [navigationItem('home')],
  },
  {
    title: 'Goals',
    items: [
      navigationItem('goalsOverview'),
      navigationItem('masteryGoals'),
      navigationItem('tower'),
      navigationItem('towerProgress'),
      navigationItem('questPlanner'),
      navigationItem('museumCompletion'),
      navigationItem('borgenHelper'),
      navigationItem('sorted'),
    ],
  },
  {
    title: 'Items',
    items: [navigationItem('itemsLanding'), navigationItem('ingredientLookup'), navigationItem('acquisitionBreakdown')],
  },
  {
    title: 'Planning',
    items: [
      navigationItem('materialPlanner'),
      navigationItem('craftMaterialMatrix'),
      navigationItem('targetPlanner'),
      navigationItem('largeNetPlanner'),
    ],
  },
  {
    title: 'Data',
    items: [
      navigationItem('importMastery'),
      navigationItem('importInventory'),
      navigationItem('importPetItems'),
      navigationItem('importLocksmith'),
      navigationItem('questHistory'),
      navigationItem('history'),
      navigationItem('compare'),
      navigationItem('settings'),
      navigationItem('importHelp'),
    ],
  },
  {
    title: 'Advanced',
    items: [
      navigationItem('museumTools'),
      navigationItem('towerReferenceMaintenance'),
      navigationItem('ratingSourceWorkbench'),
      navigationItem('unknownItemReview'),
      navigationItem('backlogGraph'),
    ],
  },
];
