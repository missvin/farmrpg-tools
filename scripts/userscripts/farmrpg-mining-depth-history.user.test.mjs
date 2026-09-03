import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  MINING_HISTORY_STORAGE_KEY,
  createEmptyMiningHistory,
  createMiningSnapshot,
} from '../lib/miningDepthHistory.mjs';

const userscriptPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'farmrpg-mining-depth-history.user.js',
);
const userscriptSource = await readFile(userscriptPath, 'utf8');

function renderMiningPage() {
  document.body.innerHTML = `
    <div id="fireworks" data-page="mine">
      <div class="page page-on-center" data-page="mine">
        <div class="card"><div class="card-content"><div class="list-block"><ul>
          <li><a href="mining.php?id=1" class="item-link"><div class="item-title">Spring Cave<br><span>Small Spring</span></div><div class="item-after">Floor 1,622</div></a></li>
          <li><a href="mining.php?id=2" class="item-link"><div class="item-title">Highland Hollow<br><span>Highland Hills</span></div><div class="item-after">Floor 3,148</div></a></li>
        </ul></div></div></div>
      </div>
    </div>`;
  window.location.hash = '#!/mine.php';
}

function createImmediateLockManager() {
  return {
    request: vi.fn(async (_name, _options, operation) => operation()),
  };
}

afterEach(() => {
  vi.useRealTimers();
  window.location.hash = '';
  sessionStorage.clear();
  delete globalThis.GM_getValue;
  delete globalThis.GM_setValue;
  delete globalThis.GM_addValueChangeListener;
});

describe('generated mining depth history userscript', () => {
  it('captures once, renders controls, and refreshes status after a remote tab update', async () => {
    vi.useFakeTimers();
    renderMiningPage();

    const values = new Map();
    let historyListener;
    globalThis.GM_getValue = vi.fn((key, fallback) => (values.has(key) ? structuredClone(values.get(key)) : fallback));
    globalThis.GM_setValue = vi.fn((key, value) => values.set(key, structuredClone(value)));
    globalThis.GM_addValueChangeListener = vi.fn((_key, listener) => {
      historyListener = listener;
      return 1;
    });
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: createImmediateLockManager(),
    });
    vi.spyOn(performance, 'getEntriesByType').mockReturnValue([{ type: 'navigate' }]);

    window.eval(userscriptSource);
    await vi.advanceTimersByTimeAsync(500);

    const stored = values.get(MINING_HISTORY_STORAGE_KEY);
    expect(stored.snapshots).toHaveLength(1);
    expect(stored.snapshots[0].mines).toEqual([
      { mineId: 1, name: 'Spring Cave', floor: 1622 },
      { mineId: 2, name: 'Highland Hollow', floor: 3148 },
    ]);
    expect(document.getElementById('farmrpg-mining-depth-history-status')).toHaveTextContent('Saved. 1 saved visit.');
    expect(document.querySelectorAll('#farmrpg-mining-depth-history-panel button')).toHaveLength(3);

    const remoteSnapshot = createMiningSnapshot({
      snapshotId: 'remote-snapshot',
      observedAt: new Date('2026-09-03T21:00:00.000Z'),
      mines: [
        { mineId: 1, name: 'Spring Cave', floor: 1623 },
        { mineId: 2, name: 'Highland Hollow', floor: 3149 },
      ],
    });
    const remoteHistory = { ...createEmptyMiningHistory(), snapshots: [...stored.snapshots, remoteSnapshot] };
    values.set(MINING_HISTORY_STORAGE_KEY, remoteHistory);
    historyListener(MINING_HISTORY_STORAGE_KEY, stored, remoteHistory, true);
    await vi.runAllTimersAsync();

    expect(document.getElementById('farmrpg-mining-depth-history-status')).toHaveTextContent(
      'Updated in another tab. 2 saved visits.',
    );
  });
});
