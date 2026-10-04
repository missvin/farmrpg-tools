import { loadDropRateReference, type DropRateReferenceEntry } from './loadDropRateReference';
import { loadOpenableContentsReference, type OpenableContentsReferenceEntry } from './loadOpenableContentsReference';
import { loadPetSourceReference, type PetSourceReferenceEntry } from './loadPetSourceReference';
import { loadQuestReference, type QuestItemSourceHintEntry } from './loadQuestReference';
import { loadRecipeGraph, type RecipeNode } from './loadRecipeGraph';

export type MuseumAcquisitionReferences = {
  drops: Record<string, Pick<DropRateReferenceEntry, 'sourceName' | 'sourceType'>[]>;
  pets: Record<string, Pick<PetSourceReferenceEntry, 'petName' | 'unlockLevel' | 'petAvailability'>[]>;
  openables: Record<string, Pick<OpenableContentsReferenceEntry, 'openableItemName' | 'quantityKind'>[]>;
  hints: Record<string, Pick<QuestItemSourceHintEntry, 'sourceName' | 'sourceType'>[]>;
  recipes: Record<string, Pick<RecipeNode, 'recipeType'>>;
  incomplete: boolean;
};

export function deriveMuseumAcquisitionSources(key: string, references: MuseumAcquisitionReferences): string[] {
  const sources: string[] = [];
  const recipe = references.recipes[key];
  if (recipe) sources.push(recipe.recipeType === 'cooking' ? 'Cooking' : 'Crafting');
  for (const drop of references.drops[key] ?? []) sources.push(`${drop.sourceType}: ${drop.sourceName}`);
  for (const pet of references.pets[key] ?? []) {
    sources.push(`Pet: ${pet.petName} (level ${pet.unlockLevel}${pet.petAvailability === 'seasonal' ? ', seasonal' : ''})`);
  }
  for (const openable of references.openables[key] ?? []) {
    sources.push(`Open: ${openable.openableItemName}${openable.quantityKind === 'expected' ? ' (random contents)' : ''}`);
  }
  for (const hint of references.hints[key] ?? []) sources.push(`${hint.sourceType}: ${hint.sourceName}`);
  const seen = new Set<string>();
  return sources.filter((source) => {
    const identity = source.toLowerCase();
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

export async function loadMuseumAcquisitionReferences(): Promise<MuseumAcquisitionReferences> {
  const [drops, pets, openables, hints, recipes] = await Promise.allSettled([
    loadDropRateReference(), loadPetSourceReference(), loadOpenableContentsReference(),
    loadQuestReference(), loadRecipeGraph(),
  ]);
  return {
    drops: drops.status === 'fulfilled' ? drops.value.byTargetCanonicalKey : {},
    pets: pets.status === 'fulfilled' ? pets.value.byItemCanonicalKey : {},
    openables: openables.status === 'fulfilled' ? openables.value.byContentCanonicalKey : {},
    hints: hints.status === 'fulfilled' ? hints.value.sourceHintsByCanonicalKey : {},
    recipes: recipes.status === 'fulfilled' ? recipes.value.byOutputCanonicalKey : {},
    incomplete: [drops, pets, openables, hints, recipes].some((result) => result.status === 'rejected'),
  };
}
