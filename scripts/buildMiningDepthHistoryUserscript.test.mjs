import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildMiningDepthHistoryUserscript } from './buildMiningDepthHistoryUserscript.mjs';

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const corePath = path.join(scriptsDirectory, 'lib', 'miningDepthHistory.mjs');
const templatePath = path.join(scriptsDirectory, 'userscripts', 'farmrpg-mining-depth-history.user.template.js');
const outputPath = path.join(scriptsDirectory, 'userscripts', 'farmrpg-mining-depth-history.user.js');

describe('mining depth history userscript build', () => {
  it('keeps the checked-in standalone userscript synchronized with the tested core and template', async () => {
    const [coreSource, templateSource, outputSource] = await Promise.all([
      readFile(corePath, 'utf8'),
      readFile(templatePath, 'utf8'),
      readFile(outputPath, 'utf8'),
    ]);

    expect(outputSource).toBe(buildMiningDepthHistoryUserscript({ coreSource, templateSource }));
    expect(outputSource).toContain('// ==UserScript==');
    expect(outputSource).toContain("GM_addValueChangeListener(MINING_HISTORY_STORAGE_KEY");
    expect(outputSource).toContain('const INSTANCE_ID = getOrCreateInstanceId();');
    expect(outputSource).not.toContain('/*__MINING_DEPTH_HISTORY_CORE__*/');
  });
});
