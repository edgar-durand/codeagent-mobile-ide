import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { FileTreePayload, FileTreeProvider } from '@codeam/ide-core';
import { FileTreeSidebar } from './FileTreeSidebar';

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

async function render(element: ReactElement) {
  if (!container) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  }
  await act(async () => root!.render(element));
}

const payload = (...paths: string[]): FileTreePayload => ({
  files: paths.map((path) => ({ path, name: path.split('/').pop() ?? path, size: 1 })),
  truncated: false,
  root: '/workspace',
});

function findByText(text: string): HTMLElement | undefined {
  return Array.from(container!.querySelectorAll<HTMLElement>('*')).find(
    (el) => el.textContent?.trim() === text && el.children.length === 0,
  );
}

describe('FileTreeSidebar', () => {
  it('renders the tree returned by the provider', async () => {
    const provider: FileTreeProvider = { list: vi.fn().mockResolvedValue(payload('src/app.ts')) };

    await render(
      <FileTreeSidebar provider={provider} selectedPath={null} onSelect={() => undefined} />,
    );

    expect(findByText('src')).toBeTruthy();
    expect(container!.textContent).not.toContain('Loading workspace…');
  });

  it('surfaces a failed load with a retry affordance instead of an empty tree', async () => {
    const provider: FileTreeProvider = {
      list: vi.fn().mockRejectedValue(new Error('workspace offline')),
    };

    await render(
      <FileTreeSidebar provider={provider} selectedPath={null} onSelect={() => undefined} />,
    );

    const alert = container!.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('workspace offline');
    // The misleading "No files found." must not be shown when the real
    // reason the tree is empty is that the load failed.
    expect(container!.textContent).not.toContain('No files found.');
  });

  it('falls back to a generic message when the provider rejects with a non-Error', async () => {
    const provider: FileTreeProvider = { list: vi.fn().mockRejectedValue('nope') };

    await render(
      <FileTreeSidebar provider={provider} selectedPath={null} onSelect={() => undefined} />,
    );

    expect(container!.querySelector('[role="alert"]')?.textContent).toContain(
      'Unable to load workspace files.',
    );
  });

  it('refetches and clears the error when Retry is pressed', async () => {
    const list = vi
      .fn()
      .mockRejectedValueOnce(new Error('workspace offline'))
      .mockResolvedValueOnce(payload('README.md'));
    const provider: FileTreeProvider = { list };

    await render(
      <FileTreeSidebar provider={provider} selectedPath={null} onSelect={() => undefined} />,
    );
    expect(container!.querySelector('[role="alert"]')).toBeTruthy();

    const retry = container!.querySelector<HTMLButtonElement>(
      '[aria-label="Retry loading workspace files"]',
    );
    await act(async () => retry!.click());

    expect(list).toHaveBeenCalledTimes(2);
    expect(container!.querySelector('[role="alert"]')).toBeNull();
    expect(findByText('README.md')).toBeTruthy();
  });

  it('does not write the result of a load that was superseded by unmount', async () => {
    let resolveList: (value: FileTreePayload) => void = () => undefined;
    const provider: FileTreeProvider = {
      list: vi.fn().mockReturnValue(
        new Promise<FileTreePayload>((resolve) => {
          resolveList = resolve;
        }),
      ),
    };
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await render(
      <FileTreeSidebar provider={provider} selectedPath={null} onSelect={() => undefined} />,
    );
    await act(async () => root!.unmount());
    root = null;

    await act(async () => {
      resolveList(payload('late.ts'));
    });

    // React logs "state update on unmounted component" through console.error;
    // a clean teardown means it never fires.
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
