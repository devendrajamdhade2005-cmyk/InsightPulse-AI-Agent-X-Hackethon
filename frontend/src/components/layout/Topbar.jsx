import { cx } from "../../lib/accents.js";
import { useTheme } from "../../state/ThemeProvider.jsx";
import { IconButton } from "../ui/Primitives.jsx";
import { Menu, Moon, Sun } from "../icons/index.jsx";

/* Slim workspace topbar.
 *
 * Carries only what must be reachable from every section: the section title, live
 * agent status, the theme switch, and the drawer trigger on small screens.
 * Navigation itself lives in the rail, so this bar stays quiet.
 */

const DOT = {
  ready: "bg-brand-green",
  running: "nb-anim-blink bg-brand-blue",
  error: "bg-brand-red",
  idle: "bg-brand-slate",
};

const PILL = {
  ready: "bg-brand-green-bg text-brand-green",
  running: "bg-brand-blue-bg text-brand-blue",
  error: "bg-brand-red-bg text-brand-red",
  idle: "bg-brand-slate-bg text-ink-2",
};

export function Topbar({ title, sub, agentState, agentText, onOpenNav }) {
  const { isDark, toggle } = useTheme();
  const ThemeIcon = isDark ? Sun : Moon;

  return (
    <header className="gl-chrome sticky top-0 z-30 border-b">
      <div className="flex items-center gap-3 px-3 py-2.5 sm:px-5">
        <IconButton label="Open navigation" onClick={onOpenNav} className="lg:hidden">
          <Menu aria-hidden="true" className="h-4 w-4" strokeWidth={2.6} />
        </IconButton>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-bold uppercase tracking-tight sm:text-base">
            {title}
          </h1>
          {sub ? (
            <p className="hidden truncate text-[11.5px] text-ink-3 sm:block">{sub}</p>
          ) : null}
        </div>

        <span
          aria-live="polite"
          className={cx(
            "inline-flex shrink-0 items-center gap-2 border-2 border-line px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide",
            PILL[agentState] || PILL.idle,
          )}
        >
          <span
            aria-hidden="true"
            className={cx(
              "h-2.5 w-2.5 shrink-0 border-2 border-line",
              DOT[agentState] || DOT.idle,
            )}
          />
          <span className="hidden whitespace-nowrap sm:inline">{agentText}</span>
        </span>

        <IconButton
          label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          onClick={toggle}
          className="bg-pop-yellow text-black dark:bg-brand-purple dark:text-white"
        >
          <ThemeIcon aria-hidden="true" className="h-4 w-4" strokeWidth={2.4} />
        </IconButton>
      </div>
    </header>
  );
}
