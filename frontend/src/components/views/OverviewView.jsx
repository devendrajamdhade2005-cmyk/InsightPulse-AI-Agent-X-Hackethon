import { useState } from "react";
import { cx } from "../../lib/accents.js";
import { providerLabel, truncate } from "../../lib/format.js";
import { Swatch, donutColor } from "../charts/Charts.jsx";
import { Area3D, Donut3D, Network3D } from "../charts/Charts3D.jsx";
import { ConnectionChain } from "../feed/Cards.jsx";
import {
  Button,
  EmptyState,
  Meter,
  Note,
  Panel,
  PanelHead,
} from "../ui/Primitives.jsx";
import { LiveTag, MixedTag, SimTag } from "../intelligence/Atoms.jsx";
import { useRun } from "../../state/RunProvider.jsx";
import {
  Layers,
  Link2,
  Map,
  Microscope,
  TrendingUp,
  Users,
  Zap,
  trendIcon,
} from "../icons/index.jsx";

/* Overview: activity chart, emerging topics, source coverage, cross-source chains,
 * research landscape and attribution.
 *
 * Every panel renders a limited-data state rather than a fabricated figure when the
 * underlying metric could not be derived — which is why each one checks its own
 * data before drawing.
 */

const WINDOWS = [7, 30, 90, 365];

const growthLabel = (t) =>
  t.isNew
    ? "NEW"
    : t.growth === null
      ? "—"
      : `${t.growth > 0 ? "+" : ""}${Math.round(t.growth)}%`;

const growthColorClass = (t) =>
  t.isNew
    ? "text-brand-pink"
    : (t.growth ?? 0) > 0
      ? "text-brand-green"
      : "text-ink-4";

function ActivityChart() {
  const { activity, chartWindow, setChartWindow } = useRun();

  return (
    <Panel>
      <PanelHead
        eyebrow="Analytics"
        title="Intelligence Activity"
        sub="Findings by publication date, from this scan"
        actions={
          <div
            role="group"
            aria-label="Time window"
            className="flex border-2 border-line"
          >
            {WINDOWS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setChartWindow(d)}
                className={cx(
                  "px-2.5 py-1 text-[12px] font-bold uppercase",
                  d === chartWindow
                    ? "bg-brand-blue text-white"
                    : "bg-surface text-ink-3 hover:bg-bg-2",
                )}
              >
                {d === 365 ? "1Y" : `${d}D`}
              </button>
            ))}
          </div>
        }
      />

      {activity ? (
        <>
          <div className="w-full overflow-hidden">
            <Area3D series={activity} />
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-[11.5px] text-ink-3">
            <span>
              <Swatch color="var(--nb-blue)" />
              All findings
            </span>
            <span>
              <Swatch color="var(--nb-cyan)" />
              High relevance
            </span>
          </div>
          <Note>
            {activity.used} of {activity.total} finding(s) carry a publication date
            within {activity.windowDays} days.
          </Note>
        </>
      ) : (
        <EmptyState
          icon={TrendingUp}
          title="Not enough dated findings to chart"
          body="Only findings with a publication date can be plotted. Widen the time window, or run a scan that includes research or news sources."
        />
      )}
    </Panel>
  );
}

