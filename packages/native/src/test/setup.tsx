/**
 * Vitest setup for @codeam/ide-native component specs.
 *
 * `react-native` ships Flow sources that only load under the Jest preset, so
 * the host primitives the components use are replaced with thin DOM stubs and
 * the components themselves render for real through react-dom into jsdom.
 * Behavioural props survive the mapping (`onPress` → `onClick`, `disabled`,
 * `testID` → `data-testid`); layout-only props (`style`, `hitSlop`, …) drop.
 */
import { vi } from 'vitest';
import { createElement, type ReactNode } from 'react';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

type StubProps = {
  children?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityRole?: string;
  accessibilityState?: Record<string, boolean | undefined>;
  [key: string]: unknown;
};

function domStub(tag: string, marker?: string) {
  return function Stub({
    children,
    onPress,
    disabled,
    testID,
    accessibilityLabel,
    accessibilityRole,
    accessibilityState,
  }: StubProps) {
    return createElement(
      tag,
      {
        onClick: onPress,
        disabled,
        'data-testid': testID,
        'data-rn': marker,
        'aria-label': accessibilityLabel,
        role: accessibilityRole,
        'aria-selected': accessibilityState?.selected,
        'aria-busy': accessibilityState?.busy,
        'aria-checked': accessibilityState?.checked,
        'aria-disabled': accessibilityState?.disabled,
      },
      children,
    );
  };
}

vi.mock('react-native', () => ({
  View: domStub('div'),
  Text: domStub('span'),
  TouchableOpacity: domStub('button'),
  Pressable: domStub('button'),
  ScrollView: domStub('div'),
  TextInput: ({
    value,
    onChangeText,
    ...props
  }: StubProps & { value?: string; onChangeText?: (value: string) => void }) =>
    createElement('input', {
      value,
      onChange: (event: { target: { value: string } }) => onChangeText?.(event.target.value),
      'aria-label': props.accessibilityLabel,
    }),
  FlatList: ({
    data = [],
    renderItem,
    ListHeaderComponent,
    ListEmptyComponent,
  }: StubProps & {
    data?: unknown[];
    renderItem?: (info: { item: unknown; index: number }) => ReactNode;
    ListHeaderComponent?: () => ReactNode;
    ListEmptyComponent?: () => ReactNode;
  }) =>
    createElement(
      'div',
      null,
      ListHeaderComponent?.(),
      data.length === 0
        ? ListEmptyComponent?.()
        : data.map((item, index) =>
            createElement('div', { key: index }, renderItem?.({ item, index })),
          ),
    ),
  ActivityIndicator: domStub('div', 'activity-indicator'),
  Modal: ({ children, visible = true }: StubProps & { visible?: boolean }) =>
    visible ? createElement('div', { 'data-rn': 'modal' }, children) : null,
  StyleSheet: {
    create: <T,>(styles: T) => styles,
    hairlineWidth: 1,
    absoluteFill: {},
    flatten: (s: unknown) => s,
  },
  Platform: { OS: 'ios', select: (o: Record<string, unknown>) => o.ios ?? o.default },
  useWindowDimensions: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }),
  Alert: { alert: vi.fn() },
  Linking: {
    canOpenURL: vi.fn(async () => true),
    openURL: vi.fn(async () => undefined),
  },
  AccessibilityInfo: {
    isReduceMotionEnabled: vi.fn(async () => false),
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  },
  Dimensions: {
    get: vi.fn(() => ({ width: 390, height: 844, scale: 3, fontScale: 1 })),
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  },
  Animated: {
    Value: class {
      constructor(_value: number) {}
    },
    View: domStub('div'),
    timing: vi.fn(() => ({ start: vi.fn() })),
  },
  PanResponder: { create: vi.fn(() => ({ panHandlers: {} })) },
}));

/**
 * The WebView stub parks its `onMessage` handler on the DOM node so a spec can
 * drive the Monaco bridge (`change` / `save` / `error` messages) the way the
 * real editor would.
 */
export interface WebViewStubElement extends HTMLElement {
  __onMessage?: (event: { nativeEvent: { data: string } }) => void;
}

/**
 * The WebView stub fires `onLoadEnd` on mount.
 *
 * ⚠️ Not cosmetic. `ResilientWebView` keeps a spinner over the surface until
 * it can prove the view loaded, and arms a watchdog that fails the surface if
 * that proof never arrives. A stub that never loads makes every host
 * component look permanently stuck in tests — and, worse, would let a real
 * regression in that handshake pass CI unnoticed. A WebView loads; the stub
 * says so.
 */
vi.mock('react-native-webview', () => ({
  WebView: ({
    onMessage,
    onLoadEnd,
  }: {
    onMessage?: WebViewStubElement['__onMessage'];
    onLoadEnd?: () => void;
  }) =>
    createElement('div', {
      'data-rn': 'webview',
      ref: (el: WebViewStubElement | null) => {
        if (el) {
          el.__onMessage = onMessage;
          onLoadEnd?.();
        }
      },
    }),
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => createElement('i', { 'data-icon': name }),
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
