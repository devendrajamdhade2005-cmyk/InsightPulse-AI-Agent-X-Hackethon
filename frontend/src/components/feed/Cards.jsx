import { accentClass, cx, toneClass } from "../../lib/accents.js";
import {
  PRIORITY,
  ago,
  categoryAccent,
  categoryLabel,
  providerLabel,
  truncate,
} from "../../lib/format.js";
import { Badge, Button, MiniLabel, TagRow } from "../ui/Primitives.jsx";
import { Confidence, SignalTags, SimTag } from "../intelligence/Atoms.jsx";
import {
  ArrowDown,
  ToneDot,
  TrendingUp,
  categoryIconFor,
} from "../icons/index.jsx";

/* Competitor card + connected-intelligence chain. */

export function CompetitorCard({ competitor: c, onViewSignals }) {
  const p = PRIORITY[c.priority] || PRIORITY.MEDIUM;
  // Direction marker for signal volume: rising, flat, or nothing recorded.
  const trendArrow = (n) =>
    n >= 3 ? (
      <TrendingUp
        aria-label="rising"
        className="h-3.5 w-3.5 text-brand-green"
        strokeWidth={2.6}
      />
    ) : n > 0 ? (
      <ArrowDown
        aria-label="steady"
        className="h-3.5 w-3.5 -rotate-90 text-ink-4"
        strokeWidth={2.6}
      />
    ) : (
      <span aria-label="none" className="text-ink-4">
        —
      </span>
    );

  return (
    <article className="nb-frame nb-lift p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-bold uppercase tracking-tight">{c.name}</h3>
          <p className="text-[12px] text-ink-4">
            {c.total} signal{c.total === 1 ? "" : "s"} detected
          </p>
        </div>
        <Badge tone={p.tone}>
          <ToneDot />
          {p.label}
        </Badge>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {["research", "patent", "news", "web"].map((key) => {
          const n = c.byCategory[key] || 0;
          const Icon = categoryIconFor(key);
          return (
            <div
              key={key}
              className="flex items-center justify-between gap-2 border-2 border-line-soft bg-bg-2 px-2.5 py-1.5 text-[12px]"
            >
              <span className="flex items-center gap-1.5 text-ink-3">
                <Icon aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.2} />
                {categoryLabel(key)}
              </span>
              <b className="flex items-center gap-1 font-mono font-bold tabular-nums">
                {n}
                {trendArrow(n)}
              </b>
            </div>
          );
        })}
      </div>

      {c.signals.length ? (
        <TagRow className="mb-3">
          <SignalTags signals={c.signals} />
        </TagRow>
      ) : null}

      {c.latest ? (
        <div className={cx(accentClass("orange"), "nb-a-bg mb-3 border-2 border-line p-3")}>
          <MiniLabel>Latest development</MiniLabel>
          <p className="text-[13px] font-medium">{truncate(c.latest.title, 130)}</p>
          <span className="mt-1 block text-[11px] text-ink-4">
            {ago(c.latest.published_date)} · {providerLabel(c.latest.provider)}
          </span>
        </div>
      ) : (
        <p className="mb-3 text-[12.5px] text-ink-3">
          No dated development found in this window.
        </p>
      )}

      {c.topInsight ? (
        <div className="mb-3 grid gap-3">
          <div>
            <MiniLabel>Why it matters</MiniLabel>
            <p className="text-[12.5px] text-ink-2">
              {truncate(c.topInsight.why_it_matters, 170)}
            </p>
          </div>
          <div>
            <MiniLabel>Recommended action</MiniLabel>
            <p className="text-[12.5px] text-ink-2">
              {truncate(c.topInsight.recommended_action, 150)}
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-2 border-t-2 border-line pt-3">
        <Button size="xs" variant="ghost" onClick={() => onViewSignals(c.name)}>
          View all signals
        </Button>
        <SimTag on={c.simulated} />
      </div>
    </article>
  );
}

export function ConnectionChain({ chain, onOpenEvidence, onExplore }) {
  return (
    <article className="nb-frame-flat bg-bg-2 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="nb-eyebrow mb-2">
            {chain.members.length} related signals detected
          </span>
          <h3 className="text-base font-bold uppercase tracking-tight capitalize">
            {chain.anchor}
          </h3>
          <p className="text-[12px] text-ink-3">
            Linked by shared{" "}
            {chain.anchorKind === "company" ? "company" : "strategic signal"}
          </p>
        </div>
        <Confidence value={chain.confidence} />
      </div>

      <div className="flex flex-col gap-1">
        {chain.members.map((m, i) => {
          const Icon = categoryIconFor(m.source);
          return (
          <div key={m.id}>
            {i ? (
              <ArrowDown
                aria-hidden="true"
                className="ml-4 my-0.5 h-4 w-4 text-ink-4"
                strokeWidth={2.4}
              />
            ) : null}
            <button
              type="button"
              onClick={() => onOpenEvidence(m.id)}
              className={cx(
                accentClass(categoryAccent(m.source)),
                "nb-press nb-a-border flex w-full items-center gap-2.5 border-2 border-l-[6px] border-line bg-surface p-2.5 text-left",
              )}
            >
              <Icon
                aria-hidden="true"
                className="nb-a-fg h-4 w-4 shrink-0"
                strokeWidth={2.3}
              />
              <span className="min-w-0">
                <b className="nb-a-fg block text-[10px] font-bold uppercase tracking-[0.08em]">
                  {categoryLabel(m.source)}
                </b>
                <span className="block text-[12.5px] text-ink-2">
                  {truncate(m.title, 74)}
                </span>
              </span>
            </button>
          </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Button size="xs" variant="ghost" onClick={() => onExplore(chain.key)}>
          Explore connection
        </Button>
        <SimTag on={chain.simulated} />
      </div>
    </article>
  );
}

/** Priority-count strip used by the insights view header. */
export function PriorityStrip({ counts }) {
  const rows = ["HIGH", "MEDIUM", "LOW"].filter((k) => counts[k] > 0);
  if (!rows.length) return null;
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {rows.map((k) => {
        const p = PRIORITY[k];
        return (
          <span
            key={k}
            className={cx(
              toneClass(p.tone),
              "nb-a-bg inline-flex items-center gap-2 border-2 border-line px-3 py-1.5 text-[13px]",
            )}
          >
            <ToneDot />
            <b className="nb-a-fg font-mono font-bold">{counts[k]}</b>
            <span className="uppercase tracking-wide">{p.label}</span>
          </span>
        );
      })}
    </div>
  );
}
