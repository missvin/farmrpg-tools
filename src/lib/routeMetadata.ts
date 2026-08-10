export type RouteToolId =
  | 'home'
  | 'dataCenter'
  | 'importMastery'
  | 'importInventory'
  | 'importPetItems'
  | 'importLocksmith'
  | 'importHelp'
  | 'questHistory'
  | 'museumTools'
  | 'backlogGraph'
  | 'ingredientLookup'
  | 'materialPlanner'
  | 'craftMaterialMatrix'
  | 'itemsLanding'
  | 'itemProfile'
  | 'goalsOverview'
  | 'masteryGoals'
  | 'borgenHelper'
  | 'questPlanner'
  | 'targetPlanner'
  | 'largeNetPlanner'
  | 'museumCompletion'
  | 'acquisitionBreakdown'
  | 'sorted'
  | 'tower'
  | 'towerProgress'
  | 't300RaceStory'
  | 'towerReferenceMaintenance'
  | 'ratingSourceWorkbench'
  | 'unknownItemReview'
  | 'history'
  | 'compare'
  | 'settings';

export type RouteIaGroup = 'home' | 'goals' | 'items' | 'planning' | 'data' | 'advanced';

export type RouteVisibility = 'user-facing' | 'advanced';

export type LocalDataRequirement =
  | 'mastery-snapshot'
  | 'inventory-import'
  | 'pet-inventory'
  | 'locksmith-import'
  | 'quest-history'
  | 'backup-file'
  | 'planning-assumptions'
  | 'reference-data';

export type RouteToolMetadata = {
  id: RouteToolId;
  path: string;
  label: string;
  description: string;
  aliases: string[];
  iaGroup: RouteIaGroup;
  visibility: RouteVisibility;
  dataRequirements: LocalDataRequirement[];
  compatibilityPaths: string[];
  searchable?: boolean;
};

