import { afterEach, describe, expect, it, vi } from 'vitest';
import { runCancellable } from './async-adapter';

afterEach(() => {
  vi.restoreAllMocks();
});

/** Resolves after the current microtask queue drains. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('runCancellable', () => {
  it('runs the effect synchronously up to its first await', () => {
    const before = vi.fn();
    runCancellable(async () => {
      before();
      await Promise.resolve();
    });
    expect(before).toHaveBeenCalledTimes(1);
  });

  it('reports not-cancelled while the run is live', async () => {
    const seen: boolean[] = [];
    runCancellable(async (isCancelled) => {
      seen.push(isCancelled());
      await Promise.resolve();
      seen.push(isCancelled());
    });
    await flush();
    expect(seen).toEqual([false, false]);
  });

  it('reports cancelled to work still in flight after teardown', async () => {
    let resolveRead: (value: string) => void = () => undefined;
    const pending = new Promise<string>((resolve) => {
      resolveRead = resolve;
    });
    const commit = vi.fn();

    const cancel = runCancellable(async (isCancelled) => {
      const value = await pending;
      if (isCancelled()) return;
      commit(value);
    });

    cancel();
    resolveRead('too late');
    await flush();

    expect(commit).not.toHaveBeenCalled();
  });

  it('leaves a run that finished before teardown untouched', async () => {
    const commit = vi.fn();
    const cancel = runCancellable(async (isCancelled) => {
      const value = await Promise.resolve('in time');
      if (isCancelled()) return;
      commit(value);
    });

    await flush();
    cancel();

    expect(commit).toHaveBeenCalledWith('in time');
  });

  it('cancels each run independently', async () => {
    const commit = vi.fn();
    const start = (label: string) =>
      runCancellable(async (isCancelled) => {
        await Promise.resolve();
        if (isCancelled()) return;
        commit(label);
      });

    const cancelFirst = start('first');
    start('second');
    cancelFirst();
    await flush();

    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith('second');
  });

  it('logs — rather than dropping — an error escaping an async effect', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    runCancellable(async () => {
      await Promise.resolve();
      throw new Error('adapter exploded');
    });
    await flush();
    expect(consoleError).toHaveBeenCalledWith(
      '[runCancellable] uncaught error in async effect:',
      expect.objectContaining({ message: 'adapter exploded' }),
    );
  });

  it('logs — rather than rethrowing — an error thrown before the first await', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() =>
      runCancellable(() => {
        throw new Error('sync boom');
      }),
    ).not.toThrow();
    expect(consoleError).toHaveBeenCalledWith(
      '[runCancellable] uncaught error in async effect:',
      expect.objectContaining({ message: 'sync boom' }),
    );
  });

  it('still returns a usable teardown when the effect throws synchronously', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const cancel = runCancellable(() => {
      throw new Error('sync boom');
    });
    expect(() => cancel()).not.toThrow();
  });
});
