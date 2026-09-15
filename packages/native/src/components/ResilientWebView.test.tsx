import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ResilientWebView } from './ResilientWebView';

/**
 * The black-void defect, pinned.
 *
 * Every content surface in this package is a WebView, and until 2026-09-15
 * none of them handled a single failure mode. A dead WebView renders as an
 * empty rectangle — on this dark theme, a black void with no message and no
 * way out, while the native chrome around it kept updating as if fine.
 * Production replay 01a0a134-e10b-78b0-b8fd-da437b9d267a (Android, 4.0.1):
 * `CHANGES 3` above a black rectangle, 21 dead-tap bursts, user left.
 *
 * What these tests defend is one sentence: **something is always on screen.**
 */

let container: HTMLDivElement;
let root: Root;

function mount(ui: ReactElement) {
  act(() => {
    root.render(ui);
  });
}

/** The stub WebView exposes its handlers so a test can kill it on demand. */
let handlers: Record<string, ((e?: unknown) => unknown) | undefined> = {};

vi.mock('react-native-webview', () => ({
  WebView: (props: Record<string, unknown>) => {
    handlers = props as typeof handlers;
    return null;
  },
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

const q = (tid: string) => container.querySelector(`[data-testid="${tid}"]`);

beforeEach(() => {
  vi.useFakeTimers();
  handlers = {};
  container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container);
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe('a surface that boots normally', () => {
  it('shows a spinner first, then gets out of the way', () => {
    mount(<ResilientWebView testID="s" source={{ html: '<p>ok</p>' }} />);
    expect(q('s-loading')).not.toBeNull();

    act(() => {
      handlers.onLoadEnd?.();
    });
    expect(q('s-loading')).toBeNull();
    expect(q('s-error')).toBeNull();
  });

  it('waits for the embedded bridge when bridge readiness is enabled', () => {
    mount(
      <ResilientWebView
        testID="s"
        bridgeReadyGeneration={undefined}
        source={{ html: '<p>ok</p>' }}
      />,
    );
    act(() => handlers.onLoadEnd?.());
    expect(q('s-loading')).toBeNull();

    mount(
      <ResilientWebView
        key="controlled"
        testID="s"
        waitForBridgeReady
        bridgeReadyGeneration={-1}
        source={{ html: '' }}
      />,
    );
    act(() => handlers.onLoadEnd?.());
    expect(q('s-loading')).not.toBeNull();

    mount(
      <ResilientWebView
        key="controlled"
        testID="s"
        waitForBridgeReady
        bridgeReadyGeneration={0}
        source={{ html: '' }}
      />,
    );
    expect(q('s-loading')).toBeNull();
  });
});

describe('a surface that dies', () => {
  /**
   * Android reclaims WebView renderer processes under memory pressure — the
   * single likeliest trigger of the production incident. That is transient,
   * so the first death is rebuilt silently rather than shown to the user.
   */
  it('rebuilds itself silently the first time the renderer is reclaimed', () => {
    const onSurfaceError = vi.fn();
    mount(<ResilientWebView testID="s" onSurfaceError={onSurfaceError} source={{ html: '' }} />);
    act(() => {
      handlers.onLoadEnd?.();
    });

    act(() => {
      handlers.onRenderProcessGone?.();
    });

    expect(onSurfaceError).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'renderer-gone', recovered: true }),
    );
    // Back to loading — not an error card the user has to dismiss.
    expect(q('s-loading')).not.toBeNull();
    expect(q('s-error')).toBeNull();
  });

  it('stops hiding it when the renderer dies AGAIN — that is not transient', () => {
    mount(<ResilientWebView testID="s" surfaceLabel="file" source={{ html: '' }} />);
    act(() => handlers.onLoadEnd?.());
    act(() => {
      handlers.onRenderProcessGone?.();
    });
    act(() => handlers.onLoadEnd?.());
    act(() => {
      handlers.onRenderProcessGone?.();
    });

    expect(q('s-error')).not.toBeNull();
    expect(container.textContent).toContain('This file stopped responding');
    expect(q('s-retry')).not.toBeNull();
  });

  it('ignores load completion from a WebView generation that already failed', () => {
    mount(<ResilientWebView testID="s" source={{ html: '' }} />);
    const staleLoadEnd = handlers.onLoadEnd;
    act(() => handlers.onError?.({ nativeEvent: {} }));
    expect(q('s-loading')).not.toBeNull();

    act(() => staleLoadEnd?.());
    expect(q('s-loading')).not.toBeNull();
  });

  it('tells the platform it handled the death, so RN is not torn down with the view', () => {
    mount(<ResilientWebView testID="s" source={{ html: '' }} />);
    let returned: unknown;
    act(() => {
      returned = handlers.onRenderProcessGone?.();
    });
    expect(returned).toBe(true);
  });

  it.each([
    ['onError', 'load-error'],
    ['onHttpError', 'http-error'],
  ])('surfaces %s after its silent retry is spent', (handler, reason) => {
    const onSurfaceError = vi.fn();
    mount(<ResilientWebView testID="s" onSurfaceError={onSurfaceError} source={{ html: '' }} />);
    act(() => handlers[handler]?.({ nativeEvent: {} }));
    act(() => handlers[handler]?.({ nativeEvent: {} }));
    expect(q('s-error')).not.toBeNull();
    expect(onSurfaceError).toHaveBeenLastCalledWith(
      expect.objectContaining({ reason, recovered: false }),
    );
  });
});

describe('a surface that never finishes loading', () => {
  /**
   * The flaw the first version of this component shipped with: replacing a
   * black void with a spinner that hangs forever tells the user exactly as
   * little. A surface that cannot prove it loaded is a surface that failed.
   */
  it('gives up and says so instead of spinning forever', () => {
    mount(<ResilientWebView testID="s" surfaceLabel="terminal" source={{ html: '' }} />);
    expect(q('s-loading')).not.toBeNull();

    // First timeout is spent on a silent rebuild…
    act(() => vi.advanceTimersByTime(12_000));
    expect(q('s-loading')).not.toBeNull();
    // …the second is reported.
    act(() => vi.advanceTimersByTime(12_000));

    expect(q('s-error')).not.toBeNull();
    expect(container.textContent).toContain('This terminal stopped responding');
  });

  it('disarms the watchdog once the surface loads', () => {
    mount(<ResilientWebView testID="s" source={{ html: '' }} />);
    act(() => handlers.onLoadEnd?.());
    act(() => vi.advanceTimersByTime(60_000));
    expect(q('s-error')).toBeNull();
  });
});

describe('recovering by hand', () => {
  it('Reload clears the error and gives the surface a fresh budget', () => {
    mount(<ResilientWebView testID="s" source={{ html: '' }} />);
    act(() => handlers.onError?.({ nativeEvent: {} }));
    act(() => handlers.onError?.({ nativeEvent: {} }));
    expect(q('s-error')).not.toBeNull();

    act(() => {
      (q('s-retry') as HTMLElement).click();
    });
    expect(q('s-error')).toBeNull();
    expect(q('s-loading')).not.toBeNull();

    // Fresh budget: one more silent recovery is available again.
    act(() => handlers.onError?.({ nativeEvent: {} }));
    expect(q('s-error')).toBeNull();
  });
});
