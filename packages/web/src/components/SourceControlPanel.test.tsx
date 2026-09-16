import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { GitProvider, GitStatusPayload } from '@codeam/ide-core';
import { SourceControlPanel } from './SourceControlPanel';

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

const status = (branch: string): GitStatusPayload => ({
  branch,
  upstream: null,
  ahead: 0,
  behind: 0,
  entries: [{ code: ' M', path: 'src/app.ts', staged: false, conflict: false }],
  hasMergeInProgress: false,
});

/** The minimum a GitProvider has to implement; `log` and `pull` are optional by contract. */
function gitProvider(overrides: Partial<GitProvider> = {}): GitProvider {
  return {
    status: vi.fn().mockResolvedValue(status('feature/xyz')),
    diff: vi.fn().mockResolvedValue(null),
    stage: vi.fn().mockResolvedValue(undefined),
    unstage: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue({ sha: 'abc1234' }),
    push: vi.fn().mockResolvedValue({ ok: true as const }),
    fetch: vi.fn().mockResolvedValue({ ok: true as const }),
    ...overrides,
  };
}

/** The branch only surfaces through the commit input's placeholder. */
function commitInput(): HTMLInputElement {
  return container!.querySelector<HTMLInputElement>('input[type="text"]')!;
}

async function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )?.set;
  await act(async () => {
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('SourceControlPanel', () => {
  it('renders the branch reported by the provider', async () => {
    await render(<SourceControlPanel provider={gitProvider()} />);
    expect(commitInput().placeholder).toContain('feature/xyz');
  });

  it('loads history when the provider implements log', async () => {
    const log = vi.fn().mockResolvedValue([{ sha: 'abc1234', subject: 'first', author: 'a' }]);
    await render(<SourceControlPanel provider={gitProvider({ log })} />);
    expect(log).toHaveBeenCalledWith(30);
  });

  it('loads status without throwing when the provider omits the optional log method', async () => {
    // Guards the `git.log?.(30).then(...)` optional-call chain: when `log`
    // is absent the whole chain has to short-circuit, not blow up on
    // `.then` of undefined.
    const provider = gitProvider();
    expect(provider.log).toBeUndefined();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await render(<SourceControlPanel provider={provider} />);

    expect(provider.status).toHaveBeenCalledTimes(1);
    expect(consoleError).not.toHaveBeenCalled();
    expect(commitInput().placeholder).toContain('feature/xyz');
    consoleError.mockRestore();
  });

  it('refetches status after a successful commit', async () => {
    const provider = gitProvider();
    await render(<SourceControlPanel provider={provider} />);
    expect(provider.status).toHaveBeenCalledTimes(1);

    await type(commitInput(), 'feat: something');
    const commitButton = container!.querySelector<HTMLButtonElement>('[aria-label="Commit"]')!;
    await act(async () => commitButton.click());

    expect(provider.commit).toHaveBeenCalledWith({ message: 'feat: something', all: true });
    // reload() bumps reloadCount, which the status effect is keyed off.
    expect(provider.status).toHaveBeenCalledTimes(2);
  });

  it('does not write the result of a status call superseded by unmount', async () => {
    let resolveStatus: (value: GitStatusPayload) => void = () => undefined;
    const provider = gitProvider({
      status: vi.fn().mockReturnValue(
        new Promise<GitStatusPayload>((resolve) => {
          resolveStatus = resolve;
        }),
      ),
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await render(<SourceControlPanel provider={provider} />);
    await act(async () => root!.unmount());
    root = null;

    await act(async () => {
      resolveStatus(status('late'));
    });

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
