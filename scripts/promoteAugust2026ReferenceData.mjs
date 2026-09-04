import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const AUGUST_ITEMS = [
  'Highland Hollow Charm', 'Spring Cave Charm', "Fenrir's Den Charm", 'Ember Caverns Charm',
  'Sol Grotto Charm', 'Mining Bag 01', 'Mining Bag 02', 'Mining Bag 03', 'Mining Bag 04',
  'Mining Bag 05', 'Mining Bag 06', "Cid's Spare Pickaxe", 'Heavy Pickaxe', 'Green Gel',
  'Unpolished Peridot', 'Ancient Rune', 'Condensed Gravicite', 'Mossy Bone', 'Ruined Ether Drill',
  'Calmine Statue', 'Gravity Orb', 'Peridot', 'Fossilized Viper', 'Ancient Bird Fossil',
  'Mossrock Mine Charm', 'Plum Iron', 'Mossroom', 'Ocean Stone', 'Refined Plum Ore',
  'Ancient Ram Fossil', 'Mossy Cog', 'Gravicite', 'Ruined Ether Hammer', 'Calmine Composite',
  'Refined Esperium', 'Veinshard', 'Bright Lantern', 'Quench', 'Ornate Anvil', 'Joyful Ring',
  'Sunstone Ring', 'Fairy Ring', 'Embershard Ring', 'Aquacite Ring', 'Ornate Flarite Ring',
  'Deep Ocean Ring', 'Flarite Ring', 'Green Halite Ring', 'Esperium Band', 'Green Halite Earrings',
  'Shining Earrings', 'Calmine Lotion', 'Potion of Clarity', 'Acid Extract', 'Tin Goblet',
  'Plum Goblet', 'Horn Powder', 'Sparkle Dust', 'Garnet Walking Stick', 'Reforged Sword',
  'Embershard Staff', 'Chisel', 'Ancient Pickaxe', 'Strong Wire', 'Pestle and Mortar',
  'Cave Paste', 'Pinecone Bird Feeder', 'Redbrook Patch', 'Stained Glass Art', "Cid's Minecart 01",
  'Detonator', 'Cid Buddy Doll',
];

const AUGUST_QUESTLINES = [
  'Cloistered Cluster', 'A Better Juice', 'Daily Dairy', 'Fun Underground Now', 'Dig In',
  'Delving Into Charms', 'Sprung Forth', 'Power Play',
];

const CATALOG_COLUMNS = [
  'item_name', 'canonical_key', 'mastery_possible', 'farmrpg_item_id', 'buddy_slug',
  'source_datasets', 'notes',
];
const QUEST_COLUMNS = [
  'quest_key', 'quest_name', 'questline_key', 'questline_name', 'questline_aliases', 'stage_label',
  'npc', 'farming_level', 'fishing_level', 'crafting_level', 'exploring_level', 'tower_level',
  'previous_quest_key', 'next_quest_keys', 'source_url', 'coverage_status', 'notes',
];
const QUEST_ITEM_COLUMNS = [
  'quest_key', 'requirement_type', 'item_name', 'canonical_key', 'quantity', 'source_url', 'notes',
];
const QUEST_REWARD_COLUMNS = [
  'quest_key', 'reward_type', 'item_name', 'canonical_key', 'quantity', 'source_url', 'notes',
];
const STAGED_RECIPE_COLUMNS = [
  'output_item_name', 'output_canonical_key', 'displayed_craft_quantity', 'input_item_name',
  'input_canonical_key', 'displayed_required_quantity', 'per_craft_quantity', 'evidence_source',
  'evidence_date', 'review_status', 'notes',
];
const RECIPE_COLUMNS = [
  'output_item_name', 'output_canonical_key', 'recipe_type', 'recipe_book_item_name',
  'recipe_book_canonical_key', 'cooking_level', 'base_time', 'source_buddy_url',
  'source_page_data_url', 'cache_file_name', 'parser_version', 'notes',
];
const RECIPE_INPUT_COLUMNS = [
  'output_canonical_key', 'output_item_name', 'input_order', 'input_item_name',
  'input_canonical_key', 'quantity', 'source_buddy_url', 'source_page_data_url',
  'cache_file_name', 'parser_version', 'notes',
];

