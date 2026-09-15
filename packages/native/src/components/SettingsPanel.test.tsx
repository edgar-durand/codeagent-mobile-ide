import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SettingsStore } from '@codeam/ide-core';
import { SettingsPanel } from './SettingsPanel';

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function mount(store: SettingsStore) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root!.render(<SettingsPanel store={store} marketplaceThemes={[]} />));
  return container;
}

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('SettingsPanel persistence failures', () => {
  it('shows a store load failure as an accessible alert', async () => {
    const store: SettingsStore = {
      get: vi.fn(async () => {
        throw new Error('Storage unavailable');
      }),
      set: vi.fn(async () => undefined),
      watch: vi.fn(() => () => undefined),
    };

    const panel = await mount(store);

    expect(panel.querySelector('[role="alert"]')?.textContent).toBe('Storage unavailable');
  });

  it('keeps the selected theme unchanged when persistence fails', async () => {
    const store: SettingsStore = {
      get: vi.fn(async (key) =>
        key === 'editor'
          ? {
              theme: 'vs-dark',
              fontSize: 13,
              tabSize: 2,
              wordWrap: true,
              minimap: false,
              lineNumbers: true,
            }
          : [],
      ),
      set: vi.fn(async () => {
        throw new Error('Disk full');
      }),
      watch: vi.fn(() => () => undefined),
    };
    const panel = await mount(store);
    const lightTheme = panel.querySelector<HTMLButtonElement>(
      '[aria-label="Color theme Light (Visual Studio)"]',
    );

    await act(async () => lightTheme!.click());

    expect(lightTheme?.getAttribute('aria-checked')).not.toBe('true');
    expect(panel.querySelector('[role="alert"]')?.textContent).toBe('Disk full');
  });
});
