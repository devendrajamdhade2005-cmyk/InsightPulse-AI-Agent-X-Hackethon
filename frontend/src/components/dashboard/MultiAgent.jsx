import { accentClass, cx, toneClass } from "../../lib/accents.js";
import { truncate } from "../../lib/format.js";
import { Badge, Card, MiniLabel, Tag, TagRow } from "../ui/Primitives.jsx";
import {
  AlertTriangle,
  ArrowDown,
  Ban,
  ChartColumn,
  Check,
  CircleDot,
  Handshake,
  Minus,
  X,
  agentIcon,
  collabIcon,
} from "../icons/index.jsx";

/* Multi-agent execution view.
 *
 * Every value comes from the real `execution_plan`, `agents` and
 * `collaboration_events`. Nothing is decorative: if the orchestrator skipped an
 * agent, this panel shows which one and why.
 *
 * Agent payloads carry an emoji in `icon`; it is ignored in favour of a vector
 * mapped from the agent key, so no backend change is needed.
 */

const COVERAGE = {
  live: { label: "LIVE", tone: "green" },
  partial: { label: "PARTIAL COVERAGE", tone: "amber" },
  simulated: { label: "SIMULATED", tone: "amber" },
  unavailable: { label: "UNAVAILABLE", tone: "red" },
};

const STATUS = {
  completed: { label: "COMPLETED", tone: "green", Glyph: Check },
  partial: { label: "PARTIAL", tone: "amber", Glyph: AlertTriangle },
  degraded: { label: "DEGRADED", tone: "amber", Glyph: AlertTriangle },
  skipped: { label: "SKIPPED", tone: "slate", Glyph: Minus },
  failed: { label: "FAILED", tone: "red", Glyph: X },
};

const KIND_LABEL = {
  follow_up: "Follow-up task",
  corroboration: "Cross-validated",
  handoff: "Context linked",
  merge: "Merged",
  gap_fill: "Gap filled",
};

const ROLE = {
  research_agent: "Research papers, trends & patents",
  competitive_agent: "Competitors & live market intelligence",
  orchestrator: "Workflow control & agent delegation",
};

const TOOL_NOTE = { web_search: "Tavily" };
const toolLabel = (t) => (TOOL_NOTE[t] ? `${t} (${TOOL_NOTE[t]})` : t);
const titleCase = (s) => s.charAt(0) + s.slice(1).toLowerCase();

const SHORT_AGENT = {
  research_agent: "Research Agent",
  competitive_agent: "Competitive Agent",
  orchestrator: "Orchestrator",
};

