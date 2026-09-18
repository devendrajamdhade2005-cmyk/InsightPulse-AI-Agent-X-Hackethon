import { accentClass, cx, toneClass } from "../../lib/accents.js";
import { PRIORITY, categoryOf, formatDate } from "../../lib/format.js";
import {
  Button,
  Card,
  MiniLabel,
  Panel,
  Reveal,
  TagRow,
} from "../ui/Primitives.jsx";
import {
  CategoryTag,
  PriorityBadge,
  SimTag,
} from "../intelligence/Atoms.jsx";
import { Tag } from "../ui/Primitives.jsx";
import { ToneDot } from "../icons/index.jsx";

/* Executive summary + the single highest-priority insight.
 *
 * Ported from `executiveSummary()` and `topInsight()`.
 */

function PriorityCount({ band, n }) {
  const p = PRIORITY[band];
  const wording =
    band === "HIGH"
      ? n === 1
        ? "requires immediate attention"
        : "require immediate attention"
      : band === "MEDIUM"
        ? "worth monitoring"
        : "low priority";
  return (
    <li
      className={cx(
        toneClass(p.tone),
        "nb-a-bg inline-flex items-center gap-2 border-2 border-line px-3 py-1.5 text-[13px]",
      )}
    >
      <ToneDot />
      <b className="nb-a-fg font-mono font-bold">{n}</b>
      <span>{wording}</span>
    </li>
  );
}

export function ExecutiveSummary({
  counts,
  trend,
  nextStep,
  findingCount,
  fullSummary,
  simulated,
}) {
  const rows = ["HIGH", "MEDIUM", "LOW"].filter((k) => counts[k] > 0);

  return (
    <Panel>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="nb-eyebrow mb-2">Today&apos;s Intelligence</span>
          <h2 className="text-xl font-bold uppercase tracking-tight sm:text-2xl">
            {counts.total} relevant development{counts.total === 1 ? "" : "s"} found
          </h2>
        </div>
        <SimTag on={simulated} />
      </div>

      <ul className="flex flex-wrap gap-2">
        {rows.length ? (
          rows.map((k) => <PriorityCount key={k} band={k} n={counts[k]} />)
        ) : (
          <li className="text-[13px] text-ink-3">
            No insights cleared the relevance bar.
          </li>
        )}
      </ul>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {trend ? (
          <div className={cx(accentClass("yellow"), "nb-a-bg border-l-[6px] nb-a-border px-3 py-2.5")}>
            <MiniLabel>Main trend</MiniLabel>
            <p className="text-[13px] text-ink-2">{trend}</p>
          </div>
        ) : null}
        {nextStep ? (
          <div className={cx(accentClass("purple"), "nb-a-bg border-l-[6px] nb-a-border px-3 py-2.5")}>
            <MiniLabel>Recommended next step</MiniLabel>
            <p className="text-[13px] text-ink-2">{nextStep}</p>
          </div>
        ) : null}
      </div>

      <p className="mt-4 text-[12px] text-ink-4">
        {findingCount} item(s) collected across all sources.
      </p>

      {fullSummary ? (
        <Reveal summary="Read the full analyst summary" className="mt-4" bare>
          <div className="space-y-3 text-[13.5px] leading-relaxed text-ink-2">
            {fullSummary.split("\n\n").map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </Reveal>
      ) : null}
    </Panel>
  );
}

/* ── hero insight ──────────────────────────────────────────────── */

export function HeroInsight({ insight, onOpenEvidence }) {
  if (!insight) return null;
  const cat = categoryOf(insight.source);
  const p = PRIORITY[insight.priority] || PRIORITY.MEDIUM;

  return (
    <Panel
      className={cx(
        toneClass(p.tone),
        "nb-a-border border-l-[10px] p-4 sm:p-6",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <span className="nb-eyebrow">Top Intelligence</span>
        <TagRow>
          <PriorityBadge priority={insight.priority} />
          <CategoryTag category={cat} />
          {insight.competitor ? (
            <Tag accent="orange">{insight.competitor}</Tag>
          ) : null}
          <SimTag on={insight.simulated} />
        </TagRow>
      </div>

      <h2 className="mt-3 mb-4 max-w-[52ch] text-xl font-bold leading-tight tracking-tight sm:text-2xl">
        {insight.title}
      </h2>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="bg-bg-2">
          <MiniLabel>What happened</MiniLabel>
          <p className="text-[13px] text-ink-2">{insight.what_happened}</p>
        </Card>
        <Card className={cx(accentClass("pink"), "nb-a-bg")}>
          <MiniLabel>Why it matters</MiniLabel>
          <p className="text-[13px] text-ink-2">{insight.why_it_matters}</p>
        </Card>
        <Card className={cx(accentClass("purple"), "nb-a-bg")}>
          <MiniLabel>Recommended action</MiniLabel>
          <p className="text-[13px] text-ink-2">{insight.recommended_action}</p>
        </Card>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t-2 border-line pt-3">
        <span className="text-[12px] text-ink-4">
          {insight.source} · {formatDate(insight.published_date)}
        </span>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              onOpenEvidence(insight.finding_id || insight.id)
            }
          >
            View evidence
          </Button>
          {insight.source_url ? (
            <Button
              as="a"
              size="sm"
              variant="ghost"
              href={insight.source_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              View source ↗
            </Button>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}
