import { useId, useState } from 'react';

const PAGE_INTRO_STORAGE_KEY = 'farmrpg-tools.page-intro-collapsed.v1';

type PageIntroProps = {
  title: string;
  description: string;
  storageKey?: string;
};

function createFallbackStorageKey(title: string): string {
  const normalizedTitle = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalizedTitle || 'page';
}

function readCollapsedState(storageKey: string): boolean {
  if (!('localStorage' in globalThis)) {
    return false;
  }

  try {
    const rawValue = globalThis.localStorage.getItem(PAGE_INTRO_STORAGE_KEY);
    const parsedValue: unknown = rawValue ? JSON.parse(rawValue) : {};

    if (!parsedValue || typeof parsedValue !== 'object') {
      return false;
    }

    return Boolean((parsedValue as Record<string, unknown>)[storageKey]);
  } catch {
    return false;
  }
}

function writeCollapsedState(storageKey: string, isCollapsed: boolean): void {
  if (!('localStorage' in globalThis)) {
    return;
  }

  try {
    const rawValue = globalThis.localStorage.getItem(PAGE_INTRO_STORAGE_KEY);
    const parsedValue: unknown = rawValue ? JSON.parse(rawValue) : {};
    const nextState =
      parsedValue && typeof parsedValue === 'object' ? { ...(parsedValue as Record<string, unknown>) } : {};

    if (isCollapsed) {
      nextState[storageKey] = true;
    } else {
      delete nextState[storageKey];
    }

    globalThis.localStorage.setItem(PAGE_INTRO_STORAGE_KEY, JSON.stringify(nextState));
  } catch {
    // Intro preferences are convenience-only; storage failures should not block page use.
  }
}

export function PageIntro({ title, description, storageKey }: PageIntroProps) {
  const titleId = useId();
  const contentId = useId();
  const resolvedStorageKey = storageKey ?? createFallbackStorageKey(title);
  const [isExpanded, setIsExpanded] = useState(() => !readCollapsedState(resolvedStorageKey));

  function handleToggle() {
    setIsExpanded((currentValue) => {
      const nextValue = !currentValue;
      writeCollapsedState(resolvedStorageKey, !nextValue);
      return nextValue;
    });
  }

  return (
    <section className="page-card page-intro" aria-labelledby={titleId}>
      <div className="page-intro__header">
        <h1 id={titleId}>{title}</h1>
        <button
          type="button"
          className="button page-intro__toggle"
          aria-controls={contentId}
          aria-expanded={isExpanded}
          onClick={handleToggle}
        >
          {isExpanded ? 'Hide intro' : 'Show intro'}
        </button>
      </div>
      <p id={contentId} className="page-intro__description" hidden={!isExpanded}>
        {description}
      </p>
    </section>
  );
}
