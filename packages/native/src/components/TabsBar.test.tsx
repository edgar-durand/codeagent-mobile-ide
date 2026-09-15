import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Alert } from 'react-native';
import { TabsBar } from './TabsBar';

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.mocked(Alert.alert).mockClear();
});

describe('TabsBar', () => {
  it('requires confirmation before closing a dirty tab', async () => {
    const onClose = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root!.render(
        <TabsBar
          tabs={[{ id: 'a', label: 'dirty.ts', dirty: true }]}
          activeId="a"
          onSelect={() => undefined}
          onClose={onClose}
        />,
      );
    });

    const close = container.querySelector<HTMLButtonElement>('[aria-label="Close dirty.ts"]');
    await act(async () => close?.click());

    expect(onClose).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledOnce();
    const buttons = vi.mocked(Alert.alert).mock.calls[0]?.[2];
    const discard = buttons?.find((button) => button.style === 'destructive');
    await act(async () => discard?.onPress?.());
    expect(onClose).toHaveBeenCalledWith('a');
  });
});
