import { describe, expect, it } from 'vitest';

import {
  buildProtectedPushApprovalText,
  parseProtectedPushApproval,
  validateProtectedPushApproval,
} from './codexSafePushApproval.mjs';

describe('codex safe push approval', () => {
  it('builds and validates exact protected-branch approval text', () => {
    const text = buildProtectedPushApprovalText({
      branch: 'master',
      head: 'abc123',
    });

    expect(text).toBe('branch=master\nhead=abc123\napprove=push protected branch master');
    expect(
      validateProtectedPushApproval({
        text,
        branch: 'master',
        head: 'abc123',
      }),
    ).toEqual({ ok: true });
  });

  it('rejects stale approval for a different head', () => {
    const text = buildProtectedPushApprovalText({
      branch: 'master',
      head: 'old',
    });

    expect(
      validateProtectedPushApproval({
        text,
        branch: 'master',
        head: 'new',
      }),
    ).toEqual({
      ok: false,
      reason: "Protected push approval head must match current HEAD 'new'.",
    });
  });

  it('rejects approval for a different branch', () => {
    const text = buildProtectedPushApprovalText({
      branch: 'main',
      head: 'abc123',
    });

    expect(
      validateProtectedPushApproval({
        text,
        branch: 'master',
        head: 'abc123',
      }),
    ).toEqual({
      ok: false,
      reason: "Protected push approval branch must be 'master'.",
    });
  });

  it('rejects malformed approval lines', () => {
    expect(parseProtectedPushApproval('branch master')).toEqual({
      ok: false,
      reason: "Approval line 'branch master' must use key=value format.",
    });
  });
});
