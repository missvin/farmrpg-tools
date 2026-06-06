import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import {
  getBuddyItemEvidenceFileName,
  getBuddyItemPageDataUrl,
  getBuddyItemSlug,
  parseBuddyItemEvidenceTargetCsv,
} from './buddyItemEvidenceCache.mjs';

const KNOWN_WRONG_EDGE_SLUGS = new Set([
  'pot-of-gold-small',
  'pot-of-gold-medium',
  'pot-of-gold-large',
  'r-o-a-s',
]);

const DEFAULT_REQUIRED_PET_MIN_COUNTS = {
  Hedgehog: 12,
};

function parseCsvRow(line) {
  const values = [];
  let currentValue = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        currentValue += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }

      continue;
    }

    if (character === ',' && !inQuotes) {
      values.push(currentValue);
      currentValue = '';
      continue;
    }

    currentValue += character;
  }

  values.push(currentValue);
  return values;
}

function parseCsvRecords(csvText) {
  const lines = csvText
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvRow(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = parseCsvRow(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
}

function getItemPayload(evidence) {
  return evidence?.pageData?.result?.data?.farmrpg?.items?.[0] ?? null;
}

function addIssue(issues, severity, code, message, context = {}) {
  issues.push({
    severity,
    code,
    message,
    ...context,
  });
}

function validateTargetEvidence({ targets, evidenceByFileName, expectedCount }) {
  const issues = [];
  const expectedFiles = new Set();

  if (expectedCount !== null && targets.length !== expectedCount) {
    addIssue(
      issues,
      'error',
      'unexpected_target_count',
      `Expected ${expectedCount.toLocaleString()} Buddy evidence targets but found ${targets.length.toLocaleString()}.`,
    );
  }

  for (const target of targets) {
    const slug = getBuddyItemSlug(target.buddyUrl);
    const expectedPageDataUrl = getBuddyItemPageDataUrl(target.buddyUrl);
    const cacheFileName = getBuddyItemEvidenceFileName(target);
    const evidence = evidenceByFileName[cacheFileName] ?? null;
    expectedFiles.add(cacheFileName);

    if (KNOWN_WRONG_EDGE_SLUGS.has(slug)) {
      addIssue(
        issues,
        'error',
        'known_wrong_slug',
        `${target.itemName} still uses known-wrong Buddy slug "${slug}".`,
        { itemName: target.itemName, cacheFileName, buddyUrl: target.buddyUrl },
      );
    }

    if (!evidence) {
      addIssue(
        issues,
        'error',
        'missing_cache_file',
        `${target.itemName} is missing expected cache file ${cacheFileName}.`,
        { itemName: target.itemName, cacheFileName },
      );
      continue;
    }

    if (evidence.buddyUrl !== target.buddyUrl) {
      addIssue(
        issues,
        'error',
        'stale_cache_buddy_url',
        `${target.itemName} cache file ${cacheFileName} has buddyUrl ${evidence.buddyUrl} but target expects ${target.buddyUrl}.`,
        { itemName: target.itemName, cacheFileName },
      );
    }

    if (evidence.pageDataUrl !== expectedPageDataUrl) {
      addIssue(
        issues,
        'error',
        'stale_cache_page_data_url',
        `${target.itemName} cache file ${cacheFileName} has pageDataUrl ${evidence.pageDataUrl} but target expects ${expectedPageDataUrl}.`,
        { itemName: target.itemName, cacheFileName },
      );
    }

    if (evidence.httpStatus !== 200) {
      addIssue(
        issues,
        'error',
        'non_success_evidence',
        `${target.itemName} cache file ${cacheFileName} has HTTP status ${evidence.httpStatus ?? 'blank'}.`,
        { itemName: target.itemName, cacheFileName, httpStatus: evidence.httpStatus ?? null },
      );
    }

    if (!getItemPayload(evidence)) {
      addIssue(
        issues,
        'error',
        'missing_direct_item_payload',
        `${target.itemName} cache file ${cacheFileName} does not include a direct FarmRPG item payload.`,
        { itemName: target.itemName, cacheFileName },
      );
    }
  }

  const extraFiles = Object.keys(evidenceByFileName).filter((fileName) => !expectedFiles.has(fileName));
  for (const fileName of extraFiles) {
    addIssue(
      issues,
      'warning',
      'extra_cache_file',
      `Cache file ${fileName} is not referenced by the target CSV and will not be promotion-readiness counted.`,
      { cacheFileName: fileName },
    );
  }

  return issues;
}

function validatePetFanoutRows(rows, requiredPetMinCounts = DEFAULT_REQUIRED_PET_MIN_COUNTS) {
  const issues = [];
  const countsByPetName = rows.reduce((counts, row) => {
    const petName = String(row.pet_name ?? '').trim();
    if (petName) {
      counts[petName] = (counts[petName] ?? 0) + 1;
    }
    return counts;
  }, {});

  for (const [petName, minimumCount] of Object.entries(requiredPetMinCounts)) {
    const actualCount = countsByPetName[petName] ?? 0;
    if (actualCount < minimumCount) {
      addIssue(
        issues,
        'error',
        'pet_source_group_gap',
        `${petName} has ${actualCount.toLocaleString()} pet-source candidate rows; expected at least ${minimumCount.toLocaleString()}.`,
        { petName, actualCount, minimumCount },
      );
    }
  }

  return issues;
}

export async function readBuddyEvidenceRecordsFromCacheDir(cacheDir) {
  const pagesDir = path.join(cacheDir, 'pages');
  const entries = await readdir(pagesDir, { withFileTypes: true });
  const evidenceByFileName = {};

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) {
      continue;
    }

    evidenceByFileName[entry.name] = JSON.parse(await readFile(path.join(pagesDir, entry.name), 'utf8'));
  }

  return evidenceByFileName;
}

export async function validateBuddyEvidenceArtifactReadiness(options) {
  const targetCsvText = await readFile(options.targetCsvPath, 'utf8');
  const targets = parseBuddyItemEvidenceTargetCsv(targetCsvText);
  const evidenceByFileName = await readBuddyEvidenceRecordsFromCacheDir(options.cacheDir);
  const issues = validateTargetEvidence({
    targets,
    evidenceByFileName,
    expectedCount: options.expectedCount ?? null,
  });

  if (options.fanoutDir) {
    const petCsvPath = path.join(options.fanoutDir, 'pet_source_reference_candidates.csv');
    const petRows = parseCsvRecords(await readFile(petCsvPath, 'utf8'));
    issues.push(...validatePetFanoutRows(petRows, options.requiredPetMinCounts));
  }

  const errorCount = issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;

  return {
    valid: errorCount === 0,
    summary: {
      targetsChecked: targets.length,
      cacheFilesFound: Object.keys(evidenceByFileName).length,
      errorCount,
      warningCount,
    },
    issues,
  };
}