function TopicsPanel({ onSelectTopic }) {
  const { topics, filters } = useRun();
  if (!topics.length) {
    return (
      <Panel>
        <PanelHead eyebrow="Momentum" title="Emerging Topics" />
        <EmptyState
          icon={Zap}
          title="No recurring topics yet"
          body="Topics emerge when several findings share a theme. Try broader keywords or more sources."
        />
      </Panel>
    );
  }
  const max = Math.max(...topics.map((t) => t.count));

  return (
    <Panel>
      <PanelHead
        eyebrow="Momentum"
        title="Emerging Topics"
        sub="Derived from this scan · growth compares recent vs. earlier findings"
      />
      <ul className="grid gap-1.5">
        {topics.map((t) => {
          const isOn = filters.topic === t.key;
          const TrendIcon = trendIcon(t.growth, t.isNew);
          return (
            <li key={t.key}>
              <button
                type="button"
                onClick={() => onSelectTopic(t.key)}
                aria-pressed={isOn}
                /* Spelled out because a bare "+298%" tells a screen-reader user
                   nothing about what grew or over what period. */
                title={`${t.label} — ${t.count} finding(s), ${t.confidence}% average relevance, ${
                  t.isNew
                    ? "new in this window"
                    : t.growth === null
                      ? "no growth baseline"
                      : `${t.growth > 0 ? "up" : "down"} ${Math.abs(Math.round(t.growth))}% vs earlier findings`
                }. Click to filter insights by this topic.`}
                className={cx(
                  "nb-press group grid w-full grid-cols-[1fr_auto] items-center gap-3 border-2 border-line p-2.5 text-left sm:grid-cols-[1fr_5rem_4.5rem]",
                  isOn ? "bg-brand-blue-bg" : "bg-bg-2 hover:bg-surface",
                )}
              >
                <span className="min-w-0">
                  <b className="block truncate text-[13.5px] font-bold capitalize">
                    {t.label}
                  </b>
                  <span className="block text-[11.5px] text-ink-4">
                    {t.count} finding{t.count === 1 ? "" : "s"} · {t.confidence}% avg
                    relevance
                  </span>
                </span>
                <span className="hidden sm:block">
                  <Meter value={t.count} max={max} tone={t.isNew ? "pink" : "blue"} />
                </span>
                <span
                  className={cx(
                    "flex items-center justify-end gap-1 font-mono text-[12px] font-bold tabular-nums",
                    growthColorClass(t),
                  )}
                >
                  <TrendIcon
                    aria-hidden="true"
                    className="h-3.5 w-3.5 shrink-0"
                    strokeWidth={2.6}
                  />
                  {growthLabel(t)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <Note>
        Growth compares the recent half of the window against the earlier half.
        “New” means no earlier baseline existed.
      </Note>
    </Panel>
  );
}

function SourcesPanel() {
  const { sources } = useRun();
  // Shared hover index links the donut and the legend in both directions.
  const [hovered, setHovered] = useState(null);
  if (!sources.length) {
    return (
      <Panel>
        <PanelHead eyebrow="Evidence" title="Sources & Coverage" />
        <EmptyState
          icon={Layers}
          title="No sources recorded"
          body="Run a scan to populate source coverage."
        />
      </Panel>
    );
  }
  // Colour is attached here so the 3D donut can shade each slice's faces.
  const slices = sources.map((s, i) => ({
    label: providerLabel(s.key),
    count: s.count,
    color: donutColor(i),
  }));

  return (
    <Panel>
      <PanelHead
        eyebrow="Evidence"
        title="Sources & Coverage"
        sub="Where this intelligence came from"
      />
      <div className="grid items-center gap-5 sm:grid-cols-[210px_1fr]">
        <div className="grid place-items-center">
          {/* Hovering the donut highlights the matching legend row, and vice
              versa, so the two halves of this panel read as one thing. */}
          <Donut3D slices={slices} onHoverSlice={setHovered} />
        </div>
        <ul className="grid gap-0.5">
          {sources.map((s, i) => {
            const total = sources.reduce((a, x) => a + x.count, 0) || 1;
            const share = Math.round((s.count / total) * 100);
            const lit = hovered === null || hovered === i;
            return (
              <li key={s.key}>
                <div
                  onPointerEnter={() => setHovered(i)}
                  onPointerLeave={() => setHovered(null)}
                  title={`${providerLabel(s.key)} — ${s.count} finding(s), ${share}% of this scan, ${s.quality}% average relevance, ${
                    s.freshestDays === null
                      ? "no publication dates"
                      : `freshest ${s.freshestDays} day(s) old`
                  }${s.isSimulated ? " (simulated — no API key configured)" : s.isMixed ? " (mixed live and simulated)" : " (live)"}`}
                  className={cx(
                    "grid cursor-default grid-cols-[0.75rem_1fr_auto] items-center gap-2.5 rounded-md border-b border-line-soft px-1.5 py-1.5 text-[12.5px] transition-all last:border-b-0",
                    lit ? "opacity-100" : "opacity-45",
                    hovered === i && "bg-current/[0.05]",
                  )}
                >
                  <i
                    aria-hidden="true"
                    className="h-2.5 w-2.5 shrink-0 rounded-[3px] transition-transform"
                    style={{
                      background: donutColor(i),
                      transform: hovered === i ? "scale(1.45)" : "none",
                    }}
                  />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <b className="font-semibold">{providerLabel(s.key)}</b>
                      {s.isLive ? <LiveTag /> : null}
                      {s.isMixed ? <MixedTag /> : null}
                      {s.isSimulated ? <SimTag on /> : null}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-ink-4">
                      {s.freshestDays === null
                        ? "no dates"
                        : `freshest ${s.freshestDays}d`}{" "}
                      · {s.quality}% avg · {share}% of scan
                    </span>
                  </span>
                  <b className="shrink-0 font-mono font-bold tabular-nums">
                    {s.count}
                  </b>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </Panel>
  );
}

function ChainsPanel({ onOpenEvidence }) {
  const { connections } = useRun();
  return (
    <Panel>
      <PanelHead
        eyebrow="Cross-source analysis"
        title="Connected Intelligence"
        sub="Signals that appear across more than one source type"
      />
      {connections.length ? (
        <div className="grid gap-3 xl:grid-cols-2">
          {connections.map((c) => (
            <ConnectionChain
              key={c.key}
              chain={c}
              onOpenEvidence={onOpenEvidence}
              onExplore={() => onOpenEvidence(c.members[0].id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Link2}
          title="No cross-source connections found"
          body="Connections need the same company or signal to appear in two different source types. Add competitors, or include more source types in the scan."
        />
      )}
    </Panel>
  );
}

function LandscapePanel({ onSelectTopic }) {
  const { landscape } = useRun();
  return (
    <Panel>
      <PanelHead
        eyebrow="Map"
        title="Research Landscape"
        sub="Bubble size = volume · colour = growth · click to filter"
      />
      {landscape.length >= 2 ? (
        <>
          <Bubbles items={landscape} onSelect={onSelectTopic} />
          <Note>
            Pink = new this window · red/amber = fastest growing · grey = declining
          </Note>
        </>
      ) : (
        <EmptyState
          icon={Map}
          title="Landscape needs more topics"
          body="At least two recurring topics are required to map the space."
        />
      )}
    </Panel>
  );
}

function PeoplePanel() {
  const { contributors } = useRun();
  const anySim = contributors.some((c) => c.simulated || c.partlySimulated);

  return (
    <Panel>
      <PanelHead
        eyebrow="Attribution"
        title="Top Contributors"
        sub="Ranked by citations recorded on this scan's findings"
      />
      {contributors.length ? (
        <>
          <ol className="grid gap-1.5">
            {contributors.map((c, i) => (
              <li
                key={c.name}
                className="grid grid-cols-[1.75rem_1fr_auto] items-center gap-3 border-2 border-line-soft bg-bg-2 px-2.5 py-2"
              >
                <span className="font-mono text-[11.5px] font-bold text-ink-4">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0">
                  <b className="flex flex-wrap items-center gap-1.5 text-[13px] font-bold">
                    <span className="truncate">{truncate(c.name, 40)}</span>
                    {c.simulated ? <SimTag on /> : null}
                    {c.partlySimulated ? <MixedTag>Partly simulated</MixedTag> : null}
                  </b>
                  <em className="block truncate not-italic text-[11px] text-ink-4">
                    {c.institution ||
                      c.venue ||
                      (c.kind === "organisation" ? "patent assignee" : "researcher")}
                  </em>
                </span>
                <span className="text-right">
                  <b className="block font-mono text-[14px] font-bold tabular-nums">
                    {c.citations ? c.citations.toLocaleString() : c.works}
                  </b>
                  <span className="nb-label text-[9px]">
                    {c.citations
                      ? "citations"
                      : `finding${c.works === 1 ? "" : "s"}`}
                  </span>
                </span>
              </li>
            ))}
          </ol>
          {anySim ? (
            <Note>
              Entries marked SIMULATED come from providers with no API key configured
              and are not real attribution. Configure a Semantic Scholar key for live
              author data.
            </Note>
          ) : null}
        </>
      ) : (
        <EmptyState
          icon={Users}
          title="No attribution available"
          body="The providers used in this scan did not return author or assignee data. Research and patent sources supply it."
        />
      )}
    </Panel>
  );
}

export function OverviewView({ onOpenEvidence, onSelectTopic, onScrollToSearch }) {
  const { hasRun } = useRun();

  if (!hasRun) {
    return (
      <EmptyState
        icon={Microscope}
        title="No intelligence discovered yet"
        body="Set a tracking goal above and run a scan. The agent will decide which sources to search, read what it finds, and report only what matters."
        action={<Button onClick={onScrollToSearch}>Run Intelligence Scan</Button>}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ActivityChart />
      <div className="grid gap-4 xl:grid-cols-2">
        <TopicsPanel onSelectTopic={onSelectTopic} />
        <SourcesPanel />
      </div>
      <ChainsPanel onOpenEvidence={onOpenEvidence} />
      <div className="grid gap-4 xl:grid-cols-2">
        <LandscapePanel onSelectTopic={onSelectTopic} />
        <PeoplePanel />
      </div>
    </div>
  );
}
