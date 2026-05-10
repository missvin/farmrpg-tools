import { describe, expect, it } from 'vitest';

import { createDefaultDropRateAcquisitionSettings } from './dropRateAcquisitionSettings';
import {
  convertDropRateUnit,
  getDropRateUnitBasis,
  getPreferredDropRateUnit,
  normalizeDropRateSourceType,
} from './dropRateUnitConversions';

describe('dropRateUnitConversions', () => {
  it('normalizes source types and resolves preferred units from saved settings', () => {
    const settings = createDefaultDropRateAcquisitionSettings();

    expect(normalizeDropRateSourceType('Exploring')).toBe('explore');
    expect(normalizeDropRateSourceType('fish')).toBe('fishing');
    expect(normalizeDropRateSourceType('seed')).toBe('farming');
    expect(normalizeDropRateSourceType('quests')).toBeNull();
    expect(getPreferredDropRateUnit('explore', settings)).toBe('arnold_palmers');
    expect(getPreferredDropRateUnit('fishing', settings)).toBe('large_nets');
    expect(getPreferredDropRateUnit('farming', settings)).toBe('crops');
  });

  it('uses Buddy-matching Apple Cider and AP unit sizes for explore conversions', () => {
    const settings = createDefaultDropRateAcquisitionSettings();
    const ciderBasis = getDropRateUnitBasis('explore', 'apple_ciders', settings, 0.25);
    const apBasis = getDropRateUnitBasis('explore', 'arnold_palmers', settings, 0.25);

    expect(ciderBasis?.sourceQuantity).toBe(500);
    expect(apBasis?.sourceQuantity).toBe(500);

    settings.perks.cinnamonSticksActive = false;
    settings.perks.lemonSqueezerActive = false;

    expect(getDropRateUnitBasis('explore', 'apple_ciders', settings, 0.25)?.sourceQuantity).toBe(400);
    expect(getDropRateUnitBasis('explore', 'arnold_palmers', settings, 0.25)?.sourceQuantity).toBe(200);
  });

  it('converts directional explore rates without hiding the rate meaning', () => {
    const settings = createDefaultDropRateAcquisitionSettings();

    expect(
      convertDropRateUnit({
        rate: 2,
        sourceType: 'explore',
        fromUnit: 'arnold_palmers',
        toUnit: 'apple_ciders',
        direction: 'units_per_item',
        settings,
        baseDropRate: 0.4,
      }),
    ).toMatchObject({
      calculable: true,
      rate: 2,
    });

    expect(
      convertDropRateUnit({
        rate: 2,
        sourceType: 'explore',
        fromUnit: 'arnold_palmers',
        toUnit: 'lemonades',
        direction: 'units_per_item',
        settings,
        baseDropRate: 0.4,
      }),
    ).toMatchObject({
      calculable: true,
      rate: 50,
    });
  });

  it('applies Wanderer to stamina and Orange Juice explore units', () => {
    const settings = createDefaultDropRateAcquisitionSettings();
    settings.perks.wandererPercent = 50;

    expect(getDropRateUnitBasis('explore', 'stamina', settings, 0.5)?.sourceQuantity).toBe(1);
    expect(getDropRateUnitBasis('explore', 'orange_juices', settings, 0.5)?.sourceQuantity).toBe(100);

    expect(
      convertDropRateUnit({
        rate: 1000,
        sourceType: 'explore',
        fromUnit: 'explores',
        toUnit: 'stamina',
        direction: 'units_per_item',
        settings,
        baseDropRate: 0.5,
      }).rate,
    ).toBe(500);
  });

  it('converts fishing rates across fish, regular nets, and large nets', () => {
    const settings = createDefaultDropRateAcquisitionSettings();

    expect(getDropRateUnitBasis('fishing', 'fishing_nets', settings)?.sourceQuantity).toBe(10);
    expect(getDropRateUnitBasis('fishing', 'large_nets', settings)?.sourceQuantity).toBe(500);

    expect(
      convertDropRateUnit({
        rate: 500,
        sourceType: 'fishing',
        fromUnit: 'fish',
        toUnit: 'large_nets',
        direction: 'units_per_item',
        settings,
      }).rate,
    ).toBe(1);

    settings.perks.fishingTrawlActive = false;
    expect(getDropRateUnitBasis('fishing', 'large_nets', settings)?.sourceQuantity).toBe(400);

    settings.perks.reinforcedNettingActive = false;
    expect(getDropRateUnitBasis('fishing', 'large_nets', settings)?.sourceQuantity).toBe(250);
  });

  it('keeps seed and harvest-all conversion Buddy-matching until crop-row modeling exists', () => {
    const settings = createDefaultDropRateAcquisitionSettings();

    expect(
      convertDropRateUnit({
        rate: 2,
        sourceType: 'farming',
        fromUnit: 'crops',
        toUnit: 'harvest_alls',
        direction: 'items_per_unit',
        settings,
      }),
    ).toMatchObject({
      calculable: true,
      rate: 80,
    });

    expect(
      convertDropRateUnit({
        rate: 40,
        sourceType: 'farming',
        fromUnit: 'crops',
        toUnit: 'harvest_alls',
        direction: 'units_per_item',
        settings,
      }),
    ).toMatchObject({
      calculable: true,
      rate: 1,
    });
  });

  it('returns a blocker for mismatched unit families', () => {
    const settings = createDefaultDropRateAcquisitionSettings();

    expect(
      convertDropRateUnit({
        rate: 1,
        sourceType: 'fishing',
        fromUnit: 'arnold_palmers',
        toUnit: 'large_nets',
        direction: 'units_per_item',
        settings,
      }),
    ).toMatchObject({
      calculable: false,
      blockerReason: 'Drop-rate units do not match the source type.',
    });
  });
});
