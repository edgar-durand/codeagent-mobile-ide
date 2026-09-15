import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GitProvider } from '@codeam/ide-core';
import { SourceControlPanel } from './SourceControlPanel';

let root: Root | null = null;
let container: HTMLDivElement | null = null;

const remainingMethods: Omit<GitProvider, 'status'> = {
  diff: async () => null,
  stage: async () => undefined,
  unstage: async () => undefined,
  commit: async () => ({ sha: 'abc1234' }),
  push: async () => ({ ok: true }),
  fetch: async () => ({ ok: true }),
};

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('SourceControlPanel status failures', () => {
  it('shows a rejected status request and retries it', async () => {
    const status = vi
      .fn<GitProvider['status']>()
      .mockRejectedValueOnce(new Error('Git backend unavailable'))
      .mockRejectedValueOnce(new Error('Git backend still unavailable'));
    const provider: GitProvider = { status, ...remainingMethods };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root!.render(<SourceControlPanel provider={provider} />));

    expect(container.textContent).toContain('Git backend unavailable');
    const retry = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Retry'),
    );
    await act(async () => retry!.click());

    expect(status).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('Git backend still unavailable');
  });
});
