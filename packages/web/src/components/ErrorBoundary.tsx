import { Component, type ErrorInfo, type ReactNode } from 'react';

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
        <div
          className="flex-1 flex flex-col items-center justify-center gap-2 p-6 bg-[#0d1117]"
          role="alert"
        >
          <h3 className="text-rose-400 text-sm font-semibold">
            {this.props.panel ? `${this.props.panel} panel error` : 'Something went wrong'}
          </h3>
          <p className="text-gray-400 text-xs text-center">{this.state.error.message}</p>
          {this.props.onRetry ? (
            <button
              type="button"
              onClick={() => {
                this.setState({ error: null });
                this.props.onRetry?.();
              }}
              className="mt-2 px-3.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold"
            >
              Retry
            </button>
          ) : null}
        </div>
      );
    }
    return this.props.children;
  }
}
