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

describe('runCancellable with an effect-owned teardown', () => {
  it("runs the effect's own teardown alongside cancellation", () => {
    const unsubscribe = vi.fn();
    const cancel = runCancellable(() => unsubscribe);

    expect(unsubscribe).not.toHaveBeenCalled();
    cancel();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('cancels in-flight work even when the effect also owns a subscription', async () => {
    const unsubscribe = vi.fn();
    const commit = vi.fn();
    let resolveGet: (value: string) => void = () => undefined;
    const pending = new Promise<string>((resolve) => {
      resolveGet = resolve;
    });

    const cancel = runCancellable((isCancelled) => {
      void pending.then((value) => {
        if (isCancelled()) return;
        commit(value);
      });
      return unsubscribe;
    });

    cancel();
    resolveGet('too late');
    await flush();

    expect(commit).not.toHaveBeenCalled();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('keeps cancelling when the effect-owned teardown throws', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let cancelledAfterTeardown: boolean | null = null;

    const cancel = runCancellable((isCancelled) => {
      void Promise.resolve().then(() => {
        cancelledAfterTeardown = isCancelled();
      });
      return () => {
        throw new Error('unsubscribe exploded');
      };
    });

    expect(() => cancel()).not.toThrow();
    expect(consoleError).toHaveBeenCalledWith(
      '[runCancellable] uncaught error in effect teardown:',
      expect.objectContaining({ message: 'unsubscribe exploded' }),
    );

    return flush().then(() => {
      expect(cancelledAfterTeardown).toBe(true);
    });
  });

  it('treats a returned function as teardown, not as a resolved promise', () => {
    // Guards the `typeof result === 'function'` branch: a sync effect
    // returning a cleanup must never be mistaken for a thenable.
    const unsubscribe = vi.fn();
    const cancel = runCancellable(() => unsubscribe);
    cancel();
    cancel();
    // Teardown is invoked once per cancel call; React only calls it once.
    expect(unsubscribe).toHaveBeenCalledTimes(2);
  });
});
