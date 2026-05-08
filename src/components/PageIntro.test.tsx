import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { PageIntro } from './PageIntro';

describe('PageIntro', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('starts expanded and remembers a collapsed page intro per storage key', async () => {
    const user = userEvent.setup();
    const description = 'Use this page to check the next useful local planning step.';

    const { unmount } = render(
      <PageIntro title="Test Page" description={description} storageKey="test-page" />,
    );

    expect(screen.getByText(description)).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Hide intro' }));

    expect(screen.queryByText(description)).not.toBeVisible();

    unmount();

    render(<PageIntro title="Test Page" description={description} storageKey="test-page" />);

    expect(screen.queryByText(description)).not.toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Show intro' }));

    expect(screen.getByText(description)).toBeVisible();
  });
});
