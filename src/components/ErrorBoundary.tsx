import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface State {
  error: Error | null;
}

/**
 * Top-level error boundary. Without this, an exception during render produces
 * a silent blank page — the user sees nothing and can't tell anything is wrong.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
    if (typeof window !== 'undefined') window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="max-w-lg space-y-4 rounded-xl border bg-card p-8 text-card-foreground shadow">
          <div className="flex items-center gap-3 text-destructive">
            <AlertTriangle className="h-6 w-6" />
            <h1 className="text-xl font-bold">משהו השתבש</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            התרחשה שגיאה בלתי צפויה. הדף לא יכול להמשיך.
          </p>
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium">פרטים טכניים</summary>
            <pre className="mt-2 overflow-auto rounded bg-muted p-3 text-[11px]">
              {this.state.error.message}
              {'\n\n'}
              {this.state.error.stack}
            </pre>
          </details>
          <button
            type="button"
            onClick={this.reset}
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            רענן ונסה שוב
          </button>
        </div>
      </div>
    );
  }
}
