'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Custom fallback. Receives the error and a reset callback. */
  fallback?: (err: Error, reset: () => void) => ReactNode;
  label?: string;
}

interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(err: Error): State {
    return { error: err };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[ErrorBoundary:${this.props.label ?? 'widget'}]`, err, info.componentStack);
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center space-y-3">
        <div className="w-10 h-10 rounded-xl bg-[#27B18A]/10 border border-[#27B18A]/20
          flex items-center justify-center mx-auto">
          <AlertTriangle size={18} className="text-[#27B18A]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--text)]">
            {this.props.label ?? 'Widget'} gagal dimuat
          </p>
          <p className="text-xs text-[var(--text-3)] mt-1 font-mono break-all">{error.message}</p>
        </div>
        <button
          type="button"
          onClick={this.reset}
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#27B18A]
            hover:text-[#0E927A] transition-colors"
        >
          <RefreshCw size={12} /> Coba lagi
        </button>
      </div>
    );
  }
}