export const routeToolMetadata: RouteToolMetadata[] = [
  {
    id: 'home',
    path: '/',
    label: 'Dashboard',
    description: 'Home summary for local progress, planning status, and next useful actions.',
    aliases: ['home', 'start', 'overview', 'command center'],
    iaGroup: 'home',
    visibility: 'user-facing',
    dataRequirements: [],
    compatibilityPaths: ['/home'],
  },
  {
    id: 'dataCenter',
    path: '/data',
    label: 'Data',
    description: 'Manage local imports, backup and restore, snapshot history, comparisons, and app settings.',
    aliases: ['data center', 'import center', 'backup', 'restore', 'local data', 'imports', 'data status', 'export'],
    iaGroup: 'data',
    visibility: 'user-facing',
    dataRequirements: [],
    compatibilityPaths: ['/data/imports'],
  },
  {
    id: 'importMastery',
    path: '/import',
    label: 'Import Mastery',
    description: 'Paste and save the FarmRPG mastery export as the local progress snapshot.',
    aliases: ['mastery import', 'paste mastery', 'snapshot import', 'missing data', 'start import'],
    iaGroup: 'data',
    visibility: 'user-facing',
    dataRequirements: [],
    compatibilityPaths: ['/data/import/mastery'],
  },
  {
    id: 'importInventory',
    path: '/import-inventory',
    label: 'Import Inventory',
    description: 'Import current inventory so planners can account for owned materials.',
    aliases: ['inventory', 'owned items', 'stockpile'],
    iaGroup: 'data',
    visibility: 'user-facing',
    dataRequirements: [],
    compatibilityPaths: ['/data/import/inventory'],
  },
  {
    id: 'importPetItems',
    path: '/import-pet-items',
    label: 'Import Pet Items',
    description: 'Import stored pet inventory for local source and planning calculations.',
    aliases: ['pet inventory', 'stored pets', 'pets'],
    iaGroup: 'data',
    visibility: 'user-facing',
    dataRequirements: [],
    compatibilityPaths: ['/data/import/pets'],
  },
  {
    id: 'importLocksmith',
    path: '/import-locksmith',
    label: 'Locksmith Import',
    description: 'Import Locksmith inventory for local planning and availability checks.',
    aliases: ['locksmith', 'locksmith inventory'],
    iaGroup: 'data',
    visibility: 'user-facing',
    dataRequirements: [],
    compatibilityPaths: ['/data/import/locksmith'],
  },
  {
    id: 'importHelp',
    path: '/import-help',
    label: 'Import Help',
    description: 'Help for mastery paste imports, restore expectations, and trusted local data.',
    aliases: ['help', 'getting started', 'restore help', 'import guide'],
    iaGroup: 'data',
    visibility: 'user-facing',
    dataRequirements: [],
    compatibilityPaths: ['/data/import/help'],
  },
  {
    id: 'questHistory',
    path: '/quest-history',
    label: 'Quest History',
    description: 'Import and review completed quest history for future-demand planning.',
    aliases: ['completed quests', 'quest import', 'quest progress'],
    iaGroup: 'data',
    visibility: 'user-facing',
    dataRequirements: ['quest-history'],
    compatibilityPaths: ['/data/quest-history'],
  },
  {
    id: 'museumTools',
    path: '/museum-tools',
    label: 'Museum Reference Tools',
    description: 'Advanced maintenance workflow for museum reference coverage and review exports.',
    aliases: ['museum tools', 'museum maintenance', 'museum reference', 'museum import'],
    iaGroup: 'advanced',
    visibility: 'advanced',
    dataRequirements: ['reference-data'],
    compatibilityPaths: ['/advanced/museum-tools'],
  },
  {
    id: 'backlogGraph',
    path: '/backlog-graph',
    label: 'Internal Backlog Graph',
    description: 'Advanced internal planning graph for local backlog visualization.',
    aliases: ['backlog graph', 'backlog', 'planning graph', 'project graph'],
    iaGroup: 'advanced',
    visibility: 'advanced',
    dataRequirements: [],
    compatibilityPaths: ['/advanced/backlog-graph'],
  },
  {
    id: 'ingredientLookup',
    path: '/ingredient-demand',
    label: 'Ingredient Lookup',
    description: 'Look up recursive ingredient demand for a selected craft target.',
    aliases: ['ingredients', 'materials', 'crafting lookup'],
    iaGroup: 'items',
    visibility: 'user-facing',
    dataRequirements: ['reference-data', 'planning-assumptions'],
    compatibilityPaths: ['/planning/material-lookup'],
  },
  {
    id: 'materialPlanner',
    path: '/ingredient-demand-list',
    label: 'Material Planner',
    description: 'Plan material demand across recipe-driven target items.',
    aliases: ['materials', 'ingredient list', 'craft materials'],
    iaGroup: 'planning',
    visibility: 'user-facing',
    dataRequirements: ['reference-data', 'planning-assumptions'],
    compatibilityPaths: ['/planning/materials'],
  },
  {
    id: 'craftMaterialMatrix',
    path: '/craft-material-matrix',
    label: 'Craft Material Matrix',
    description: 'Compare craft-material families and recipe pressure across outputs.',
    aliases: ['craft matrix', 'material matrix', 'crafting matrix'],
    iaGroup: 'planning',
    visibility: 'user-facing',
    dataRequirements: ['reference-data', 'planning-assumptions'],
    compatibilityPaths: ['/planning/craft-matrix'],
  },
  {
    id: 'itemsLanding',
    path: '/items',
    label: 'Items',
    description: 'Find local item profiles and open item workbench pages.',
    aliases: ['items', 'item search', 'item catalog', 'item workbench', 'find item', 'open item'],
    iaGroup: 'items',
    visibility: 'user-facing',
    dataRequirements: ['reference-data'],
    compatibilityPaths: ['/items/search'],
  },
  {
    id: 'itemProfile',
    path: '/items/:canonicalKey',
    label: 'Item Profile',
    description: 'Item workbench for sources, uses, mastery status, goals, and planning actions.',
    aliases: ['item', 'item page', 'item workbench', 'item profile'],
    iaGroup: 'items',
    visibility: 'user-facing',
    dataRequirements: ['reference-data'],
    compatibilityPaths: [],
  },
  {
    id: 'goalsOverview',
    path: '/goals',
    label: 'Goals',
    description: 'Overview of Tower mastery, mastery targets, quests, museum, Borgen, and custom target goal sources.',
    aliases: ['goals overview', 'goal sources', 'goal hub', 'goal planning'],
    iaGroup: 'goals',
    visibility: 'user-facing',
    dataRequirements: ['mastery-snapshot', 'quest-history', 'reference-data'],
    compatibilityPaths: ['/goals/overview'],
  },
  {
    id: 'masteryGoals',
    path: '/mastery-goals',
    label: 'Mastery Goals',
    description: 'Plan personal mastery targets and acceleration opportunities.',
    aliases: ['goals', 'mastery', 'gm', 'mm', 'mastery targets', 'add goal', 'view goals'],
    iaGroup: 'goals',
    visibility: 'user-facing',
    dataRequirements: ['mastery-snapshot', 'reference-data'],
    compatibilityPaths: ['/goals/mastery'],
  },
  {
    id: 'borgenHelper',
    path: '/memory-helper',
    label: "Borgen's Lost and Found",
    description: "Plan Borgen's Lost and Found memory items from local item data.",
    aliases: ['borgen', 'lost and found', 'memory helper'],
    iaGroup: 'goals',
    visibility: 'user-facing',
    dataRequirements: ['reference-data'],
    compatibilityPaths: ['/goals/borgen'],
  },
  {
    id: 'questPlanner',
    path: '/quest-planner',
    label: 'Quest Planner',
    description: 'Plan questline requirements, future demand, and source burden.',
    aliases: ['quests', 'quest goals', 'questline'],
    iaGroup: 'goals',
    visibility: 'user-facing',
    dataRequirements: ['quest-history', 'reference-data', 'planning-assumptions'],
    compatibilityPaths: ['/goals/quests'],
  },
  {
    id: 'targetPlanner',
    path: '/target-planner',
    label: 'Target Planner',
    description: 'Plan one or more output targets against a shared local supply pool.',
    aliases: ['targets', 'target output', 'planner', 'craft target', 'output planner', 'plan output'],
    iaGroup: 'planning',
    visibility: 'user-facing',
    dataRequirements: ['inventory-import', 'pet-inventory', 'reference-data', 'planning-assumptions'],
    compatibilityPaths: ['/planning/targets'],
  },
  {
    id: 'largeNetPlanner',
    path: '/large-net-planner',
    label: 'Large Net Planner',
    description: 'Plan Large Net production and supporting material needs.',
    aliases: ['large nets', 'nets', 'ln'],
    iaGroup: 'planning',
    visibility: 'user-facing',
    dataRequirements: ['inventory-import', 'reference-data', 'planning-assumptions'],
    compatibilityPaths: ['/planning/large-nets'],
  },
  {
    id: 'museumCompletion',
    path: '/museum-completion',
    label: 'Museum Completion',
    description: 'Track museum completion gaps from local reviewed museum data.',
    aliases: ['museum', 'museum goals', 'museum progress'],
    iaGroup: 'goals',
    visibility: 'user-facing',
    dataRequirements: ['reference-data'],
    compatibilityPaths: ['/goals/museum'],
  },
  {
    id: 'acquisitionBreakdown',
    path: '/acquisition-breakdown',
    label: 'Acquisition Breakdown',
    description: 'Review practical acquisition sources and provenance for an item.',
    aliases: ['acquisition', 'sources', 'source breakdown'],
    iaGroup: 'items',
    visibility: 'user-facing',
    dataRequirements: ['reference-data', 'planning-assumptions'],
    compatibilityPaths: ['/planning/sources'],
  },
  {
    id: 'sorted',
    path: '/sorted',
    label: 'Sorted',
    description: 'Sorted mastery and progress list for local snapshot review.',
    aliases: ['sort', 'progress list', 'mastery list'],
    iaGroup: 'goals',
    visibility: 'user-facing',
    dataRequirements: ['mastery-snapshot', 'reference-data'],
    compatibilityPaths: ['/goals/progress'],
  },
  {
    id: 'tower',
    path: '/tower',
    label: 'Tower',
    description: 'Tower mastery requirements and progression from local requirement data.',
    aliases: ['tower requirements', 'tower goals', 'tower mastery'],
    iaGroup: 'goals',
    visibility: 'user-facing',
    dataRequirements: ['mastery-snapshot', 'reference-data'],
    compatibilityPaths: ['/goals/tower'],
  },
  {
    id: 'towerProgress',
    path: '/tower-progress',
    label: 'Tower Items by Difficulty',
    description: 'Tower mastery progress grouped by item difficulty and requirement pressure.',
    aliases: ['tower progress', 'tower difficulty', 'pj', 'pumpkin juice'],
    iaGroup: 'goals',
    visibility: 'user-facing',
    dataRequirements: ['mastery-snapshot', 'reference-data'],
    compatibilityPaths: ['/goals/tower-progress'],
  },
  {
    id: 't300RaceStory',
    path: '/stories/race-to-t300',
    label: 'The Race to T300',
    description: '@blackberry’s public data story covering 169 Tower MM requirements and the final T300 race.',
    aliases: ['race to t300', 't300 story', 'tower race'],
    iaGroup: 'goals',
    visibility: 'user-facing',
    dataRequirements: ['reference-data'],
    compatibilityPaths: [],
    searchable: false,
  },
  {
    id: 'towerReferenceMaintenance',
    path: '/tower-reference-maintenance',
    label: 'Tower Reference Review',
    description: 'Advanced review surface for maintaining Tower requirement coverage.',
    aliases: ['tower reference maintenance', 'tower maintenance', 'tower reference', 'tower data'],
    iaGroup: 'advanced',
    visibility: 'advanced',
    dataRequirements: ['reference-data'],
    compatibilityPaths: ['/advanced/tower-reference-maintenance'],
  },
  {
    id: 'ratingSourceWorkbench',
    path: '/rating-source-workbench',
    label: 'Rating Source Review',
    description: 'Advanced workbench for reviewing item rating source coverage.',
    aliases: ['rating source workbench', 'rating source', 'ratings', 'source workbench'],
    iaGroup: 'advanced',
    visibility: 'advanced',
    dataRequirements: ['reference-data'],
    compatibilityPaths: ['/advanced/rating-source-workbench'],
  },
  {
    id: 'unknownItemReview',
    path: '/unknown-items',
    label: 'Unknown Item Review',
    description: 'Advanced review surface for unresolved local item recognition gaps.',
    aliases: ['unknown items', 'unmatched items', 'item review'],
    iaGroup: 'advanced',
    visibility: 'advanced',
    dataRequirements: ['reference-data'],
    compatibilityPaths: ['/advanced/unknown-items'],
  },
  {
    id: 'history',
    path: '/history',
    label: 'History',
    description: 'Review locally saved snapshot history and progress over time.',
    aliases: ['snapshots', 'snapshot history', 'progress history'],
    iaGroup: 'data',
    visibility: 'user-facing',
    dataRequirements: ['mastery-snapshot'],
    compatibilityPaths: ['/data/history'],
  },
  {
    id: 'compare',
    path: '/compare',
    label: 'Compare',
    description: 'Compare two local snapshots to understand progress changes.',
    aliases: ['snapshot compare', 'compare snapshots', 'progress compare', 'diff', 'changes'],
    iaGroup: 'data',
    visibility: 'user-facing',
    dataRequirements: ['mastery-snapshot'],
    compatibilityPaths: ['/data/compare'],
  },
  {
    id: 'settings',
    path: '/settings',
    label: 'Settings',
    description: 'Manage local app settings, backup export, and restore.',
    aliases: ['backup', 'restore', 'export', 'preferences', 'local backup', 'app backup'],
    iaGroup: 'data',
    visibility: 'user-facing',
    dataRequirements: ['backup-file'],
    compatibilityPaths: ['/data/settings'],
  },
];

export const routeToolMetadataById = new Map<RouteToolId, RouteToolMetadata>(
  routeToolMetadata.map((metadata) => [metadata.id, metadata]),
);

export function getRouteToolMetadata(id: RouteToolId): RouteToolMetadata {
  const metadata = routeToolMetadataById.get(id);

  if (!metadata) {
    throw new Error(`Unknown route metadata id: ${id}`);
  }

  return metadata;
}
