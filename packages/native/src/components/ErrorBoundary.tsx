import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface Props {
  children: ReactNode;
  /** Label shown in the error card (e.g. "File Tree", "Source Control"). */
  panel?: string;
  /** When supplied, renders a retry button that calls this function. */
  onRetry?: () => void;
}

interface State {
  error: Error | null;
}

/**
 * Error Boundary for IDE panels. Captures unhandled errors inside a
 * panel subtree and renders a fallback card instead of crashing the
 * entire IDE shell. Each panel should be wrapped:
 *
 * ```tsx
 * <IDEErrorBoundary panel="Search">
 *   <SearchPanel provider={p} onOpen={fn} />
 * </IDEErrorBoundary>
 * ```
 */
export class IDEErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      `[IDE] ${this.props.panel ?? 'Panel'} crashed:`,
      error.message,
      info.componentStack,
    );
  }

  override render() {
    if (this.state.error) {
      return (
        <View style={styles.container} accessibilityRole="alert">
          <Text style={styles.title}>
            {this.props.panel ? `${this.props.panel} panel error` : 'Something went wrong'}
          </Text>
          <Text style={styles.message}>{this.state.error.message}</Text>
          {this.props.onRetry ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry"
              onPress={() => {
                this.setState({ error: null });
                this.props.onRetry?.();
              }}
              style={styles.retryBtn}
            >
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          ) : null}
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
    backgroundColor: '#0d1117',
  },
  title: { color: '#f87171', fontSize: 14, fontWeight: '600' },
  message: { color: '#9ca3af', fontSize: 11, textAlign: 'center' },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#7c5cff',
  },
  retryText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
