import { useState } from "react";
import { cx } from "../../lib/accents.js";
import {
  observationRows,
  reasoningTrail,
  technicalStats,
} from "../../lib/activity.js";
import { Reveal, SectionTitle } from "../ui/Primitives.jsx";
import { Brain, Eye, phaseIcon } from "../icons/index.jsx";

/* The reasoning trail — goal → plan → decision → tool → observation → analysis.
 *
 * Ported from `reasoningTrail()` and `technicalDetails()`. This is the panel that
 * demonstrates the loop is genuinely adaptive rather than a fixed pipeline, so the
 * deferred-need entries and the per-iteration decisions are all preserved.
 */

const TONE_COLOR = {
  decision: "bg-brand-purple",
  action: "bg-brand-cyan",
  observe: "bg-brand-green",
  analyze: "bg-brand-orange",
  done: "bg-brand-pink",
};

function TrailList({ steps }) {
  return (
    <ol className="relative">
      {steps.map((s, i) => (
        <li key={i} className="relative pb-4 pl-7 last:pb-0">
          {/* connector */}
          {i < steps.length - 1 ? (
            <span
              aria-hidden="true"
              className="absolute left-[7px] top-4 bottom-0 w-[2px] bg-line-soft"
            />
          ) : null}
          <span
            aria-hidden="true"
            className={cx(
              "absolute left-0 top-1 h-4 w-4 border-2 border-line",
              TONE_COLOR[s.tone] || "bg-brand-blue",
            )}
          />
          <b className="block text-[13.5px] font-bold">{s.stage}</b>
          {s.detail ? (
            <span className="mt-0.5 block text-[12.5px] text-ink-3">
              {s.detail}
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function LogLine({ entry, showIteration }) {
  const tone =
    entry.phase === "warning" ? "warn" : entry.phase === "error" ? "err" : "";
  const Icon = phaseIcon(entry.phase);
  return (
    <div
      className={cx(
        "grid grid-cols-[1.25rem_1fr_auto] gap-2 border-2 px-2 py-1.5 text-[12px]",
        tone === "warn" && "border-brand-yellow bg-brand-yellow-bg",
        tone === "err" && "border-brand-red bg-brand-red-bg",
        !tone && "border-line-soft bg-surface",
      )}
    >
      <Icon aria-hidden="true" className="mt-0.5 h-3.5 w-3.5" strokeWidth={2.4} />
      <span className="min-w-0">
        <b className="font-bold">
          {entry.label}
          {showIteration && entry.iteration ? ` · step ${entry.iteration}` : ""}
          {entry.title && entry.title !== entry.label ? ` — ${entry.title}` : ""}
        </b>
        {entry.detail ? (
          <em className="mt-0.5 block not-italic text-[11.5px] text-ink-3">
            {entry.detail}
          </em>
        ) : null}
      </span>
      <time className="font-mono text-[10.5px] text-ink-4">
        {entry.elapsed_ms != null
          ? `${(entry.elapsed_ms / 1000).toFixed(1)}s`
          : ""}
      </time>
    </div>
  );
}

function TechnicalDetails({ result }) {
  const [tab, setTab] = useState("log");
  const stats = technicalStats(result);
  const log = result.activity_log || [];
  const observations = observationRows(result);

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map(([label, value]) => (
          <div
            key={label}
            className="border-2 border-line bg-bg-2 px-2.5 py-2"
          >
            <b className="block font-mono text-[15px] font-bold tabular-nums">
              {value}
            </b>
            <span className="nb-label text-[9px]">{label}</span>
          </div>
        ))}
      </div>

      <div role="tablist" className="mb-3 flex gap-2">
        {[
          ["log", `Activity log (${log.length})`],
          ["obs", `Observations (${observations.length})`],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cx(
              "nb-press border-2 border-line px-3 py-1.5 text-[12px] font-bold uppercase tracking-wide",
              tab === key
                ? "bg-brand-blue text-white shadow-[var(--shadow-nb-xs)]"
                : "bg-surface text-ink-2 hover:bg-bg-2",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid max-h-96 gap-1.5 overflow-y-auto border-2 border-line bg-bg-2 p-2">
        {tab === "log" ? (
          log.length ? (
            log.map((e, i) => <LogLine key={i} entry={e} showIteration />)
          ) : (
            <p className="p-2 text-[12px] text-ink-3">No activity recorded.</p>
          )
        ) : observations.length ? (
          observations.map((o, i) => (
            <div
              key={i}
              className="grid grid-cols-[1.25rem_1fr] gap-2 border-2 border-line-soft bg-surface px-2 py-1.5 text-[12px]"
            >
              <Eye
                aria-hidden="true"
                className="mt-0.5 h-3.5 w-3.5 text-ink-3"
                strokeWidth={2.4}
              />
              <span>
                <b className="font-bold">
                  step {o.iteration} · {o.tool} · {o.yield_quality}
                </b>
                <em className="mt-0.5 block not-italic text-[11.5px] text-ink-3">
                  {o.summary}
                </em>
              </span>
            </div>
          ))
        ) : (
          <p className="p-2 text-[12px] text-ink-3">No observations recorded.</p>
        )}
      </div>
    </div>
  );
}

export function AgentTrail({ result, multiAgent, memory }) {
  const steps = reasoningTrail(result);

  return (
    <Reveal
      summary={
        <span className="flex flex-wrap items-baseline gap-2">
          <span>How the AI Agents Worked</span>
          <small className="font-normal normal-case tracking-normal text-ink-3">
            proof of multi-agent orchestration — understand → plan → delegate →
            use tools → manage context
          </small>
        </span>
      }
    >
      <div className="space-y-6">
        {multiAgent}

        {memory ? (
          <Reveal
            summary={
              <span className="flex items-center gap-2">
                <Brain aria-hidden="true" className="h-4 w-4" strokeWidth={2.3} />
                Context &amp; Memory
              </span>
            }
          >
            {memory}
          </Reveal>
        ) : null}

        <Reveal summary="Show the full reasoning trail">
          <SectionTitle>Decision trail</SectionTitle>
          <TrailList steps={steps} />
          <div className="mt-5 border-t-2 border-line pt-4">
            <Reveal summary="Show technical details">
              <TechnicalDetails result={result} />
            </Reveal>
          </div>
        </Reveal>
      </div>
    </Reveal>
  );
}
