import { Component, type ReactNode } from "react";

interface Props { children: ReactNode }
interface State { hasError: boolean; error?: Error }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error("Agenda crashed:", error);
  }

  reset = () => this.setState({ hasError: false, error: undefined });

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            {this.state.error?.message ?? "An unexpected error occurred."}
          </p>
          <div className="flex gap-2">
            <button onClick={this.reset} className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90">
              Try again
            </button>
            <button onClick={() => window.location.reload()} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary">
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
