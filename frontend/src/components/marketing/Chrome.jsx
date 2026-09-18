import { Link, NavLink } from "react-router-dom";
import { useState } from "react";
import { cx } from "../../lib/accents.js";
import { useTheme } from "../../state/ThemeProvider.jsx";
import { useAuth } from "../../state/AuthProvider.jsx";
import { IconButton } from "../ui/Primitives.jsx";
import { Menu, Moon, Sun, X } from "../icons/index.jsx";

/* Public-site chrome: the marketing header and footer.
 *
 * Deliberately separate from the signed-in application shell. The two have
 * different jobs — this one sells and explains, the other is a workspace — and
 * sharing a header would compromise both.
 */

export function Wordmark({ compact = false }) {
  return (
    <span className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="grid h-9 w-9 shrink-0 place-items-center border-2 border-line bg-brand-blue text-white shadow-[var(--shadow-nb-xs)]"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
        >
          <path d="M3 12h3.2l2.3-6.6 3.4 13.2 2.9-8.4 1.9 1.8H21" />
        </svg>
      </span>
      {!compact ? (
        <span className="flex flex-col leading-none">
          <strong className="text-[15px] font-bold uppercase tracking-tight">
            InsightPulse
          </strong>
          <span className="nb-label mt-0.5 text-[8.5px]">Research Intelligence</span>
        </span>
      ) : null}
    </span>
  );
}

export function ThemeToggle() {
  const { isDark, toggle } = useTheme();
  const Icon = isDark ? Sun : Moon;
  return (
    <IconButton
      label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={toggle}
      className="bg-pop-yellow text-black dark:bg-brand-purple dark:text-white"
    >
      <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={2.4} />
    </IconButton>
  );
}

const LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/how-it-works", label: "How it works" },
];

export function MarketingHeader() {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);

  const linkClass = ({ isActive }) =>
    cx(
      "nb-press border-2 border-line px-3 py-1.5 text-[12px] font-bold uppercase tracking-wide",
      isActive
        ? "bg-brand-blue text-white shadow-[var(--shadow-nb-xs)]"
        : "bg-surface text-ink-2 hover:bg-bg-2",
    );

  return (
    <header className="sticky top-0 z-40 border-b-4 border-line bg-surface/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link to="/" className="shrink-0">
          <Wordmark />
        </Link>

        <nav aria-label="Site" className="ml-6 hidden gap-2 md:flex">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {isAuthenticated ? (
            <Link
              to="/app"
              className="nb-press hidden border-2 border-line bg-brand-blue px-4 py-2 text-[12px] font-bold uppercase tracking-wide text-white shadow-[var(--shadow-nb-sm)] sm:inline-block"
            >
              Open dashboard
            </Link>
          ) : (
            <>
              <Link
                to="/signin"
                className="nb-press hidden border-2 border-line bg-surface px-3.5 py-2 text-[12px] font-bold uppercase tracking-wide shadow-[var(--shadow-nb-xs)] sm:inline-block"
              >
                Sign in
              </Link>
              <Link
                to="/signup"
                className="nb-press border-2 border-line bg-brand-blue px-3.5 py-2 text-[12px] font-bold uppercase tracking-wide text-white shadow-[var(--shadow-nb-sm)]"
              >
                Get started
              </Link>
            </>
          )}
          <IconButton
            label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="md:hidden"
          >
            {open ? (
              <X aria-hidden="true" className="h-4 w-4" strokeWidth={2.6} />
            ) : (
              <Menu aria-hidden="true" className="h-4 w-4" strokeWidth={2.6} />
            )}
          </IconButton>
        </div>
      </div>

      {open ? (
        <nav
          aria-label="Site"
          className="nb-anim-fade grid gap-2 border-t-2 border-line bg-bg-2 px-4 py-3 md:hidden"
        >
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={linkClass}
              onClick={() => setOpen(false)}
            >
              {l.label}
            </NavLink>
          ))}
          <Link
            to={isAuthenticated ? "/app" : "/signin"}
            onClick={() => setOpen(false)}
            className="nb-press border-2 border-line bg-brand-blue px-3 py-1.5 text-center text-[12px] font-bold uppercase tracking-wide text-white"
          >
            {isAuthenticated ? "Open dashboard" : "Sign in"}
          </Link>
        </nav>
      ) : null}
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t-4 border-line bg-surface">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div>
          <Wordmark />
          <p className="mt-3 max-w-md text-[12.5px] text-ink-3">
            Autonomous research and competitor intelligence. Gathers evidence,
            reasons about it, and reports only what matters — labelling what was
            live and what was simulated.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-[12px] font-bold uppercase tracking-wide">
          <Link to="/how-it-works" className="border-b-2 border-transparent hover:border-line">
            How it works
          </Link>
          <Link to="/signin" className="border-b-2 border-transparent hover:border-line">
            Sign in
          </Link>
          <a
            href="/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="border-b-2 border-transparent hover:border-line"
          >
            API
          </a>
        </nav>
      </div>
    </footer>
  );
}
