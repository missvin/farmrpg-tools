import type { CraftMaterialMatrixRow } from './craftMaterialMatrix';

export const CRAFT_MATERIAL_MATRIX_FAMILIES = [
  { id: 'dye', label: 'Dyes' },
  { id: 'twine', label: 'Twines' },
  { id: 'shirt', label: 'Shirts' },
  { id: 'scarf', label: 'Scarves' },
  { id: 'purse', label: 'Purses' },
  { id: 'butterfly', label: 'Butterflies' },
  { id: 'bag', label: 'Bags' },
  { id: 'cloak', label: 'Cloaks' },
  { id: 'other_dye_uses', label: 'Other Dye Uses' },
  { id: 'colored_twine_uses', label: 'Colored Twine Uses' },
  { id: 'other_raw_color_uses', label: 'Other Raw-Color Uses' },
  { id: 'other_uses', label: 'Other Uses' },
] as const;

export type CraftMaterialMatrixFamilyId = (typeof CRAFT_MATERIAL_MATRIX_FAMILIES)[number]['id'];

export type CraftMaterialMatrixFamily = {
  id: CraftMaterialMatrixFamilyId;
  label: string;
};

const FAMILY_BY_ID = new Map<CraftMaterialMatrixFamilyId, CraftMaterialMatrixFamily>(
  CRAFT_MATERIAL_MATRIX_FAMILIES.map((family) => [family.id, family]),
);

const OUTPUT_NAME_FAMILY_PATTERNS: Array<{
  id: CraftMaterialMatrixFamilyId;
  pattern: RegExp;
}> = [
  { id: 'dye', pattern: /\bdye$/i },
  { id: 'twine', pattern: /\btwine$/i },
  { id: 'shirt', pattern: /\bshirt$/i },
  { id: 'scarf', pattern: /\bscarf$/i },
  { id: 'purse', pattern: /\bpurse$/i },
  { id: 'butterfly', pattern: /\bbutterfly$/i },
  { id: 'bag', pattern: /\bbag$/i },
  { id: 'cloak', pattern: /\bcloak$/i },
];

const EXPLICIT_OUTPUT_FAMILIES = new Map<string, CraftMaterialMatrixFamilyId>([
  ['black cloak', 'cloak'],
]);

const COLOR_NAMES = new Set(['black', 'blue', 'brown', 'green', 'orange', 'purple', 'red', 'white', 'yellow']);

function familyById(id: CraftMaterialMatrixFamilyId): CraftMaterialMatrixFamily {
  const family = FAMILY_BY_ID.get(id);

  if (!family) {
    throw new Error(`Unknown craft material matrix family "${id}".`);
  }

  return family;
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

function isDyeName(name: string): boolean {
  return /\bdye$/i.test(name.trim());
}

function isColoredTwineName(name: string): boolean {
  const normalized = normalizeName(name);
  const [firstWord, secondWord] = normalized.split(' ');
  return secondWord === 'twine' && COLOR_NAMES.has(firstWord ?? '');
}

function isRawColorName(name: string): boolean {
  return COLOR_NAMES.has(normalizeName(name));
}

function getPathInputNames(row: CraftMaterialMatrixRow): string[] {
  return [
    row.seedItemName,
    row.matchedInput.itemName,
    ...row.path.map((step) => step.inputItemName),
    ...row.outputRecipe.inputs.map((input) => input.itemName),
  ];
}

export function classifyCraftMaterialMatrixRow(row: CraftMaterialMatrixRow): CraftMaterialMatrixFamily {
  const outputName = normalizeName(row.outputItemName);
  const explicitFamily = EXPLICIT_OUTPUT_FAMILIES.get(outputName);

  if (explicitFamily) {
    return familyById(explicitFamily);
  }

  const outputPatternFamily = OUTPUT_NAME_FAMILY_PATTERNS.find((family) => family.pattern.test(row.outputItemName));

  if (outputPatternFamily) {
    return familyById(outputPatternFamily.id);
  }

  const inputNames = getPathInputNames(row);

  if (inputNames.some(isDyeName)) {
    return familyById('other_dye_uses');
  }

  if (inputNames.some(isColoredTwineName)) {
    return familyById('colored_twine_uses');
  }

  if (inputNames.some(isRawColorName)) {
    return familyById('other_raw_color_uses');
  }

  return familyById('other_uses');
}
