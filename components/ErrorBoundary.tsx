"use client";

import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("Render error caught:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-banner" style={{ marginTop: 20 }}>
          <strong>UI render error:</strong> {this.state.error.message}
          <details style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
            <summary style={{ cursor: "pointer" }}>Stack trace</summary>
            <pre style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>{this.state.error.stack}</pre>
          </details>
          <button
            className="btn-ghost"
            style={{ marginTop: 10 }}
            onClick={() => this.setState({ error: null })}
          >
            Dismiss
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
