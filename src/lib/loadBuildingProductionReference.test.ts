import { describe, expect, it } from 'vitest';

import {
  buildBuildingProductionReferenceData,
  parseBuildingProductConversionsCsv,
  parseBuildingProductionReferenceCsv,
} from './loadBuildingProductionReference';

const PRODUCTION_CSV = `production_key,building_name,output_item_name,output_canonical_key,input_item_name,input_canonical_key,input_quantity,output_quantity,processing_minutes,perk_group,evidence,notes
sugar_cane_mill_unrefined_sugar,Sugar Cane Mill,Unrefined Sugar,unrefined sugar,Sugar Cane,sugar cane,7,1,1,sugar_cane_mill,user_confirmed,Base row
sugar_cane_mill_unrefined_sugar,Sugar Cane Mill,Unrefined Sugar,unrefined sugar,Machine Press,machine press,1,1,1,sugar_cane_mill,user_confirmed,Base row
`;

const CONVERSION_CSV = `conversion_key,building_output_item_name,building_output_canonical_key,final_item_name,final_canonical_key,building_output_quantity,final_output_quantity,secondary_input_item_name,secondary_input_canonical_key,secondary_input_quantity,evidence,notes
sugar_cane_mill_molasses,Unrefined Sugar,unrefined sugar,Molasses,molasses,3,1,Glass Jar,glass jar,1,user_confirmed,Instant conversion
`;

describe('loadBuildingProductionReference', () => {
  it('parses and indexes grouped building production rows', () => {
    const data = buildBuildingProductionReferenceData({
      productions: parseBuildingProductionReferenceCsv(PRODUCTION_CSV),
      conversions: parseBuildingProductConversionsCsv(CONVERSION_CSV),
    });

    expect(data.byOutputCanonicalKey['unrefined sugar'][0]).toMatchObject({
      buildingName: 'Sugar Cane Mill',
      outputQuantity: 1,
      processingMinutes: 1,
      inputs: [
        { itemName: 'Sugar Cane', quantity: 7 },
        { itemName: 'Machine Press', quantity: 1 },
      ],
    });
    expect(data.conversionsByFinalCanonicalKey.molasses[0]).toMatchObject({
      buildingOutputCanonicalKey: 'unrefined sugar',
      finalItemName: 'Molasses',
      buildingOutputQuantity: 3,
      secondaryInputs: [{ itemName: 'Glass Jar', quantity: 1 }],
    });
  });

  it('rejects canonical key mismatches', () => {
    expect(() =>
      parseBuildingProductionReferenceCsv(PRODUCTION_CSV.replace('sugar cane,7', 'sugarcane,7')),
    ).toThrow('Canonical key mismatch');
  });
});
