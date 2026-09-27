import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { FileFetcher, GitProvider } from '@codeam/ide-core';

vi.mock('./ResilientWebView', () => ({ ResilientWebView: () => null }));
vi.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

import { DiffViewer } from './DiffViewer';

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

async function render(element: ReactElement) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root!.render(element));
}

const git = { diff: vi.fn().mockResolvedValue(null) } as unknown as GitProvider;
const fetcher = { readFile: vi.fn().mockResolvedValue('x') } as unknown as FileFetcher;

describe('DiffViewer badge (native)', () => {
  it('defaults to WORKING TREE', async () => {
    await render(<DiffViewer path="a.ts" git={git} fetcher={fetcher} />);
    expect(container!.textContent).toContain('WORKING TREE');
  });

  it('shows a caller badge instead — a PR diff is not the working tree', async () => {
    await render(<DiffViewer path="a.ts" git={git} fetcher={fetcher} badge="PR #212" />);
    expect(container!.textContent).toContain('PR #212');
    expect(container!.textContent).not.toContain('WORKING TREE');
  });

  it('hides the badge on null', async () => {
    await render(<DiffViewer path="a.ts" git={git} fetcher={fetcher} badge={null} />);
    expect(container!.textContent).not.toContain('WORKING TREE');
  });
});
