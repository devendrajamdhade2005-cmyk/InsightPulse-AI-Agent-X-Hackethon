import { accentClass, cx, toneClass } from "../../lib/accents.js";
import {
  ago,
  categoryAccent,
  formatDate,
  providerLabel,
  relevanceBand,
  truncate,
} from "../../lib/format.js";
import { Scroll, ToneDot, categoryIconFor } from "../icons/index.jsx";
import { Badge, Button, MetricPill, MiniLabel, TagRow, Tag } from "../ui/Primitives.jsx";
import {
  CategoryTag,
  RelevanceBadge,
  SignalTags,
  SimTag,
} from "../intelligence/Atoms.jsx";

/* Intelligence feed row — research / news / web / competitor findings. */

/* Right-hand metric column.
 *
 * Given a fixed width rather than `shrink-0` alone: the labels ("relevance",
 * "citations") are wider than their values, so an auto-width column let the text
 * run into the card edge and clip. A reserved column also keeps the numbers
 * aligned down a list of rows instead of jittering per card.
 */
function Stats({ finding }) {
  const meta = finding.meta || {};
  const stats = [];
  if (finding.relevance != null)
    stats.push(["relevance", `${Math.round(finding.relevance * 100)}%`]);
  if (meta.citation_count) stats.push(["citations", meta.citation_count]);
  if (meta.stars) stats.push(["stars", meta.stars]);
  if (meta.points) stats.push(["points", meta.points]);
  if (meta.tavily_score) stats.push(["rank", meta.tavily_score.toFixed(2)]);
  if (!stats.length) return null;
  return (
    <div className="flex shrink-0 flex-row flex-wrap gap-x-5 gap-y-2 border-t border-line-soft pt-3 sm:w-[5.5rem] sm:flex-col sm:items-end sm:gap-2.5 sm:border-t-0 sm:pt-0.5">
      {stats.map(([label, value]) => (
        <MetricPill key={label} label={label} value={value} />
      ))}
    </div>
  );
}

function Insight({ insight }) {
  if (!insight) return null;
  return (
    <div className="mb-3 grid gap-3 border-2 border-line-soft bg-bg-2 p-3 lg:grid-cols-2">
      <div>
        <MiniLabel>Why it matters</MiniLabel>
        <p className="text-[12.5px] text-ink-2">
          {truncate(insight.why_it_matters, 200)}
        </p>
      </div>
      <div>
        <MiniLabel>Recommended action</MiniLabel>
        <p className="text-[12.5px] text-ink-2">
          {truncate(insight.recommended_action, 160)}
        </p>
      </div>
    </div>
  );
}

