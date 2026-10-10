// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const roots = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'farmrpg-git-test-'));
  roots.push(root);
  const repo = join(root, 'repo');
  const remote = join(root, 'remote.git');
  mkdirSync(join(repo, 'scripts'), { recursive: true });
  mkdirSync(join(repo, 'recovery'));
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr);
    return result.stdout.trim();
  };
  git('init', '-b', 'master');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.invalid');
  writeFileSync(join(repo, '.gitignore'), 'recovery/*.txt\n');
  for (const name of ['branch', 'merge', 'commit']) copyFileSync(join(process.cwd(), 'scripts', `codex-safe-${name}.mjs`), join(repo, 'scripts', `codex-safe-${name}.mjs`));
  writeFileSync(join(repo, 'shared.txt'), 'base\n');
  git('add', '.');
  git('commit', '-m', 'fixture base');
  git('init', '--bare', remote);
  git('remote', 'add', 'origin', remote);
  git('push', '-u', 'origin', 'master');
  const base = git('rev-parse', 'HEAD');
  const input = (name, value) => writeFileSync(join(repo, 'recovery', `codex-${name}.txt`), value);
  const helper = name => spawnSync(process.execPath, [join(repo, 'scripts', `codex-safe-${name}.mjs`)], { cwd: repo, encoding: 'utf8' });
  const commit = (file, text) => { writeFileSync(join(repo, file), text); git('add', '--', file); git('commit', '-m', 'fixture change'); return git('rev-parse', 'HEAD'); };
  return { repo, git, base, input, helper, commit };
}

describe('safe worktree integration helpers (disposable local Git repositories)', () => {
  it('creates a separate task branch at a pinned source and consumes its inputs', () => {
    const f = fixture();
    f.git('switch', '-c', 'source');
    const head = f.commit('tower.txt', 'tower\n');
    f.git('switch', 'master');
    f.input('branch-name', 'codex/land');
    f.input('branch-start', head);
    expect(f.helper('branch').status).toBe(0);
    expect(f.git('rev-parse', 'HEAD')).toBe(head);
    expect(f.git('branch', '--show-current')).toBe('codex/land');
    expect(existsSync(join(f.repo, 'recovery/codex-branch-start.txt'))).toBe(false);
  });
  it('rejects non-pinned branch start before changing branches', () => {
    const f = fixture();
    f.input('branch-name', 'codex/land');
    f.input('branch-start', 'master');
    expect(f.helper('branch').status).toBe(1);
    expect(f.git('branch', '--show-current')).toBe('master');
    expect(f.git('rev-parse', 'HEAD')).toBe(f.base);
  });
  it('prepares a divergent integration only on the task branch and preserves both parents', () => {
    const f = fixture();
    f.git('switch', '-c', 'source');
    const source = f.commit('capture.txt', 'capture\n');
    f.git('switch', '-c', 'codex/integrate', f.base);
    const task = f.commit('tower.txt', 'tower\n');
    f.input('integrate-source', source);
    expect(f.helper('merge').status).toBe(0);
    expect(f.git('branch', '--show-current')).toBe('codex/integrate');
    expect(f.git('rev-parse', 'master')).toBe(f.base);
    expect(f.git('rev-parse', 'MERGE_HEAD')).toBe(source);
    f.input('commit-message', 'merge: integrate fixture');
    expect(f.helper('commit').status).toBe(0);
    expect(f.git('show', '-s', '--format=%P', 'HEAD')).toBe(`${task} ${source}`);
  });
  it('rejects protected branch integration and dirty task checkouts', () => {
    const f = fixture();
    f.input('integrate-source', f.base);
    expect(f.helper('merge').status).toBe(1);
    f.git('switch', '-c', 'codex/integrate');
    writeFileSync(join(f.repo, 'shared.txt'), 'dirty\n');
    expect(f.helper('merge').status).toBe(1);
    expect(f.git('rev-parse', 'HEAD')).toBe(f.base);
    expect(existsSync(join(f.repo, '.git/MERGE_HEAD'))).toBe(false);
  });
  it('preflights conflicts without changing the checkout or creating merge state', () => {
    const f = fixture();
    f.git('switch', '-c', 'source');
    const source = f.commit('shared.txt', 'capture\n');
    f.git('switch', '-c', 'codex/integrate', f.base);
    const task = f.commit('shared.txt', 'tower\n');
    f.input('integrate-source', source);
    const result = f.helper('merge');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('preflight found conflicts');
    expect(f.git('rev-parse', 'HEAD')).toBe(task);
    expect(f.git('status', '--porcelain')).toBe('');
    expect(existsSync(join(f.repo, '.git/MERGE_HEAD'))).toBe(false);
  });
  it('keeps ordinary landing fast-forward-only and pushes the local test remote', () => {
    const f = fixture();
    f.git('switch', '-c', 'codex/land');
    const head = f.commit('tower.txt', 'tower\n');
    expect(f.helper('merge').status).toBe(0);
    expect(f.git('branch', '--show-current')).toBe('master');
    expect(f.git('rev-parse', 'master')).toBe(head);
    expect(f.git('rev-parse', 'origin/master')).toBe(head);
  });
});
