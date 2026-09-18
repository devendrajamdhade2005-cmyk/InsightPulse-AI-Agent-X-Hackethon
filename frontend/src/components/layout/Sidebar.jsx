import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { cx } from "../../lib/accents.js";
import { VIEW_GROUPS } from "../../lib/views.js";
import { useAuth } from "../../state/AuthProvider.jsx";
import { Wordmark } from "../marketing/Chrome.jsx";
import { viewIcon } from "../icons/index.jsx";
import {
  ChevronRight,
  Clock,
  LogOut,
  Settings,
  User,
  X,
} from "../icons/index.jsx";

/* Left navigation rail for the signed-in workspace.
 *
 * Ten sections do not fit a horizontal bar without truncating labels or wrapping to
 * three rows, which is what made the previous top-nav layout feel cramped. A rail
 * also gives the sections room to be grouped, so "Evidence" and "Agent internals"
 * read as different kinds of thing.
 *
 * Below `lg` the rail becomes an off-canvas drawer.
 */

function NavItem({ view, active, onSelect }) {
  const Icon = viewIcon(view.key);
  return (
    <button
      type="button"
      onClick={() => onSelect(view.key)}
      aria-current={active ? "page" : undefined}
      className={cx(
        "group flex w-full items-center gap-2.5 border-2 px-2.5 py-2 text-left text-[12.5px] font-bold uppercase tracking-wide transition-colors",
        active
          ? "border-line bg-brand-blue text-white shadow-[var(--shadow-nb-xs)]"
          : "border-transparent text-ink-2 hover:border-line hover:bg-bg-2",
      )}
    >
      <Icon
        aria-hidden="true"
        className="h-4 w-4 shrink-0"
        strokeWidth={active ? 2.6 : 2.2}
      />
      <span className="min-w-0 truncate">{view.label}</span>
      {active ? (
        <ChevronRight
          aria-hidden="true"
          className="ml-auto h-3.5 w-3.5 shrink-0"
          strokeWidth={3}
        />
      ) : null}
    </button>
  );
}

function AccountMenu() {
  const { user, profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on any outside click, so the menu cannot be left hanging open behind
  // content the user has moved on to.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const name = profile?.display_name || user?.display_name || "Analyst";
  const initial = (name || user?.email || "A").trim().charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="nb-press flex w-full items-center gap-2.5 border-2 border-line bg-surface px-2.5 py-2 text-left shadow-[var(--shadow-nb-xs)]"
      >
        <span
          aria-hidden="true"
          className="grid h-7 w-7 shrink-0 place-items-center border-2 border-line bg-brand-purple font-mono text-[12px] font-bold text-white"
        >
          {initial}
        </span>
        <span className="min-w-0 flex-1">
          <b className="block truncate text-[12.5px] font-bold">{name}</b>
          <span className="block truncate text-[10.5px] text-ink-4">
            {user?.email}
          </span>
        </span>
      </button>

      {open ? (
        <div className="nb-anim-pop absolute bottom-full left-0 z-20 mb-2 w-full border-2 border-line bg-surface shadow-[var(--shadow-nb)]">
          <Link
            to="/app/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 border-b-2 border-line px-3 py-2.5 text-[12.5px] font-bold uppercase tracking-wide hover:bg-bg-2"
          >
            <User aria-hidden="true" className="h-4 w-4" strokeWidth={2.3} />
            Profile
          </Link>
          <Link
            to="/app/history"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 border-b-2 border-line px-3 py-2.5 text-[12.5px] font-bold uppercase tracking-wide hover:bg-bg-2"
          >
            <Clock aria-hidden="true" className="h-4 w-4" strokeWidth={2.3} />
            Scan history
          </Link>
          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[12.5px] font-bold uppercase tracking-wide text-brand-red hover:bg-brand-red-bg"
          >
            <LogOut aria-hidden="true" className="h-4 w-4" strokeWidth={2.3} />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function SidebarContent({ view, onSelect, onOpenSystem, onClose }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-3.5 py-3">
        <Link to="/" aria-label="InsightPulse home">
          <Wordmark />
        </Link>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="nb-press grid h-8 w-8 place-items-center border-2 border-line bg-surface lg:hidden"
          >
            <X aria-hidden="true" className="h-4 w-4" strokeWidth={2.6} />
          </button>
        ) : null}
      </div>

      <nav
        aria-label="Workspace sections"
        className="min-h-0 flex-1 overflow-y-auto px-2.5 py-3"
      >
        {VIEW_GROUPS.map((group) => (
          <div key={group.name} className="mb-4 last:mb-0">
            <span className="nb-label mb-1.5 block px-1">{group.name}</span>
            <div className="grid gap-1">
              {group.views.map((v) => (
                <NavItem
                  key={v.key}
                  view={v}
                  active={v.key === view}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="grid gap-2 border-t p-2.5">
        <button
          type="button"
          onClick={onOpenSystem}
          className="flex w-full items-center gap-2.5 border-2 border-transparent px-2.5 py-2 text-left text-[12.5px] font-bold uppercase tracking-wide text-ink-2 hover:border-line hover:bg-bg-2"
        >
          <Settings aria-hidden="true" className="h-4 w-4" strokeWidth={2.2} />
          System &amp; sources
        </button>
        <AccountMenu />
      </div>
    </div>
  );
}

export function Sidebar({ view, onSelect, onOpenSystem, mobileOpen, onCloseMobile }) {
  return (
    <>
      {/* fixed rail from lg up */}
      <aside className="gl-chrome hidden w-[17rem] shrink-0 border-r lg:block">
        <div className="sticky top-0 h-screen">
          <SidebarContent
            view={view}
            onSelect={onSelect}
            onOpenSystem={onOpenSystem}
          />
        </div>
      </aside>

      {/* off-canvas drawer below lg */}
      {mobileOpen ? (
        <>
          <div
            className="nb-anim-fade fixed inset-0 z-50 bg-black/55 lg:hidden"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="gl-chrome nb-anim-slide-in fixed inset-y-0 left-0 z-60 w-[17rem] border-r lg:hidden">
            <SidebarContent
              view={view}
              onSelect={(k) => {
                onSelect(k);
                onCloseMobile();
              }}
              onOpenSystem={() => {
                onOpenSystem();
                onCloseMobile();
              }}
              onClose={onCloseMobile}
            />
          </aside>
        </>
      ) : null}
    </>
  );
}
