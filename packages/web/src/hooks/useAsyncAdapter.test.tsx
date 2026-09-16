import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, useEffect, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { runCancellable, type AsyncAdapterHandle } from '@codeam/ide-core';
import { useAsyncAdapter } from './useAsyncAdapter';

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

interface Adapter {
  id: string;
}

/** Renders the hook and hands the live handle back to the test. */
function Probe({
  adapter,
  onRender,
}: {
  adapter: Adapter;
  onRender: (handle: AsyncAdapterHandle<Adapter>) => void;
}) {
  const handle = useAsyncAdapter(adapter);
  onRender(handle);
  return null;
}

async function render(element: ReactElement) {
  if (!root) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  }
  await act(async () => root!.render(element));
}

describe('useAsyncAdapter', () => {
  it('exposes the newest adapter through adapterRef', async () => {
    const handles: Array<AsyncAdapterHandle<Adapter>> = [];
    const first = { id: 'first' };
    const second = { id: 'second' };

    await render(<Probe adapter={first} onRender={(h) => handles.push(h)} />);
    expect(handles.at(-1)!.adapterRef.current).toBe(first);

    await render(<Probe adapter={second} onRender={(h) => handles.push(h)} />);
    expect(handles.at(-1)!.adapterRef.current).toBe(second);
  });

  it('bumps reloadCount on reload and keeps reload stable across renders', async () => {
    const handles: Array<AsyncAdapterHandle<Adapter>> = [];

    await render(<Probe adapter={{ id: 'only' }} onRender={(h) => handles.push(h)} />);
    const initial = handles.at(-1)!;
    expect(initial.reloadCount).toBe(0);

    await act(async () => initial.reload());
    const afterReload = handles.at(-1)!;
    expect(afterReload.reloadCount).toBe(1);
    expect(afterReload.reload).toBe(initial.reload);
  });

  it('re-runs a reloadCount-keyed effect once per reload', async () => {
    const load = vi.fn();
    let triggerReload: () => void = () => undefined;

    function Consumer({ adapter }: { adapter: Adapter }) {
      const { adapterRef, reloadCount, reload } = useAsyncAdapter(adapter);
      triggerReload = reload;
      useEffect(
        () =>
          runCancellable(() => {
            load(adapterRef.current.id, reloadCount);
          }),
        [reloadCount, adapterRef],
      );
      return null;
    }

    await render(<Consumer adapter={{ id: 'git' }} />);
    expect(load.mock.calls).toEqual([['git', 0]]);

    await act(async () => triggerReload());
    expect(load.mock.calls).toEqual([
      ['git', 0],
      ['git', 1],
    ]);
  });

  it('does not re-run the effect when a re-allocated adapter is swapped in', async () => {
    const load = vi.fn();

    function Consumer({ adapter }: { adapter: Adapter }) {
      const { adapterRef, reloadCount } = useAsyncAdapter(adapter);
      useEffect(
        () =>
          runCancellable(() => {
            load(adapterRef.current.id);
          }),
        [reloadCount, adapterRef],
      );
      return null;
    }

    // The invariant consumers are warned about: a fresh adapter object on
    // every render must not send the panel into a refetch loop.
    await render(<Consumer adapter={{ id: 'workspace' }} />);
    await render(<Consumer adapter={{ id: 'workspace' }} />);
    await render(<Consumer adapter={{ id: 'workspace' }} />);

    expect(load).toHaveBeenCalledTimes(1);
  });
});
