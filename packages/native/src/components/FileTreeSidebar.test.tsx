import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FileTreeProvider } from '@codeam/ide-core';
import { FileTreeSidebar } from './FileTreeSidebar';

vi.mock('react-native-svg', () => ({ SvgUri: () => null }));

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function mount(provider: FileTreeProvider) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(<FileTreeSidebar provider={provider} selectedPath={null} onSelect={vi.fn()} />);
  });
  return container;
}

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('FileTreeSidebar failures', () => {
  it('shows the provider failure and retries it', async () => {
    const list = vi
      .fn<FileTreeProvider['list']>()
      .mockRejectedValueOnce(new Error('Workspace disconnected'))
      .mockRejectedValueOnce(new Error('Still disconnected'));
    const c = await mount({ list });

    expect(c.textContent).toContain('Workspace disconnected');
    expect(c.textContent).not.toContain('No files found.');
    const retry = Array.from(c.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Retry'),
    );
    expect(retry).toBeDefined();

    await act(async () => retry!.click());

    expect(list).toHaveBeenCalledTimes(2);
    expect(c.textContent).toContain('Still disconnected');
    expect(c.textContent).not.toContain('No files found.');
  });
});
