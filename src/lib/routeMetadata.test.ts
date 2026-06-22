import { describe, expect, it } from 'vitest';

import { appRoutes, navigationSections } from './routes';
import { routeToolMetadata } from './routeMetadata';

describe('routeToolMetadata', () => {
  it('defines stable metadata for every rendered app route', () => {
    const routeIds = new Set(appRoutes.map((route) => route.id));
    const metadataIds = new Set(routeToolMetadata.map((metadata) => metadata.id));

    expect(routeIds).toEqual(metadataIds);
    expect(routeToolMetadata).toHaveLength(appRoutes.length);
  });

  it('keeps route metadata complete enough for IA and search consumers', () => {
    for (const metadata of routeToolMetadata) {
      expect(metadata.path).toMatch(/^\//);
      expect(metadata.label.trim()).not.toBe('');
      expect(metadata.description.trim()).not.toBe('');
      expect(metadata.aliases.length).toBeGreaterThan(0);
      expect(metadata.dataRequirements).not.toContain('planning/backlog.csv');
    }
  });

  it('marks advanced tools separately from normal user-facing routes', () => {
    const advancedRouteIds = routeToolMetadata
      .filter((metadata) => metadata.visibility === 'advanced')
      .map((metadata) => metadata.id);

    expect(advancedRouteIds).toEqual([
      'museumTools',
      'backlogGraph',
      'towerReferenceMaintenance',
      'ratingSourceWorkbench',
      'unknownItemReview',
    ]);
  });

  it('continues deriving navigation item labels and paths from route metadata', () => {
    const allNavigationItems = navigationSections.flatMap((section) => section.items);
    const routeById = new Map(routeToolMetadata.map((metadata) => [metadata.id, metadata]));

    for (const item of allNavigationItems) {
      const metadata = routeById.get(item.routeId);

      expect(metadata).toBeDefined();
      expect(item.to).toBe(metadata?.path);
      expect(item.label).toBe(metadata?.label);
    }
  });
});
