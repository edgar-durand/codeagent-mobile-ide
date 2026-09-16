/**
 * Bridge message parsing utilities — shared between @codeam/ide-web
 * and @codeam/ide-native. Centralises the try/catch + JSON.parse
 * boilerplate that was duplicated across every WebView component.
 */

/**
 * Known bridge message shapes flowing from the Monaco/xterm WebView
 * to the React host.
 */
export interface BridgeMessageMap {
  change: { type: 'change'; value: string };
  save: { type: 'save' };
  ready: { type: 'ready'; cols?: number; rows?: number };
  error: { type: 'error'; value: string };
  data: { type: 'data'; data: string };
  resize: { type: 'resize'; cols: number; rows: number };
  exit: { type: 'exit'; exitCode?: number };
}

export type BridgeMessageType = keyof BridgeMessageMap;
export type BridgeMessage<T extends BridgeMessageType = BridgeMessageType> = BridgeMessageMap[T];

/**
 * Parse a raw WebView message event into a typed object. Returns
 * `null` when the message can't be parsed (malformed JSON, wrong
 * shape, etc.) — callers should ignore null results.
 *
 * Usage in a WebView onMessage handler:
 * ```ts
 * const msg = parseBridgeMessage(event, 'change');
 * if (msg) setContent(msg.value);
 * ```
 */
export function parseBridgeMessage<T extends BridgeMessageType>(
  data: string,
): BridgeMessage<T> | null {
  try {
    const msg = JSON.parse(data) as BridgeMessage<T>;
    if (msg && typeof msg === 'object' && typeof msg.type === 'string') return msg;
    return null;
  } catch {
    return null;
  }
}
