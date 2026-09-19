import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message?: string;
}

/**
 * Catches any render-time error anywhere below it. Without this, one bad
 * card (bad data shape, etc.) unmounts the whole React tree and the page
 * goes blank. With it, the user sees a friendly message and a reload button
 * instead, and the error is logged to the console for debugging.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Reperto UI crashed:", error, info);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 p-6">
          <div className="max-w-md w-full text-center space-y-5">
            <div className="text-5xl">🩺</div>
            <div className="space-y-2">
              <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                Something went wrong
              </h1>
              <p className="text-sm text-muted-foreground">
                The page hit an unexpected error. Your data is safe — reload to
                continue.
              </p>
            </div>
            {this.state.message && (
              <p className="text-xs font-mono text-neutral-500 bg-neutral-100 dark:bg-neutral-900 rounded-md p-3 break-all text-left">
                {this.state.message}
              </p>
            )}
            <button
              onClick={this.handleReload}
              className="rounded-md bg-primary text-primary-foreground hover:bg-primary/80 px-5 py-2 text-sm font-semibold"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}