function normalizeKey(value) {
  return String(value ?? '')
    .replace(/[\u2018\u2019\u201a\u201b\u2032]/gu, "'")
    .replace(/[\u201c\u201d\u201e\u201f\u2033]/gu, '"')
    .toLowerCase()
    .trim()
    .replace(/\s+/gu, ' ');
}

function parseCsvRow(line) {
  const values = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      values.push(value);
      value = '';
    } else {
      value += character;
    }
  }
  values.push(value);
  return values;
}

function parseCsv(text, columns, label) {
  const lines = text.split(/\r?\n/u).filter(Boolean);
  if (lines.length === 0 || parseCsvRow(lines[0]).join('|') !== columns.join('|')) {
    throw new Error(`${label} has an unexpected schema.`);
  }
  return lines.slice(1).map((line) => {
    const values = parseCsvRow(line);
    if (values.length !== columns.length) throw new Error(`${label} has a malformed row.`);
    return Object.fromEntries(columns.map((column, index) => [column, values[index]]));
  });
}

function escapeCsv(value) {
  const text = String(value ?? '');
  return /[",\r\n]/u.test(text) ? `"${text.replace(/"/gu, '""')}"` : text;
}

function serializeRow(columns, row) {
  return columns.map((column) => escapeCsv(row[column])).join(',');
}

function appendRows(text, columns, rows) {
  const base = text.replace(/\s*$/u, '');
  return rows.length === 0 ? `${base}\n` : `${base}\n${rows.map((row) => serializeRow(columns, row)).join('\n')}\n`;
}

function replaceCatalogRows(text, updates) {
  const byKey = new Map(updates.map((row) => [row.canonical_key, row]));
  const seen = new Set();
  const lines = text.replace(/\s*$/u, '').split(/\r?\n/u);
  const updatedLines = lines.map((line, index) => {
    if (index === 0) return line;
    const key = parseCsvRow(line)[1];
    const replacement = byKey.get(key);
    if (!replacement) return line;
    seen.add(key);
    return serializeRow(CATALOG_COLUMNS, replacement);
  });
  if (seen.size !== byKey.size) throw new Error('Could not find every catalog row selected for update.');
  return `${updatedLines.join('\n')}\n`;
}

function mergeList(existing, incoming) {
  const values = new Set(existing.split(';').map((value) => value.trim()).filter(Boolean));
  values.add(incoming);
  return [...values].join(';');
}

function appendNote(existing, note) {
  return existing ? `${existing} ${note}` : note;
}

function rowsByUniqueKey(rows, keyFn, label) {
  const byKey = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (byKey.has(key)) throw new Error(`Duplicate ${label}: ${key}`);
    byKey.set(key, row);
  }
  return byKey;
}

function reconcileQuestRows(existingRows, candidateRows, keyFn, compareFields, label) {
  const existingByKey = rowsByUniqueKey(existingRows, keyFn, `canonical ${label}`);
  const candidateByKey = rowsByUniqueKey(candidateRows, keyFn, `candidate ${label}`);
  const additions = [];
  for (const [key, candidate] of candidateByKey) {
    const existing = existingByKey.get(key);
    if (!existing) {
      additions.push(candidate);
      continue;
    }
    if (compareFields.some((field) => existing[field] !== candidate[field])) {
      throw new Error(`Candidate ${label} conflicts with canonical data: ${key}`);
    }
  }
  return additions;
}

function toCsv(columns, rows) {
  return `${columns.join(',')}\n${rows.map((row) => serializeRow(columns, row)).join('\n')}\n`;
}

async function main() {
  const masteryPath = process.argv.slice(2).find((argument) => !argument.startsWith('--'));
  const apply = process.argv.includes('--apply');
  if (!masteryPath) {
    throw new Error('Usage: node scripts/promoteAugust2026ReferenceData.mjs <mastery-paste.txt> [--apply]');
  }

  const root = process.cwd();
  const evidenceDir = path.join(root, 'planning', 'new-item-intake', 'august-quest-evidence-2026-09-04');
  const paths = {
    catalog: path.join(root, 'data', 'item_catalog.csv'),
    quests: path.join(root, 'data', 'quest_catalog.csv'),
    requirements: path.join(root, 'data', 'quest_requirements.csv'),
    rewards: path.join(root, 'data', 'quest_rewards.csv'),
    questCandidates: path.join(evidenceDir, 'buddy_quest_catalog_rows.csv'),
    requirementCandidates: path.join(evidenceDir, 'buddy_quest_requirement_rows.csv'),
    rewardCandidates: path.join(evidenceDir, 'buddy_quest_reward_rows.csv'),
    stagedRecipes: path.join(root, 'planning', 'new-item-intake', 'new-item-recipes-2026-08-31.csv'),
    recipes: path.join(root, 'data', 'recipes.csv'),
    recipeInputs: path.join(root, 'data', 'recipe_inputs.csv'),
    itemReview: path.join(root, 'planning', 'new-item-intake', 'august-mastery-review-2026-09-04.csv'),
    questReview: path.join(root, 'planning', 'new-item-intake', 'august-quest-reconciliation-2026-09-04.csv'),
    recipeReview: path.join(root, 'planning', 'new-item-intake', 'august-screenshot-recipe-reconciliation-2026-09-04.csv'),
  };
  const [masteryText, catalogText, questText, requirementText, rewardText, questCandidateText, requirementCandidateText, rewardCandidateText, stagedRecipeText, recipeText, recipeInputText] = await Promise.all([
    readFile(path.resolve(masteryPath), 'utf8'),
    readFile(paths.catalog, 'utf8'),
    readFile(paths.quests, 'utf8'),
    readFile(paths.requirements, 'utf8'),
    readFile(paths.rewards, 'utf8'),
    readFile(paths.questCandidates, 'utf8'),
    readFile(paths.requirementCandidates, 'utf8'),
    readFile(paths.rewardCandidates, 'utf8'),
    readFile(paths.stagedRecipes, 'utf8'),
    readFile(paths.recipes, 'utf8'),
    readFile(paths.recipeInputs, 'utf8'),
  ]);

  const masteryNames = new Set(masteryText.split(/\r?\n/u).map(normalizeKey).filter(Boolean));
  const catalogRows = parseCsv(catalogText, CATALOG_COLUMNS, 'item catalog');
  const catalogByKey = rowsByUniqueKey(catalogRows, (row) => row.canonical_key, 'catalog key');
  const itemAdds = [];
  const itemUpdates = [];
  const itemReviewRows = [];
  const masteryNote = 'Exact item-name match in the user-supplied mastery export on 2026-09-04; promoted in BL-339.';

  for (const itemName of AUGUST_ITEMS) {
    const key = normalizeKey(itemName);
    const seenInMastery = masteryNames.has(key);
    const existing = catalogByKey.get(key);
    const priorStatus = existing?.mastery_possible ?? 'missing';
    const desiredStatus = seenInMastery ? 'yes' : existing?.mastery_possible ?? 'unknown';
    let action = 'unchanged';
    if (!existing) {
      itemAdds.push({
        item_name: itemName,
        canonical_key: key,
        mastery_possible: desiredStatus,
        farmrpg_item_id: '',
        buddy_slug: '',
        source_datasets: seenInMastery
          ? 'user_august_item_list_2026_09_04;user_mastery_export_2026_09_04'
          : 'user_august_item_list_2026_09_04',
        notes: seenInMastery
          ? masteryNote
          : 'User-supplied August item identity promoted in BL-339; absent from the 2026-09-04 mastery export so eligibility remains unknown.',
      });
      action = 'added';
    } else if (seenInMastery && existing.mastery_possible !== 'yes') {
      itemUpdates.push({
        ...existing,
        mastery_possible: 'yes',
        source_datasets: mergeList(existing.source_datasets, 'user_mastery_export_2026_09_04'),
        notes: appendNote(existing.notes, masteryNote),
      });
      action = `${existing.mastery_possible}_to_yes`;
    }
    itemReviewRows.push({
      item_name: itemName,
      canonical_key: key,
      seen_in_mastery_export: seenInMastery ? 'yes' : 'no',
      prior_catalog_status: priorStatus,
      promotion_action: action,
      final_mastery_status: desiredStatus,
      notes: seenInMastery ? 'Masterable by direct mastery-export evidence.' : 'No mastery inference made.',
    });
  }

  const questRows = parseCsv(questText, QUEST_COLUMNS, 'quest catalog');
  const requirementRows = parseCsv(requirementText, QUEST_ITEM_COLUMNS, 'quest requirements');
  const rewardRows = parseCsv(rewardText, QUEST_REWARD_COLUMNS, 'quest rewards');
  const questCandidates = parseCsv(questCandidateText, QUEST_COLUMNS, 'quest candidates');
  const requirementCandidates = parseCsv(requirementCandidateText, QUEST_ITEM_COLUMNS, 'requirement candidates');
  const rewardCandidates = parseCsv(rewardCandidateText, QUEST_REWARD_COLUMNS, 'reward candidates');
  const questAdds = reconcileQuestRows(questRows, questCandidates, (row) => row.quest_key, ['quest_name', 'questline_key', 'questline_name', 'source_url'], 'quest');
  const requirementAdds = reconcileQuestRows(requirementRows, requirementCandidates, (row) => `${row.quest_key}|${row.requirement_type}|${row.canonical_key}`, ['item_name', 'quantity', 'source_url'], 'quest requirement');
  const rewardAdds = reconcileQuestRows(rewardRows, rewardCandidates, (row) => `${row.quest_key}|${row.reward_type}|${row.canonical_key}`, ['item_name', 'quantity', 'source_url'], 'quest reward');

  const stagedRecipeRows = parseCsv(stagedRecipeText, STAGED_RECIPE_COLUMNS, 'staged screenshot recipes');
  const canonicalRecipes = parseCsv(recipeText, RECIPE_COLUMNS, 'recipes');
  const canonicalRecipeInputs = parseCsv(recipeInputText, RECIPE_INPUT_COLUMNS, 'recipe inputs');
  const canonicalRecipesByKey = rowsByUniqueKey(canonicalRecipes, (row) => row.output_canonical_key, 'recipe output');
  const canonicalInputsByOutput = new Map();
  for (const input of canonicalRecipeInputs) {
    if (!canonicalInputsByOutput.has(input.output_canonical_key)) canonicalInputsByOutput.set(input.output_canonical_key, []);
    canonicalInputsByOutput.get(input.output_canonical_key).push(input);
  }
  const stagedByOutput = new Map();
  for (const row of stagedRecipeRows) {
    const isShiningEarrings = row.output_canonical_key === 'shining farrings';
    const outputCanonicalKey = isShiningEarrings ? 'shining earrings' : row.output_canonical_key;
    const outputItemName = isShiningEarrings ? 'Shining Earrings' : row.output_item_name;
    if (!stagedByOutput.has(outputCanonicalKey)) stagedByOutput.set(outputCanonicalKey, { outputItemName, inputs: [] });
    stagedByOutput.get(outputCanonicalKey).inputs.push(row);
  }
  const recipeAdds = [];
  const recipeInputAdds = [];
  const recipeReviewRows = [];
  const recipeNote = 'Normalized from the user-supplied August 31 screenshot recipe evidence and promoted in BL-339.';
  for (const [outputCanonicalKey, candidate] of stagedByOutput) {
    const existing = canonicalRecipesByKey.get(outputCanonicalKey);
    const existingInputs = canonicalInputsByOutput.get(outputCanonicalKey) ?? [];
    const existingQuantities = new Map(existingInputs.map((input) => [input.input_canonical_key, Number(input.quantity)]));
    const matches = existing
      && existingInputs.length === candidate.inputs.length
      && candidate.inputs.every((input) => existingQuantities.get(input.input_canonical_key) === Number(input.per_craft_quantity));
    if (existing && !matches) throw new Error(`Staged screenshot recipe conflicts with canonical recipe: ${outputCanonicalKey}`);
    let action = 'matched_existing';
    if (!existing) {
      recipeAdds.push({
        output_item_name: candidate.outputItemName,
        output_canonical_key: outputCanonicalKey,
        recipe_type: 'craft',
        recipe_book_item_name: '',
        recipe_book_canonical_key: '',
        cooking_level: '',
        base_time: '',
        source_buddy_url: '',
        source_page_data_url: '',
        cache_file_name: 'user-screenshot-recipes-2026-08-31',
        parser_version: 'manual-screenshot-normalization-v1',
        notes: recipeNote,
      });
      candidate.inputs.forEach((input, index) => {
        recipeInputAdds.push({
          output_canonical_key: outputCanonicalKey,
          output_item_name: candidate.outputItemName,
          input_order: index + 1,
          input_item_name: input.input_item_name,
          input_canonical_key: input.input_canonical_key,
          quantity: input.per_craft_quantity,
          source_buddy_url: '',
          source_page_data_url: '',
          cache_file_name: 'user-screenshot-recipes-2026-08-31',
          parser_version: 'manual-screenshot-normalization-v1',
          notes: recipeNote,
        });
      });
      action = 'added';
    }
    recipeReviewRows.push({
      output_item_name: candidate.outputItemName,
      output_canonical_key: outputCanonicalKey,
      input_count: candidate.inputs.length,
      reconciliation_action: action,
      notes: outputCanonicalKey === 'shining earrings'
        ? 'The staged Shining Farrings label was reconciled to the exact Workshop name Shining Earrings.'
        : 'Reconciled by normalized output and input names plus per-craft quantities.',
    });
  }

  const questReviewRows = AUGUST_QUESTLINES.map((questlineName) => {
    const stages = questCandidates.filter((row) => row.questline_key === normalizeKey(questlineName));
    return {
      questline_name: questlineName,
      evidence_status: stages.length > 0 ? 'buddy_stage_evidence' : 'unresolved',
      stage_count: stages.length,
      partial_stage_count: stages.filter((row) => row.coverage_status === 'partial').length,
      promotion_status: stages.length > 0 ? 'promoted' : 'not_promoted',
      notes: stages.length > 0
        ? 'Bounded Buddy quest page-data extracted and reconciled for BL-339.'
        : 'Exact Buddy questline page returned 404; no quest stages were guessed.',
    };
  });

  console.log(`item_adds: ${itemAdds.length}`);
  console.log(`item_updates: ${itemUpdates.length}`);
  console.log(`mastery_yes: ${itemReviewRows.filter((row) => row.final_mastery_status === 'yes').length}`);
  console.log(`mastery_unknown: ${itemReviewRows.filter((row) => row.final_mastery_status === 'unknown').length}`);
  console.log(`mastery_no: ${itemReviewRows.filter((row) => row.final_mastery_status === 'no').length}`);
  console.log(`quest_adds: ${questAdds.length}`);
  console.log(`requirement_adds: ${requirementAdds.length}`);
  console.log(`reward_adds: ${rewardAdds.length}`);
  console.log(`recipe_adds: ${recipeAdds.length}`);
  console.log(`recipe_input_adds: ${recipeInputAdds.length}`);
  if (!apply) {
    console.log('dry_run: true');
    return;
  }

  const updatedCatalog = appendRows(replaceCatalogRows(catalogText, itemUpdates), CATALOG_COLUMNS, itemAdds);
  await writeFile(paths.catalog, updatedCatalog, 'utf8');
  await writeFile(paths.quests, appendRows(questText, QUEST_COLUMNS, questAdds), 'utf8');
  await writeFile(paths.requirements, appendRows(requirementText, QUEST_ITEM_COLUMNS, requirementAdds), 'utf8');
  await writeFile(paths.rewards, appendRows(rewardText, QUEST_REWARD_COLUMNS, rewardAdds), 'utf8');
  await writeFile(paths.recipes, appendRows(recipeText, RECIPE_COLUMNS, recipeAdds), 'utf8');
  await writeFile(paths.recipeInputs, appendRows(recipeInputText, RECIPE_INPUT_COLUMNS, recipeInputAdds), 'utf8');
  await writeFile(paths.itemReview, toCsv(['item_name', 'canonical_key', 'seen_in_mastery_export', 'prior_catalog_status', 'promotion_action', 'final_mastery_status', 'notes'], itemReviewRows), 'utf8');
  await writeFile(paths.questReview, toCsv(['questline_name', 'evidence_status', 'stage_count', 'partial_stage_count', 'promotion_status', 'notes'], questReviewRows), 'utf8');
  await writeFile(paths.recipeReview, toCsv(['output_item_name', 'output_canonical_key', 'input_count', 'reconciliation_action', 'notes'], recipeReviewRows), 'utf8');
  console.log('applied: true');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