export function FeedRow({ finding, insight, onOpenEvidence }) {
  const band = relevanceBand(finding.relevance);
  const meta = finding.meta || {};
  const cat = finding.source;
  const CatIcon = categoryIconFor(cat);
  const byline = [
    finding.author ? truncate(finding.author, 68) : "",
    meta.venue || meta.outlet || providerLabel(finding.provider),
    finding.published_date ? ago(finding.published_date) : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const linkLabel =
    cat === "research" ? "Read paper" : cat === "patent" ? "Open filing" : "Open source";

  return (
    <article
      className={cx(
        accentClass(categoryAccent(cat)),
        "nb-frame nb-lift flex flex-col gap-3 overflow-hidden p-4 sm:flex-row sm:gap-4",
      )}
    >
      <div className="flex shrink-0 flex-row items-center gap-2 sm:flex-col">
        <span className="nb-a-bg grid h-9 w-9 place-items-center border-2 border-line">
          <CatIcon aria-hidden="true" className="nb-a-fg h-4 w-4" strokeWidth={2.3} />
        </span>
        <span title={band.label} className={toneClass(band.tone)}>
          <ToneDot />
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <TagRow className="mb-2">
          <RelevanceBadge score={finding.relevance} />
          <CategoryTag category={cat} />
          {finding.competitor ? <Tag accent="orange">{finding.competitor}</Tag> : null}
          <SignalTags signals={finding.signals} />
          <SimTag on={finding.simulated} />
        </TagRow>

        <h3 className="mb-1 text-[15px] font-bold leading-snug break-words">
          {finding.title}
        </h3>
        {byline ? (
          <p className="mb-2 break-words text-[12px] text-ink-4">{byline}</p>
        ) : null}
        {finding.summary ? (
          <p className="mb-3 text-[13px] text-ink-2">
            {truncate(finding.summary, 260)}
          </p>
        ) : null}

        <Insight insight={insight} />

        <div className="flex flex-wrap items-center gap-2">
          <Button size="xs" variant="ghost" onClick={() => onOpenEvidence(finding.id)}>
            Evidence
          </Button>
          {finding.url ? (
            <Button
              as="a"
              size="xs"
              variant="ghost"
              href={finding.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {linkLabel} ↗
            </Button>
          ) : null}
          <span className="ml-auto shrink-0 truncate text-[11px] text-ink-4">
            {providerLabel(finding.provider)}
          </span>
        </div>
      </div>

      <Stats finding={finding} />
    </article>
  );
}

/* ── patent row: assignee-forward, competitor IP flagged ─────── */
export function PatentRow({ finding, insight, onOpenEvidence }) {
  const meta = finding.meta || {};
  const assignee = meta.assignee || finding.author || finding.competitor || "";
  const isCompetitor = Boolean(finding.competitor);

  return (
    <article
      className={cx(
        accentClass("cyan"),
        "nb-frame nb-lift flex flex-col gap-3 overflow-hidden p-4 sm:flex-row sm:gap-4",
        isCompetitor && "border-l-[8px] border-l-brand-red",
      )}
    >
      <div className="flex shrink-0 flex-row items-center gap-2 sm:flex-col">
        <span className="nb-a-bg grid h-9 w-9 place-items-center border-2 border-line">
          <Scroll aria-hidden="true" className="nb-a-fg h-4 w-4" strokeWidth={2.3} />
        </span>
        <span className={toneClass(isCompetitor ? "red" : "blue")}>
          <ToneDot />
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <TagRow className="mb-2">
          {isCompetitor ? (
            <Badge tone="red">
              <ToneDot />
              Competitor-owned IP
            </Badge>
          ) : (
            <RelevanceBadge score={finding.relevance} />
          )}
          <CategoryTag category="patent" />
          {meta.patent_number ? <Tag>{meta.patent_number}</Tag> : null}
          <SimTag on={finding.simulated} />
        </TagRow>

        <h3 className="mb-1 text-[15px] font-bold leading-snug break-words">
          {finding.title}
        </h3>
        <p className="mb-2 text-[12px] text-ink-4">
          {assignee ? (
            <>
              Assignee: <b className="text-ink-2">{truncate(assignee, 48)}</b>
            </>
          ) : (
            "Assignee unknown"
          )}
          {meta.filing_date ? ` · filed ${formatDate(meta.filing_date)}` : ""}
          {finding.published_date
            ? ` · published ${formatDate(finding.published_date)}`
            : ""}
          {meta.cpc ? ` · CPC ${meta.cpc}` : ""}
        </p>
        {finding.summary ? (
          <p className="mb-3 text-[13px] text-ink-2">
            {truncate(finding.summary, 240)}
          </p>
        ) : null}

        {insight ? (
          <div className="mb-3 grid gap-3 border-2 border-line-soft bg-bg-2 p-3 lg:grid-cols-2">
            <div>
              <MiniLabel>Strategic significance</MiniLabel>
              <p className="text-[12.5px] text-ink-2">
                {truncate(insight.why_it_matters, 200)}
              </p>
            </div>
            <div>
              <MiniLabel>Recommended action</MiniLabel>
              <p className="text-[12.5px] text-ink-2">
                {truncate(insight.recommended_action, 160)}
              </p>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button size="xs" variant="ghost" onClick={() => onOpenEvidence(finding.id)}>
            Evidence
          </Button>
          {finding.url ? (
            <Button
              as="a"
              size="xs"
              variant="ghost"
              href={finding.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open filing ↗
            </Button>
          ) : null}
          <span className="ml-auto shrink-0 truncate text-[11px] text-ink-4">
            {providerLabel(finding.provider)}
          </span>
        </div>
      </div>

      {finding.relevance != null ? (
        <div className="shrink-0 sm:text-right">
          <MetricPill
            label="relevance"
            value={`${Math.round(finding.relevance * 100)}%`}
          />
        </div>
      ) : null}
    </article>
  );
}
