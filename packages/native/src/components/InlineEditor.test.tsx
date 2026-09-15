import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { FileFetcher } from '@codeam/ide-core';
import { InlineEditor } from './InlineEditor';

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function Harness({ fetcher }: { fetcher: FileFetcher }) {
  const [buffers, setBuffers] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, string>>({});
  return (
    <InlineEditor
      fetcher={fetcher}
      path="src/index.ts"
      buffers={buffers}
      setBuffers={setBuffers}
      saved={saved}
      setSaved={setSaved}
    />
  );
}

async function render(fetcher: FileFetcher) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root!.render(<Harness fetcher={fetcher} />));
  return container;
}

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('InlineEditor', () => {
  it('shows a retryable read error instead of an endless spinner', async () => {
    const read = vi
      .fn<FileFetcher['read']>()
      .mockRejectedValueOnce(new Error('Session offline'))
      .mockResolvedValueOnce({ content: 'export const ready = true;' });
    const fetcher: FileFetcher = {
      label: 'workspace-a',
      canWrite: true,
      read,
      write: vi.fn(async () => ({})),
    };
    const view = await render(fetcher);

    expect(view.textContent).toContain('Session offline');
    const retry = Array.from(view.querySelectorAll('button')).find(
      (button) => button.textContent === 'Retry',
    );
    expect(retry).toBeDefined();

    await act(async () => {
      retry?.click();
      await Promise.resolve();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(read).toHaveBeenCalledTimes(2);
    expect(view.querySelector('[data-rn="webview"]')).not.toBeNull();
  });
});
