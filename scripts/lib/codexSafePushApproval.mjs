export const protectedPushApprovalFileName = 'codex-protected-push-approval.txt';

export function buildProtectedPushApprovalText({ branch, head }) {
  return [`branch=${branch}`, `head=${head}`, `approve=push protected branch ${branch}`].join('\n');
}

export function parseProtectedPushApproval(text) {
  const fields = new Map();

  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      return {
        ok: false,
        reason: `Approval line '${line}' must use key=value format.`,
      };
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    fields.set(key, value);
  }

  return {
    ok: true,
    fields,
  };
}

export function validateProtectedPushApproval({ text, branch, head }) {
  const parsed = parseProtectedPushApproval(text);
  if (!parsed.ok) {
    return parsed;
  }

  const expectedApprove = `push protected branch ${branch}`;
  const actualBranch = parsed.fields.get('branch');
  const actualHead = parsed.fields.get('head');
  const actualApprove = parsed.fields.get('approve');

  if (actualBranch !== branch) {
    return {
      ok: false,
      reason: `Protected push approval branch must be '${branch}'.`,
    };
  }

  if (actualHead !== head) {
    return {
      ok: false,
      reason: `Protected push approval head must match current HEAD '${head}'.`,
    };
  }

  if (actualApprove !== expectedApprove) {
    return {
      ok: false,
      reason: `Protected push approval must include approve=${expectedApprove}.`,
    };
  }

  return {
    ok: true,
  };
}
