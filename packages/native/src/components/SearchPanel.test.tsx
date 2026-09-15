import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SearchProvider } from '@codeam/ide-core';
import { SearchPanel } from './SearchPanel';

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function mount(
  provider: SearchProvider,
  confirmReplace?: (message: string, confirm: () => void) => void,
) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(
      <SearchPanel
        provider={provider}
        onOpen={vi.fn()}
        initialQuery="needle"
        confirmReplace={confirmReplace}
      />,
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

describe('SearchPanel failures and replacement', () => {
  it('shows a search failure and retries it', async () => {
    const search = vi
      .fn<SearchProvider['search']>()
      .mockRejectedValueOnce(new Error('Search service offline'))
      .mockRejectedValueOnce(new Error('Search still offline'));
    const c = await mount({ search });

    expect(c.textContent).toContain('Search service offline');
    const retry = Array.from(c.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Retry'),
    );
    await act(async () => retry!.click());

    expect(search).toHaveBeenCalledTimes(2);
    expect(c.textContent).toContain('Search still offline');
  });

  it('requires confirmation before replacing all matches', async () => {
    const search = vi
      .fn<SearchProvider['search']>()
      .mockResolvedValue({ hits: [], total: 0, truncated: false });
    const replace = vi.fn<NonNullable<SearchProvider['replace']>>().mockResolvedValue({
      filesChanged: 1,
      replaced: 1,
    });
    let approve: (() => void) | undefined;
    const confirmReplace = vi.fn((_: string, confirm: () => void) => {
      approve = confirm;
    });
    const c = await mount({ search, replace }, confirmReplace);
    const toggle = Array.from(c.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('⇄'),
    );
    await act(async () => toggle!.click());
    const all = Array.from(c.querySelectorAll('button')).find(
      (button) => button.textContent === 'All',
    );
    await act(async () => all!.click());

    expect(confirmReplace).toHaveBeenCalledWith(
      expect.stringContaining('0 matches'),
      expect.any(Function),
    );
    expect(replace).not.toHaveBeenCalled();
    await act(async () => approve!());
    expect(replace).toHaveBeenCalledTimes(1);
  });
});
