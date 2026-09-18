import { Component } from "react";
import { cx } from "../../lib/accents.js";
import { AlertTriangle, RefreshCw } from "../icons/index.jsx";

/* Render-failure containment.
 *
 * The vanilla build this replaced wrapped every dashboard panel in a `safeRender`
 * helper, precisely so one bad payload could not take the page down. That
 * protection was lost in the React port, and the consequence was severe: a single
 * throw anywhere in the tree unmounted everything and left a blank page — with the
 * completed scan still in memory but no way to see it.
 *
 * Boundaries restore that guarantee. A failing panel is replaced by a labelled
 * notice naming the section and the error; every sibling keeps rendering.
 *
 * Deliberately a class component: `componentDidCatch` has no hook equivalent.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep the detail in the console for whoever has to fix it, while the UI
    // stays readable for whoever is just trying to use the product.
    console.error(
      `[InsightPulse] "${this.props.label || "component"}" failed to render`,
      error,
      info?.componentStack,
    );
    this.props.onError?.(error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback(error, this.reset);
    }

    return (
      <div
        role="alert"
        className={cx(
          "nb-frame-flat border-brand-red/50 p-4",
          this.props.className,
        )}
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center border-2 border-brand-red bg-brand-red-bg"
          >
            <AlertTriangle className="h-4 w-4 text-brand-red" strokeWidth={2.5} />
          </span>
          <div className="min-w-0 flex-1">
            <b className="block text-[13.5px] font-bold uppercase tracking-tight">
              {this.props.label
                ? `${this.props.label} could not be displayed`
                : "This section could not be displayed"}
            </b>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">
              Your scan data is intact and every other section still works.
            </p>
            <p className="mt-2 break-words font-mono text-[11px] text-brand-red">
              {String(error?.message || error)}
            </p>
            <button
              type="button"
              onClick={this.reset}
              className="nb-press mt-3 inline-flex items-center gap-1.5 border-2 border-line bg-surface px-2.5 py-1.5 text-[11.5px] font-bold uppercase tracking-wide"
            >
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={2.4} />
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }
}

/** Convenience wrapper so call sites stay a single line. */
export function Guard({ label, children, className }) {
  return (
    <ErrorBoundary label={label} className={className}>
      {children}
    </ErrorBoundary>
  );
}
