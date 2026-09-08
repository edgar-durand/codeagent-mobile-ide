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
  [key: string]: unknown;
};

function domStub(tag: string, marker?: string) {
  return function Stub({ children, onPress, disabled, testID }: StubProps) {
    return createElement(
      tag,
      {
        onClick: onPress,
        disabled,
        'data-testid': testID,
        'data-rn': marker,
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
  TextInput: domStub('input'),
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
}));

/**
 * The WebView stub parks its `onMessage` handler on the DOM node so a spec can
 * drive the Monaco bridge (`change` / `save` / `error` messages) the way the
 * real editor would.
 */
export interface WebViewStubElement extends HTMLElement {
  __onMessage?: (event: { nativeEvent: { data: string } }) => void;
}

vi.mock('react-native-webview', () => ({
  WebView: ({ onMessage }: { onMessage?: WebViewStubElement['__onMessage'] }) =>
    createElement('div', {
      'data-rn': 'webview',
      ref: (el: WebViewStubElement | null) => {
        if (el) el.__onMessage = onMessage;
      },
    }),
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => createElement('i', { 'data-icon': name }),
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
