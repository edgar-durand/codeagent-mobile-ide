import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MARKETPLACE_DOWNLOAD_MAX_BYTES,
  downloadMarketplaceJson,
  isVSCodeColorTheme,
  isVSCodeIconTheme,
} from './marketplaceDownload';

afterEach(() => vi.unstubAllGlobals());

describe('marketplace downloads', () => {
  it('accepts structurally valid color and icon themes', () => {
    expect(isVSCodeColorTheme({ colors: { foreground: '#fff' } })).toBe(true);
    expect(isVSCodeIconTheme({ iconDefinitions: { file: { iconPath: './file.svg' } } })).toBe(true);
    expect(isVSCodeColorTheme({ name: 'not a theme' })).toBe(false);
    expect(isVSCodeIconTheme([])).toBe(false);
  });

  it('rejects a response whose declared size exceeds the safety limit', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new globalThis.Response('{}', {
          headers: { 'content-length': String(MARKETPLACE_DOWNLOAD_MAX_BYTES + 1) },
        }),
      ),
    );

    await expect(
      downloadMarketplaceJson('https://example.test/theme.json', isVSCodeColorTheme),
    ).rejects.toThrow('2 MB safety limit');
  });

  it('rejects downloaded JSON that is not a supported theme', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new globalThis.Response('{"name":"invalid"}')),
    );

    await expect(
      downloadMarketplaceJson('https://example.test/theme.json', isVSCodeColorTheme),
    ).rejects.toThrow('not a supported theme');
  });

  it('passes an abort signal to fetch and reports cancellation', async () => {
    const external = new AbortController();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: Parameters<typeof fetch>[1]) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new globalThis.DOMException('Abort', 'AbortError')),
            );
          }),
      ),
    );

    const pending = downloadMarketplaceJson(
      'https://example.test/theme.json',
      isVSCodeColorTheme,
      external.signal,
    );
    external.abort();

    await expect(pending).rejects.toThrow('Download cancelled');
  });
});
