import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { FileFetcher, FileReadResult, FileWriteResult } from '@codeam/ide-core';
import { FileViewerProvider, useFileViewer } from './FileViewerContext';
import { FileViewerHost } from './FileViewerHost';
import type { WebViewStubElement } from '../test/setup';

const PATH = 'src/index.ts';
const VERDICT = "This session isn't responding — is it online?";

function Opener() {
  const { open } = useFileViewer();
  useEffect(() => open({ path: PATH, op: 'Write' }), [open]);
  return null;
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function mount(fetcher: FileFetcher) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(
      <FileViewerProvider fetcher={fetcher}>
        <Opener />
        <FileViewerHost />
      </FileViewerProvider>,
    );
  });
  return container;
}

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

const spinner = (c: HTMLElement) => c.querySelector('[data-rn="activity-indicator"]');
const webview = (c: HTMLElement) => c.querySelector<WebViewStubElement>('[data-rn="webview"]');
const bridge = (c: HTMLElement, msg: object) =>
  webview(c)!.__onMessage!({ nativeEvent: { data: JSON.stringify(msg) } });
const retryButton = (c: HTMLElement) =>
  Array.from(c.querySelectorAll('button')).find((b) => b.textContent === 'Retry') ?? null;
const occurrences = (haystack: string, needle: string) => haystack.split(needle).length - 1;

function makeFetcher(read: FileFetcher['read'], write?: FileFetcher['write']): FileFetcher {
  return {
    label: 'test',
    canWrite: true,
    read,
    write: write ?? (async () => ({}) as FileWriteResult),
  };
}

describe('FileViewerHost — read failure', () => {
  it('renders the fetcher verdict in the body with Retry, no spinner, and no duplicate bar', async () => {
    const read = vi.fn(async (): Promise<FileReadResult> => ({ error: VERDICT }));
    const c = await mount(makeFetcher(read));

    expect(read).toHaveBeenCalledTimes(1);
    expect(spinner(c)).toBeNull();
    expect(c.textContent).not.toContain('Fetching');
    expect(occurrences(c.textContent ?? '', VERDICT)).toBe(1);
    expect(retryButton(c)).not.toBeNull();
  });

  it('Retry re-runs fetcher.read, shows the loading state meanwhile, then renders the file', async () => {
    let resolveSecond: ((r: FileReadResult) => void) | null = null;
    const read = vi
      .fn<() => Promise<FileReadResult>>()
      .mockResolvedValueOnce({ error: VERDICT })
      .mockImplementationOnce(
        () =>
          new Promise<FileReadResult>((resolve) => {
            resolveSecond = resolve;
          }),
      );
    const c = await mount(makeFetcher(read));
    expect(retryButton(c)).not.toBeNull();

    await act(async () => retryButton(c)!.click());

    expect(read).toHaveBeenCalledTimes(2);
    expect(read).toHaveBeenLastCalledWith(PATH);
    expect(spinner(c)).not.toBeNull();
    expect(c.textContent).toContain(`Fetching ${PATH}`);
    expect(c.textContent).not.toContain(VERDICT);
    expect(retryButton(c)).toBeNull();

    await act(async () => resolveSecond!({ content: 'export const x = 1;\n' }));

    expect(spinner(c)).toBeNull();
    expect(webview(c)).not.toBeNull();
    expect(c.textContent).not.toContain(VERDICT);
  });

  it('a Retry that fails again shows the new verdict once, with Retry still available', async () => {
    const read = vi
      .fn<() => Promise<FileReadResult>>()
      .mockResolvedValueOnce({ error: VERDICT })
      .mockResolvedValueOnce({ error: 'Session is offline.' });
    const c = await mount(makeFetcher(read));

    await act(async () => retryButton(c)!.click());

    expect(read).toHaveBeenCalledTimes(2);
    expect(spinner(c)).toBeNull();
    expect(c.textContent).not.toContain(VERDICT);
    expect(occurrences(c.textContent ?? '', 'Session is offline.')).toBe(1);
    expect(retryButton(c)).not.toBeNull();
  });
});

describe('FileViewerHost — errors while a file is displayed', () => {
  it('a save failure goes to the top bar once and keeps the editor mounted', async () => {
    const read = vi.fn(async (): Promise<FileReadResult> => ({ content: 'hello' }));
    const write = vi.fn(
      async (): Promise<FileWriteResult> => ({ error: 'Save failed: disk full' }),
    );
    const c = await mount(makeFetcher(read, write));
    expect(webview(c)).not.toBeNull();

    // Same path Cmd+S takes inside Monaco: edit the buffer, then save.
    await act(async () => bridge(c, { type: 'change', value: 'hello world' }));
    await act(async () => bridge(c, { type: 'save' }));

    expect(write).toHaveBeenCalledWith(PATH, 'hello world');
    expect(webview(c)).not.toBeNull();
    expect(occurrences(c.textContent ?? '', 'Save failed: disk full')).toBe(1);
    expect(retryButton(c)).toBeNull();
    expect(spinner(c)).toBeNull();
  });
});
