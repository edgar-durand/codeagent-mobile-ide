import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TerminalEvent, TerminalProvider, TerminalSession } from '@codeam/ide-core';
import { TerminalPanel } from './TerminalPanel';
import type { WebViewStubElement } from '../test/setup';

let container: HTMLDivElement;
let root: Root;

const session = (id: string): TerminalSession => ({ id });

function provider(overrides: Partial<TerminalProvider> = {}): TerminalProvider {
  return {
    open: vi.fn(async () => session('one')),
    write: vi.fn(async () => undefined),
    resize: vi.fn(async () => undefined),
    subscribe: vi.fn(() => () => undefined),
    close: vi.fn(async () => undefined),
    ...overrides,
  };
}

async function render(ui: ReactElement) {
  await act(async () => root.render(ui));
}

async function bridge(message: unknown) {
  const view = container.querySelector('[data-rn="webview"]') as WebViewStubElement;
  await act(async () => view.__onMessage?.({ nativeEvent: { data: JSON.stringify(message) } }));
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe('TerminalPanel session lifecycle', () => {
  it('opens only once for duplicate ready messages and closes on unmount', async () => {
    const adapter = provider();
    await render(<TerminalPanel provider={adapter} />);
    expect(container.querySelector('[data-testid="terminal-surface-loading"]')).not.toBeNull();

    await bridge({ type: 'ready', cols: 100, rows: 30 });
    await bridge({ type: 'ready', cols: 100, rows: 30 });
    expect(adapter.open).toHaveBeenCalledTimes(1);
    expect(adapter.open).toHaveBeenCalledWith({ cols: 100, rows: 30, cwd: undefined });

    await act(async () => root.unmount());
    expect(adapter.close).toHaveBeenCalledWith({ id: 'one' });
    root = createRoot(container);
  });

  it('closes the old provider session before connecting a replacement', async () => {
    const first = provider({ open: vi.fn(async () => session('first')) });
    const second = provider({ open: vi.fn(async () => session('second')) });
    await render(<TerminalPanel provider={first} />);
    await bridge({ type: 'ready' });

    await render(<TerminalPanel provider={second} />);
    expect(first.close).toHaveBeenCalledWith({ id: 'first' });
    expect(second.open).toHaveBeenCalledTimes(1);
  });

  it('closes a stale session whose open resolves after a provider change', async () => {
    let resolveOpen!: (value: TerminalSession) => void;
    const first = provider({
      open: vi.fn(() => new Promise<TerminalSession>((resolve) => (resolveOpen = resolve))),
    });
    const second = provider({ open: vi.fn(async () => session('second')) });
    await render(<TerminalPanel provider={first} />);
    await bridge({ type: 'ready' });
    await render(<TerminalPanel provider={second} />);
    await act(async () => resolveOpen(session('late')));

    expect(first.close).toHaveBeenCalledWith({ id: 'late' });
    expect(second.open).toHaveBeenCalledTimes(1);
  });

  it('surfaces write failures and reconnects on request', async () => {
    const adapter = provider({ write: vi.fn(async () => Promise.reject(new Error('offline'))) });
    await render(<TerminalPanel provider={adapter} />);
    await bridge({ type: 'ready' });
    await bridge({ type: 'data', data: 'ls\r' });

    expect(container.querySelector('[data-testid="terminal-error"]')?.textContent).toContain(
      'Terminal write failed: offline',
    );
    await act(async () => {
      (container.querySelector('[data-testid="terminal-reconnect"]') as HTMLElement).click();
    });
    expect(adapter.open).toHaveBeenCalledTimes(2);
  });

  it('surfaces open and resize failures with an accessible recovery action', async () => {
    const adapter = provider({
      open: vi
        .fn<() => Promise<TerminalSession>>()
        .mockRejectedValueOnce(new Error('shell unavailable'))
        .mockResolvedValue(session('recovered')),
      resize: vi.fn(async () => Promise.reject(new Error('pty gone'))),
    });
    await render(<TerminalPanel provider={adapter} />);
    await bridge({ type: 'ready' });
    expect(container.querySelector('[data-testid="terminal-error"]')?.textContent).toContain(
      'Could not open terminal: shell unavailable',
    );

    await act(async () => {
      (container.querySelector('[data-testid="terminal-reconnect"]') as HTMLElement).click();
    });
    await bridge({ type: 'resize', cols: 120, rows: 40 });
    expect(container.querySelector('[data-testid="terminal-error"]')?.textContent).toContain(
      'Terminal resize failed: pty gone',
    );
  });

  it('unsubscribes and ignores events from the replaced session', async () => {
    let oldHandler: ((event: TerminalEvent) => void) | undefined;
    const unsubscribe = vi.fn();
    const first = provider({
      subscribe: vi.fn((_session, handler) => {
        oldHandler = handler;
        return unsubscribe;
      }),
    });
    const second = provider();
    await render(<TerminalPanel provider={first} />);
    await bridge({ type: 'ready' });
    await render(<TerminalPanel provider={second} />);

    expect(unsubscribe).toHaveBeenCalledOnce();
    act(() => oldHandler?.({ type: 'exit', exitCode: 99 }));
    expect(container.textContent).not.toContain('exit 99');
  });
});
