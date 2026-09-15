import { afterEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { IDEThemeProvider, useIDETheme, type IDETheme } from './theme';

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('IDEThemeProvider', () => {
  it('merges partial semantic overrides without dropping defaults', async () => {
    const observed: { current?: IDETheme } = {};
    function Probe() {
      observed.current = useIDETheme();
      return null;
    }
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root!.render(
        <IDEThemeProvider theme={{ colors: { accent: '#123456' }, minimumTouchSize: 48 }}>
          <Probe />
        </IDEThemeProvider>,
      );
    });

    expect(observed.current?.colors.accent).toBe('#123456');
    expect(observed.current?.colors.surface).toBe('#0d1117');
    expect(observed.current?.minimumTouchSize).toBe(48);
    expect(observed.current?.spacing.md).toBe(12);
  });
});
