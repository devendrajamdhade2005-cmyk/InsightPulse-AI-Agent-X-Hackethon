import { CATEGORY, categoryLabel } from "../../lib/format.js";
import { accentClass, cx } from "../../lib/accents.js";
import {
  Building2,
  Microscope,
  Newspaper,
  Target,
  categoryIconFor,
} from "../icons/index.jsx";
import { Stack3D } from "../charts/Charts3D.jsx";
import { CompetitorCard } from "../feed/Cards.jsx";
import { FeedRow, PatentRow } from "../feed/FeedRow.jsx";
import { ActiveFilters, InsightFilters } from "../feed/Filters.jsx";
import { Button, EmptyState, Panel, PanelHead } from "../ui/Primitives.jsx";
import { useRun } from "../../state/RunProvider.jsx";

/* The five evidence views. All are client-side projections over one run, so
 * switching between them never refetches and never re-runs the agent. */

function NoRun({ onScrollToSearch }) {
  return (
    <EmptyState
      icon={Microscope}
      title="Run a scan first"
      body="This section reads the results of a completed scan."
      action={<Button onClick={onScrollToSearch}>Run Intelligence Scan</Button>}
    />
  );
}

/** research + patents. `category` is the finding.source value. */
export function FeedView({ category, onOpenEvidence, onScrollToSearch }) {
  const { hasRun, visibleFindings, insightForFinding } = useRun();
  if (!hasRun) return <NoRun onScrollToSearch={onScrollToSearch} />;

  const items = visibleFindings(category);
  const Row = category === "patent" ? PatentRow : FeedRow;

  return (
    <div>
      <ActiveFilters />
      {items.length ? (
        <div className="flex flex-col gap-3">
          {items.map((f) => (
            <Row
              key={f.id}
              finding={f}
              insight={insightForFinding(f.id)}
              onOpenEvidence={onOpenEvidence}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={categoryIconFor(category)}
          title={`No ${categoryLabel(category).toLowerCase()} found`}
          body="Try broader keywords, a longer time window, or a goal that points at this source type."
        />
      )}
    </div>
  );
}

/** News merges the curated-news and live-web categories, ranked together. */
export function NewsView({ onOpenEvidence, onScrollToSearch }) {
  const { hasRun, visibleFindings, insightForFinding } = useRun();
  if (!hasRun) return <NoRun onScrollToSearch={onScrollToSearch} />;

  const items = [...visibleFindings("news"), ...visibleFindings("web")].sort(
    (a, b) => (b.relevance || 0) - (a.relevance || 0),
  );

  return (
    <div>
      <ActiveFilters />
      {items.length ? (
        <div className="flex flex-col gap-3">
          {items.map((f) => (
            <FeedRow
              key={f.id}
              finding={f}
              insight={insightForFinding(f.id)}
              onOpenEvidence={onOpenEvidence}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Newspaper}
          title="No industry news found"
          body="The curated feeds and live web search returned nothing matching this goal in the window."
        />
      )}
    </div>
  );
}

export function CompetitorsView({ onViewSignals, onScrollToSearch }) {
  const { hasRun, competitors } = useRun();
  if (!hasRun) return <NoRun onScrollToSearch={onScrollToSearch} />;

  if (!competitors.length) {
    return (
      <EmptyState
        icon={Building2}
        title="No competitors being tracked"
        body="Add company names to the Competitors field and run a scan. The agent will search news, repos, forums and the live web for each one."
        action={<Button onClick={onScrollToSearch}>Add competitors</Button>}
      />
    );
  }

  // The 3D stack needs a resolved colour per category, not an accent name.
  const ACCENT_VAR = {
    blue: "var(--nb-blue)",
    cyan: "var(--nb-cyan)",
    orange: "var(--nb-orange)",
    green: "var(--nb-green)",
    purple: "var(--nb-purple)",
    slate: "var(--nb-slate)",
  };
  const stackKeys = ["research", "patent", "news", "web", "competitor"].map((key) => ({
    key,
    label: categoryLabel(key),
    color: ACCENT_VAR[CATEGORY[key]?.accent] || "var(--nb-slate)",
  }));

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <PanelHead
          eyebrow="Comparison"
          title="Competitive Position"
          sub="Signal volume by source type, from this scan"
        />
        <Stack3D rows={competitors} keys={stackKeys} />
        <div className="mt-4 flex flex-wrap gap-3 text-[11.5px] text-ink-3">
          {stackKeys.map((k) => (
            <span key={k.key} className="inline-flex items-center gap-1.5">
              <i
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 rounded-[3px]"
                style={{ background: k.color }}
              />
              {k.label}
            </span>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        {competitors.map((c) => (
          <CompetitorCard key={c.name} competitor={c} onViewSignals={onViewSignals} />
        ))}
      </div>
    </div>
  );
}

export function InsightsView({ onOpenEvidence, onScrollToSearch }) {
  const { hasRun, visibleInsights, findingById } = useRun();
  if (!hasRun) return <NoRun onScrollToSearch={onScrollToSearch} />;

  const items = visibleInsights;

  return (
    <div>
      <InsightFilters />
      {items.length ? (
        <div className="flex flex-col gap-3">
          {items.map((insight) => {
            const f = findingById(insight.finding_id);
            if (!f) return null;
            return (
              <FeedRow
                key={insight.finding_id}
                finding={f}
                insight={insight}
                onOpenEvidence={onOpenEvidence}
              />
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Target}
          title="Nothing matches these filters"
          body="Clear a filter, or run a broader scan."
        />
      )}
    </div>
  );
}
