const WORKSHOP_START_MARKER = 'Items that you can craft are below.';
const WORKSHOP_END_MARKER = 'Consume a meal';

const IGNORED_LINES = new Set([
  'Go to Craftworks',
  'View / Edit Craftable Items',
  'Buy more Materials',
  'Adjust Order Favorite Items',
  'Craftable Items',
  'Favorite Items',
  'heart_fill',
  'In Craftworks',
]);

function parseInteger(value) {
  return Number.parseInt(String(value).replace(/,/gu, ''), 10);
}

function greatestCommonDivisor(left, right) {
  let currentLeft = Math.abs(left);
  let currentRight = Math.abs(right);

  while (currentRight !== 0) {
    const remainder = currentLeft % currentRight;
    currentLeft = currentRight;
    currentRight = remainder;
  }

  return currentLeft;
}

function commonDivisors(values) {
  const divisorLimit = values.reduce(greatestCommonDivisor);
  const lowerDivisors = [];
  const upperDivisors = [];

  for (let candidate = 1; candidate * candidate <= divisorLimit; candidate += 1) {
    if (divisorLimit % candidate !== 0) {
      continue;
    }

    lowerDivisors.push(candidate);
    if (candidate * candidate !== divisorLimit) {
      upperDivisors.unshift(divisorLimit / candidate);
    }
  }

  return [...lowerDivisors, ...upperDivisors];
}

export function toCanonicalItemKey(value) {
  return String(value ?? '')
    .replace(/[\u2018\u2019\u201a\u201b\u2032]/gu, "'")
    .replace(/[\u201c\u201d\u201e\u201f\u2033]/gu, '"')
    .toLowerCase()
    .trim()
    .replace(/\s+/gu, ' ');
}

export function deriveWorkshopRecipeQuantities(inputs) {
  if (inputs.length === 0) {
    return {
      status: 'question',
      questionType: 'missing_recipe_inputs',
      details: 'The craftable output had no ingredient rows.',
      derivedCraftQuantity: null,
      inputs: [],
    };
  }

  if (inputs.some((input) => input.inventoryQuantity < input.displayedRequiredQuantity)) {
    return {
      status: 'ready',
      questionType: null,
      details: null,
      derivedCraftQuantity: 0,
      inputs: inputs.map((input) => ({
        ...input,
        perCraftQuantity: input.displayedRequiredQuantity,
      })),
    };
  }

  const displayedRequirements = inputs.map((input) => input.displayedRequiredQuantity);
  const candidates = commonDivisors(displayedRequirements).filter((candidate) => {
    const perCraftQuantities = displayedRequirements.map((quantity) => quantity / candidate);
    const maximumCraftable = Math.min(
      ...inputs.map((input, index) => Math.floor(input.inventoryQuantity / perCraftQuantities[index])),
    );
    return maximumCraftable === candidate;
  });

  if (candidates.length === 0) {
    return {
      status: 'question',
      questionType: 'unresolved_craft_quantity',
      details: 'The displayed requirements did not resolve to a valid maximum craft quantity.',
      derivedCraftQuantity: null,
      inputs: inputs.map((input) => ({ ...input, perCraftQuantity: null })),
    };
  }

  const derivedCraftQuantity = candidates.at(-1);
  return {
    status: 'ready',
    questionType: null,
    details: null,
    derivedCraftQuantity,
    inputs: inputs.map((input) => ({
      ...input,
      perCraftQuantity: input.displayedRequiredQuantity / derivedCraftQuantity,
    })),
  };
}

function recipesMatch(left, right) {
  if (left.inputs.length !== right.inputs.length) {
    return false;
  }

  return left.inputs.every((input, index) => {
    const other = right.inputs[index];
    return input.inputCanonicalKey === other.inputCanonicalKey
      && input.displayedRequiredQuantity === other.displayedRequiredQuantity
      && input.inventoryQuantity === other.inventoryQuantity;
  });
}