function Node({ Icon, name, accent, status, meta }) {
  const st = status ? STATUS[status] || STATUS.completed : null;
  return (
    <div
      className={cx(
        accentClass(accent),
        "nb-frame-flat nb-a-border border-l-[6px] bg-surface p-3",
      )}
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="nb-a-bg grid h-8 w-8 shrink-0 place-items-center border-2 border-line">
          <Icon aria-hidden="true" className="nb-a-fg h-4 w-4" strokeWidth={2.3} />
        </span>
        <span className="min-w-0 flex-1 text-[13.5px] font-bold">{name}</span>
        {st ? (
          <span
            className={cx(
              toneClass(st.tone),
              "nb-a-fg flex items-center gap-1 text-[11.5px] font-bold whitespace-nowrap",
            )}
          >
            <st.Glyph aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.8} />
            {titleCase(st.label)}
          </span>
        ) : null}
      </div>
      <dl className="mt-2 ml-10 grid gap-y-0.5 text-[12px]">
        {meta.map(([k, v], i) => (
          <div key={i} className="grid grid-cols-[auto_1fr] gap-2">
            <dt className="font-semibold whitespace-nowrap text-ink-4">
              {k ? `${k}:` : "•"}
            </dt>
            <dd className="m-0 min-w-0 break-words text-ink-2">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const Arrow = () => (
  <ArrowDown
    aria-hidden="true"
    className="mx-auto my-1 h-4 w-4 text-ink-4"
    strokeWidth={2.4}
  />
);

function Pipeline({ orchestrator, specialists, selected, events, result }) {
  const corroborated = result.metrics?.corroborated_findings ?? 0;
  const stages = [];

  if (orchestrator) {
    stages.push(
      <Node
        key="orch"
        Icon={agentIcon("orchestrator")}
        name={orchestrator.name}
        accent={orchestrator.accent || "purple"}
        status={orchestrator.status}
        meta={[
          [
            "Decision",
            `Selected ${selected.length} specialized agent${selected.length === 1 ? "" : "s"}`,
          ],
        ]}
      />,
    );
  }

  if (specialists.length) {
    stages.push(
      <div key="lane" className="grid gap-2 lg:grid-cols-2">
        {specialists.map((a) => (
          <Node
            key={a.agent}
            Icon={agentIcon(a.agent)}
            name={a.name}
            accent={a.accent || "blue"}
            status={a.status}
            meta={[
              ["Role", ROLE[a.agent] || truncate(a.responsibility || "", 72)],
              ["Tools", (a.tools_used || []).map(toolLabel).join(", ") || "none called"],
            ]}
          />
        ))}
      </div>,
    );
  }

  stages.push(
    <Node
      key="collab"
      Icon={events.length ? Handshake : Ban}
      name="Collaboration"
      accent={events.length ? "purple" : "slate"}
      meta={
        events.length
          ? [
              ["", `${events.length} collaboration event${events.length === 1 ? "" : "s"}`],
              ["", `${corroborated} finding${corroborated === 1 ? "" : "s"} corroborated`],
            ]
          : [["", "Not required — one specialist covered this goal"]]
      }
    />,
  );

  stages.push(
    <Node
      key="report"
      Icon={ChartColumn}
      name="Combined Intelligence Report"
      accent="green"
      meta={[
        [
          "",
          `${result.findings?.length ?? 0} findings · ${result.insights?.length ?? 0} prioritized insight${
            (result.insights?.length ?? 0) === 1 ? "" : "s"
          }`,
        ],
      ]}
    />,
  );

  return (
    <div className="grid">
      {stages.map((stage, i) => (
        <div key={i}>
          {i ? <Arrow /> : null}
          {stage}
        </div>
      ))}
    </div>
  );
}

function AgentCard({ agent: a }) {
  const st = STATUS[a.status] || STATUS.completed;
  const cov = COVERAGE[a.coverage] || COVERAGE.live;
  const Icon = agentIcon(a.agent);

  const extras = [];
  if (a.research_trends?.length)
    extras.push(["Recurring themes", a.research_trends.slice(0, 4).join(", ")]);
  if (a.key_developments?.length)
    extras.push([
      "Key developments",
      a.key_developments.slice(0, 2).map((d) => truncate(d, 64)).join(" · "),
    ]);
  if (a.competitors_analyzed?.length)
    extras.push(["Companies analysed", a.competitors_analyzed.slice(0, 5).join(", ")]);
  if (a.market_signals?.length)
    extras.push(["Market signals", a.market_signals.slice(0, 4).join(", ")]);
  if (a.degraded_providers?.length)
    extras.push([
      "Degraded providers",
      a.degraded_providers.map((d) => d.provider).join(", "),
    ]);

  return (
    <article
      className={cx(
        accentClass(a.accent || "blue"),
        "nb-frame nb-a-border border-t-[6px] p-4",
      )}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[14.5px] font-bold uppercase tracking-tight">
          <Icon aria-hidden="true" className="nb-a-fg h-4 w-4" strokeWidth={2.4} />
          {a.name}
        </span>
        <TagRow>
          <Badge tone={st.tone}>{st.label}</Badge>
          <Badge tone={cov.tone}>{cov.label}</Badge>
        </TagRow>
      </div>
      <p className="mb-3 text-[12.5px] text-ink-3">{a.responsibility}</p>

      <div className="mb-3 flex flex-wrap gap-4">
        {[
          [a.findings_count ?? 0, "findings"],
          [a.relevant_count ?? 0, "relevant"],
          [`${Math.round((a.confidence || 0) * 100)}%`, "confidence"],
          [a.corroborated ?? 0, "cross-validated"],
        ].map(([value, label]) => (
          <span key={label} className="flex flex-col">
            <b className="font-mono text-lg font-bold tabular-nums">{value}</b>
            <span className="nb-label text-[9px]">{label}</span>
          </span>
        ))}
      </div>

      {a.tools_used?.length ? (
        <div className="mb-2">
          <MiniLabel>Tools used</MiniLabel>
          <TagRow>
            {a.tools_used.map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
          </TagRow>
        </div>
      ) : null}

      {a.sources_checked?.length ? (
        <div className="mb-2">
          <MiniLabel>Providers queried</MiniLabel>
          <TagRow>
            {a.sources_checked.map((p) => (
              <Tag key={p}>{p}</Tag>
            ))}
          </TagRow>
        </div>
      ) : null}

      {a.summary ? <p className="mt-2 text-[12.5px] text-ink-2">{a.summary}</p> : null}
      {extras.map(([k, v]) => (
        <p key={k} className="mt-1.5 text-[12px] text-ink-3">
          <b className="font-bold">{k}:</b> {v}
        </p>
      ))}
      {a.errors?.length ? (
        <p className="mt-1.5 text-[12px] font-semibold text-brand-red">
          <b>Errors handled:</b> {a.errors.join("; ")}
        </p>
      ) : null}
    </article>
  );
}

export function MultiAgent({ result }) {
  const plan = result.execution_plan || [];
  const agents = result.agents || [];
  const events = result.collaboration_events || [];

  if (!agents.length) {
    return (
      <p className="text-[12.5px] text-ink-3">
        No multi-agent data was recorded for this run.
      </p>
    );
  }

  const specialists = agents.filter((a) => a.agent !== "orchestrator");
  const orchestrator = agents.find((a) => a.agent === "orchestrator");
  const selected = plan.filter((p) => p.selected);
  const skipped = plan.filter((p) => !p.selected);
  const OrchIcon = agentIcon("orchestrator");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="nb-eyebrow mb-2">Multi-agent execution</span>
        <p className="text-[13.5px] text-ink-2">
          The orchestrator selected <b className="text-ink">{selected.length}</b> of{" "}
          <b className="text-ink">{plan.length}</b> specialist
          {plan.length === 1 ? "" : "s"} from your goal, ran {specialists.length} of
          them, and recorded <b className="text-ink">{events.length}</b> collaboration
          event{events.length === 1 ? "" : "s"}.
        </p>
      </div>

      <Pipeline
        orchestrator={orchestrator}
        specialists={specialists}
        selected={selected}
        events={events}
        result={result}
      />

      {/* who was chosen, and who was not */}
      <Card className="bg-bg-2">
        <MiniLabel>Orchestrator&apos;s agent-selection decisions</MiniLabel>
        <ul className="mt-2 grid gap-2">
          {[...selected, ...skipped].map((p, i) => (
            <li
              key={i}
              className="grid gap-1 border-b border-line-soft pb-2 last:border-b-0 last:pb-0"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={cx(
                    "text-[13px] font-semibold",
                    !p.selected && "text-ink-3",
                  )}
                >
                  {p.name}
                </span>
                <Badge tone={p.selected ? "green" : "slate"}>
                  {p.selected ? "SELECTED" : "NOT SELECTED"}
                </Badge>
              </div>
              <span className="text-[12px] text-ink-3">{p.reason}</span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        {specialists.map((a) => (
          <AgentCard key={a.agent} agent={a} />
        ))}
        {orchestrator ? (
          <article
            className={cx(accentClass("purple"), "nb-frame nb-a-bg p-4 lg:col-span-2")}
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-[14.5px] font-bold uppercase tracking-tight">
                <OrchIcon aria-hidden="true" className="h-4 w-4" strokeWidth={2.4} />
                {orchestrator.name}
              </span>
              <Badge tone="purple">COORDINATOR</Badge>
            </div>
            <p className="mb-2 text-[12.5px] text-ink-3">
              {orchestrator.responsibility}
            </p>
            <ul className="grid list-disc gap-1 pl-5">
              {(orchestrator.bullets || []).map((b, i) => (
                <li key={i} className="text-[12.5px] text-ink-2">
                  {b}
                </li>
              ))}
            </ul>
          </article>
        ) : null}
      </div>

      {/* collaboration */}
      <Card className={cx(accentClass("purple"), "nb-a-bg")}>
        <MiniLabel>
          Collaboration events{events.length ? ` (${events.length})` : ""}
        </MiniLabel>
        {events.length ? (
          <ul className="mt-2 grid gap-2.5">
            {events.map((e, i) => {
              const KindIcon = collabIcon(e.kind);
              return (
                <li key={i} className="grid grid-cols-[auto_1fr] gap-2.5">
                  <span className="flex items-center gap-1.5 border-2 border-line bg-surface px-2 py-0.5 text-[10.5px] font-bold whitespace-nowrap text-brand-purple">
                    <KindIcon
                      aria-hidden="true"
                      className="h-3 w-3"
                      strokeWidth={2.6}
                    />
                    {KIND_LABEL[e.kind] || e.kind}
                  </span>
                  <span className="min-w-0">
                    <b className="block text-[13px] font-semibold">{e.summary}</b>
                    <span className="block text-[12px] text-ink-3">{e.detail}</span>
                    {e.participants?.length ? (
                      <span className="mt-1 block font-mono text-[11px] text-brand-purple">
                        {e.participants.map((p) => SHORT_AGENT[p] || p).join(" → ")}
                      </span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-[12.5px] text-ink-3">
            No cross-agent collaboration was required for this goal — a single
            specialist covered it end to end.
          </p>
        )}
      </Card>
    </div>
  );
}
