import { useEffect, useRef, useState } from "react";
import { cx } from "../../lib/accents.js";
import { STEPS } from "../../lib/activity.js";
import { LinkButton, Panel, Spinner } from "../ui/Primitives.jsx";
import { Check, phaseIcon, stepIcon } from "../icons/index.jsx";

/* Live run surface: the six-step tracker, one plain-English status line, and the
 * optional raw activity feed.
 *
 * The original was careful that streaming touched only three DOM nodes. React
 * re-renders this subtree per event instead, which is fine because the subtree is
 * small and bounded — but the tick list is still append-only and scroll-anchored,
 * so a long run does not thrash layout.
 */

function StepDot({ state }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "relative grid h-5 w-5 shrink-0 place-items-center border-2 border-line",
        state === "done" && "bg-brand-green",
        state === "active" && "nb-anim-blink bg-brand-blue",
        !state && "bg-surface",
      )}
    >
      {state === "done" ? (
        <Check className="h-3 w-3 text-white" strokeWidth={4} />
      ) : null}
    </span>
  );
}

function Tick({ entry }) {
  const tone =
    entry.phase === "warning" ? "warn" : entry.phase === "error" ? "err" : "";
  const title = entry.title && entry.title !== entry.label ? entry.title : "";
  // The backend also sends an emoji in `entry.icon`; the structured phase is used
  // instead so the interface stays vector-only.
  const Icon = phaseIcon(entry.phase);
  return (
    <div
      className={cx(
        "grid grid-cols-[1.25rem_1fr_auto] items-baseline gap-2 border-2 px-2 py-1.5 text-[12px]",
        tone === "warn" && "border-brand-yellow bg-brand-yellow-bg",
        tone === "err" && "border-brand-red bg-brand-red-bg",
        !tone && "border-line-soft bg-surface",
      )}
    >
      <Icon aria-hidden="true" className="mt-0.5 h-3.5 w-3.5" strokeWidth={2.4} />
      <span className="min-w-0">
        <b className="font-bold">{entry.label}</b>
        {title ? ` — ${title}` : ""}
        {entry.detail ? (
          <em className="mt-0.5 block not-italic text-[11.5px] text-ink-3">
            {entry.detail}
          </em>
        ) : null}
      </span>
      <time className="font-mono text-[10.5px] text-ink-4">
        {(entry.elapsed_ms / 1000).toFixed(1)}s
      </time>
    </div>
  );
}

export function LiveRun({ activeStep, message, ticks, searchLabel }) {
  const [showTicks, setShowTicks] = useState(false);
  const scrollRef = useRef(null);

  // Keep the newest event in view while the feed is open.
  useEffect(() => {
    if (showTicks && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [ticks.length, showTicks]);

  const activeIndex = STEPS.findIndex((s) => s.key === activeStep);

  return (
    <Panel aria-live="polite" className="p-4 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <Spinner className="mt-0.5" />
        <div className="min-w-0">
          <h2 className="text-lg font-bold uppercase tracking-tight">
            Your AI agent is working
          </h2>
          <p className="mt-0.5 text-[13.5px] text-ink-2">{message}</p>
        </div>
      </div>

      <ol className="grid gap-2.5">
        {STEPS.map((s, i) => {
          const state = i < activeIndex ? "done" : i === activeIndex ? "active" : "";
          const label = s.key === "search" && searchLabel ? searchLabel : s.label;
          const StepIcon = stepIcon(s.key);
          return (
            <li
              key={s.key}
              className={cx(
                "flex items-center gap-3 text-[13.5px]",
                state === "done" && "text-ink-2",
                state === "active" && "font-bold text-ink",
                !state && "text-ink-4",
              )}
            >
              <StepDot state={state} />
              <StepIcon
                aria-hidden="true"
                className="h-4 w-4 shrink-0 opacity-70"
                strokeWidth={2.2}
              />
              <span>{label}</span>
            </li>
          );
        })}
      </ol>

      <div className="mt-5 border-t-2 border-line pt-4">
        <LinkButton
          aria-expanded={showTicks}
          onClick={() => setShowTicks((o) => !o)}
        >
          {showTicks ? "Hide live agent activity" : "View live agent activity"}
          {ticks.length ? ` (${ticks.length})` : ""}
        </LinkButton>

        {showTicks ? (
          <div
            ref={scrollRef}
            className="mt-3 grid max-h-72 gap-1.5 overflow-y-auto border-2 border-line bg-bg-2 p-2"
          >
            {ticks.length ? (
              ticks.map((entry, i) => <Tick key={i} entry={entry} />)
            ) : (
              <p className="p-2 text-[12px] text-ink-3">
                Waiting for the first event…
              </p>
            )}
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
