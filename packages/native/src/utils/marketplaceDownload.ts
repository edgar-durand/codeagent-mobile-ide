import { parseJsonc, type VSCodeColorTheme, type VSCodeIconTheme } from '@codeam/ide-core';

export const MARKETPLACE_DOWNLOAD_TIMEOUT_MS = 15_000;
export const MARKETPLACE_DOWNLOAD_MAX_BYTES = 2 * 1024 * 1024;

function byteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const point = character.codePointAt(0) ?? 0;
    bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
  }
  return bytes;
}

export async function downloadMarketplaceJson<T>(
  url: string,
  validate: (value: unknown) => value is T,
  signal?: AbortController['signal'],
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MARKETPLACE_DOWNLOAD_TIMEOUT_MS);
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Download failed (HTTP ${response.status}).`);
    const declaredSize = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredSize) && declaredSize > MARKETPLACE_DOWNLOAD_MAX_BYTES) {
      throw new Error('Theme is larger than the 2 MB safety limit.');
    }
    const text = await response.text();
    if (byteLength(text) > MARKETPLACE_DOWNLOAD_MAX_BYTES) {
      throw new Error('Theme is larger than the 2 MB safety limit.');
    }
    const value = parseJsonc<unknown>(text);
    if (!validate(value)) throw new Error('Downloaded file is not a supported theme.');
    return value;
  } catch (error) {
    if (signal?.aborted) {
      throw new Error('Download cancelled.');
    }
    if (controller.signal.aborted) {
      throw new Error('Download timed out.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

export function isVSCodeColorTheme(value: unknown): value is VSCodeColorTheme {
  if (!value || typeof value !== 'object') return false;
  const theme = value as Record<string, unknown>;
  const colors = theme.colors;
  const tokenColors = theme.tokenColors;
  return (
    (!!colors && typeof colors === 'object' && !Array.isArray(colors)) ||
    (Array.isArray(tokenColors) && tokenColors.length > 0)
  );
}

export function isVSCodeIconTheme(value: unknown): value is VSCodeIconTheme {
  if (!value || typeof value !== 'object') return false;
  const theme = value as Record<string, unknown>;
  return !!theme.iconDefinitions && typeof theme.iconDefinitions === 'object';
}