export function parseFarmRpgWorkshopPaste(text) {
  const lines = String(text ?? '').split(/\r?\n/u);
  const parsedOutputs = [];
  const questions = [];
  let inWorkshop = false;
  let currentOutput = null;

  function finishCurrentOutput() {
    if (!currentOutput) {
      return;
    }

    const derivation = deriveWorkshopRecipeQuantities(currentOutput.inputs);
    parsedOutputs.push({
      ...currentOutput,
      ...derivation,
    });

    if (derivation.status === 'question') {
      questions.push({
        outputItemName: currentOutput.outputItemName,
        outputCanonicalKey: currentOutput.outputCanonicalKey,
        questionType: derivation.questionType,
        details: derivation.details,
        sourceLine: currentOutput.sourceLine,
        blockingCanonicalPromotion: true,
      });
    }

    currentOutput = null;
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    const sourceLine = index + 1;

    if (!inWorkshop) {
      if (line.startsWith(WORKSHOP_START_MARKER)) {
        inWorkshop = true;
      }
      continue;
    }

    if (line === WORKSHOP_END_MARKER) {
      finishCurrentOutput();
      break;
    }

    if (!line || IGNORED_LINES.has(line) || /^\d+ (Running|Paused)$/u.test(line)) {
      continue;
    }

    const outputMatch = line.match(/^(.+?) \(([\d,]+)\)$/u);
    if (outputMatch) {
      finishCurrentOutput();
      const outputItemName = outputMatch[1].trim();
      currentOutput = {
        outputItemName,
        outputCanonicalKey: toCanonicalItemKey(outputItemName),
        ownedQuantity: parseInteger(outputMatch[2]),
        sourceLine,
        inputs: [],
      };
      continue;
    }

    const inputMatch = line.match(/^([\d,]+) \/ ([\d,]+) (.+)$/u);
    if (inputMatch) {
      if (!currentOutput) {
        questions.push({
          outputItemName: '',
          outputCanonicalKey: '',
          questionType: 'orphan_ingredient_row',
          details: `Ingredient row appeared before a craftable output: ${line}`,
          sourceLine,
          blockingCanonicalPromotion: true,
        });
        continue;
      }

      const inputItemName = inputMatch[3].trim();
      currentOutput.inputs.push({
        inputOrder: currentOutput.inputs.length + 1,
        inputItemName,
        inputCanonicalKey: toCanonicalItemKey(inputItemName),
        inventoryQuantity: parseInteger(inputMatch[1]),
        displayedRequiredQuantity: parseInteger(inputMatch[2]),
      });
      continue;
    }
  }

  finishCurrentOutput();

  const outputsByCanonicalKey = new Map();
  const deduplicatedOutputs = [];

  for (const output of parsedOutputs) {
    const existing = outputsByCanonicalKey.get(output.outputCanonicalKey);
    if (!existing) {
      outputsByCanonicalKey.set(output.outputCanonicalKey, output);
      deduplicatedOutputs.push(output);
      continue;
    }

    if (!recipesMatch(existing, output)) {
      questions.push({
        outputItemName: output.outputItemName,
        outputCanonicalKey: output.outputCanonicalKey,
        questionType: 'conflicting_duplicate_output',
        details: `The output appeared more than once with different displayed ingredient rows (first seen on line ${existing.sourceLine}).`,
        sourceLine: output.sourceLine,
        blockingCanonicalPromotion: true,
      });
    }
  }

  return {
    outputs: deduplicatedOutputs,
    questions,
    summary: {
      outputCount: deduplicatedOutputs.length,
      readyOutputCount: deduplicatedOutputs.filter((output) => output.status === 'ready').length,
      questionOutputCount: deduplicatedOutputs.filter((output) => output.status === 'question').length,
      ingredientRowCount: deduplicatedOutputs.reduce((sum, output) => sum + output.inputs.length, 0),
      questionCount: questions.length,
    },
  };
}

function escapeCsvValue(value) {
  const text = String(value ?? '');
  return /[",\n]/u.test(text) ? `"${text.replace(/"/gu, '""')}"` : text;
}

function toCsv(header, rows) {
  return [
    header.join(','),
    ...rows.map((row) => header.map((column) => escapeCsvValue(row[column])).join(',')),
  ].join('\n');
}

export function toWorkshopItemsCsv(result, evidenceDate) {
  const header = [
    'observed_item_name',
    'canonical_key',
    'owned_quantity',
    'derived_craft_quantity',
    'mastery_confirmation_status',
    'evidence_source',
    'evidence_date',
    'review_status',
    'notes',
  ];
  const rows = result.outputs.map((output) => ({
    observed_item_name: output.outputItemName,
    canonical_key: output.outputCanonicalKey,
    owned_quantity: output.ownedQuantity,
    derived_craft_quantity: output.derivedCraftQuantity ?? '',
    mastery_confirmation_status: 'confirmed_masterable',
    evidence_source: 'user-supplied Workshop paste',
    evidence_date: evidenceDate,
    review_status: output.status === 'ready' ? 'recipe_normalized_pending_reconciliation' : 'question_blocks_promotion',
    notes: output.status === 'ready'
      ? 'Listed as craftable in the supplied non-exhaustive Workshop paste; user confirmed every listed output is masterable.'
      : output.details,
  }));
  return toCsv(header, rows);
}

export function toWorkshopRecipesCsv(result, evidenceDate) {
  const header = [
    'output_item_name',
    'output_canonical_key',
    'derived_craft_quantity',
    'input_order',
    'input_item_name',
    'input_canonical_key',
    'input_inventory_quantity',
    'displayed_required_quantity',
    'per_craft_quantity',
    'evidence_source',
    'evidence_date',
    'review_status',
    'notes',
  ];
  const rows = result.outputs.flatMap((output) => output.inputs.map((input) => ({
    output_item_name: output.outputItemName,
    output_canonical_key: output.outputCanonicalKey,
    derived_craft_quantity: output.derivedCraftQuantity ?? '',
    input_order: input.inputOrder,
    input_item_name: input.inputItemName,
    input_canonical_key: input.inputCanonicalKey,
    input_inventory_quantity: input.inventoryQuantity,
    displayed_required_quantity: input.displayedRequiredQuantity,
    per_craft_quantity: input.perCraftQuantity ?? '',
    evidence_source: 'user-supplied Workshop paste',
    evidence_date: evidenceDate,
    review_status: output.status === 'ready' ? 'normalized_pending_reconciliation' : 'question_blocks_promotion',
    notes: output.derivedCraftQuantity === 0
      ? 'At least one displayed inventory amount was below the one-craft requirement so the UI craft quantity was 0 and displayed requirements were already per craft.'
      : 'Displayed requirements were divided by the uniquely derived craft quantity.',
  })));
  return toCsv(header, rows);
}

export function toWorkshopQuestionsCsv(result) {
  const header = [
    'question_id',
    'output_item_name',
    'output_canonical_key',
    'question_type',
    'details',
    'source_line',
    'blocking_canonical_promotion',
    'resolution',
  ];
  const rows = result.questions.map((question, index) => ({
    question_id: `WQ-${String(index + 1).padStart(3, '0')}`,
    output_item_name: question.outputItemName,
    output_canonical_key: question.outputCanonicalKey,
    question_type: question.questionType,
    details: question.details,
    source_line: question.sourceLine,
    blocking_canonical_promotion: question.blockingCanonicalPromotion ? 'yes' : 'no',
    resolution: '',
  }));
  return toCsv(header, rows);
}
