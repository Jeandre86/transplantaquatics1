import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

interface Props { children: ReactNode }
interface State { hasError: boolean }

export default class RouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Page render failed:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-[70vh] items-center justify-center bg-[var(--paper)] px-4 py-16">
          <div className="w-full max-w-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center sm:p-10" role="alert">
            <div className="mx-auto flex size-12 items-center justify-center border border-amber-600/30 bg-amber-50 text-amber-700"><AlertTriangle size={22} /></div>
            <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent-dark)]">Page error</p>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[var(--ink)]">This page didn’t load properly.</h1>
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">Try loading it again. If the problem continues, return to the home page and try another section.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={() => window.location.reload()} className="inline-flex items-center gap-2 bg-[var(--accent)] px-5 py-3 text-sm font-bold text-[var(--navy)] transition-colors hover:bg-[var(--accent-dark)] hover:text-white"><RotateCw size={15} /> Try again</button>
              <a href="/" className="border border-[var(--border)] px-5 py-3 text-sm font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--paper-dark)]">Go home</a>
            </div>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
