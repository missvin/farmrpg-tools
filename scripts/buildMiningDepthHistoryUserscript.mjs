import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const corePath = path.join(scriptsDirectory, 'lib', 'miningDepthHistory.mjs');
const templatePath = path.join(scriptsDirectory, 'userscripts', 'farmrpg-mining-depth-history.user.template.js');
const outputPath = path.join(scriptsDirectory, 'userscripts', 'farmrpg-mining-depth-history.user.js');
const placeholder = '/*__MINING_DEPTH_HISTORY_CORE__*/';

export function buildMiningDepthHistoryUserscript({ coreSource, templateSource }) {
  if (!templateSource.includes(placeholder)) {
    throw new Error(`Userscript template is missing ${placeholder}.`);
  }

  const bundledCore = coreSource.replace(/^export\s+(?=(?:const|function|async\s+function|class)\s)/gmu, '');
  if (/^\s*(?:import|export)\s/mu.test(bundledCore)) {
    throw new Error('Mining depth history core must remain import-free and use declaration exports only.');
  }

  return templateSource.replace(
    placeholder,
    `// Generated from scripts/lib/miningDepthHistory.mjs. Do not edit this embedded section directly.\n${bundledCore.trim()}`,
  );
}

export async function writeMiningDepthHistoryUserscript() {
  const [coreSource, templateSource] = await Promise.all([
    readFile(corePath, 'utf8'),
    readFile(templatePath, 'utf8'),
  ]);
  const output = buildMiningDepthHistoryUserscript({ coreSource, templateSource });
  await writeFile(outputPath, output, 'utf8');
  return outputPath;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const writtenPath = await writeMiningDepthHistoryUserscript();
  console.log(`Generated ${path.relative(process.cwd(), writtenPath)}`);
}
