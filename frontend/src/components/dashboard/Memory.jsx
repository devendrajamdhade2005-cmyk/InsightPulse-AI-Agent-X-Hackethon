import { accentClass, cx, toneClass } from "../../lib/accents.js";
import { truncate } from "../../lib/format.js";
import { Badge, Card, MiniLabel, Tag, TagRow } from "../ui/Primitives.jsx";
import {
  Brain,
  Building2,
  Check,
  CircleDot,
  Loader,
  Microscope,
  Minus,
  X,
} from "../icons/index.jsx";

/* Context & Memory view.
 *
 * Rendered entirely from the `memory` block the backend returns. There is no
 * placeholder content anywhere here: if nothing was retrieved it says so, because
 * a fabricated "3 memories found" would defeat the point of the panel, which is to
 * be evidence.
 */

const IMPORTANCE_TONE = {
  CRITICAL: "red",
  HIGH: "green",
  MEDIUM: "amber",
  LOW: "slate",
};

const STEP_TONE = {
  completed: "green",
  in_progress: "amber",
  pending: "slate",
  skipped: "slate",
  failed: "red",
};

const STEP_GLYPH = {
  completed: Check,
  in_progress: Loader,
  pending: CircleDot,
  skipped: Minus,
  failed: X,
};

const AGENT_ICON = {
  research_agent: Microscope,
  competitive_agent: Building2,
  orchestrator: Brain,
};

const AGENT_NAME = {
  research_agent: "Research Intelligence Agent",
  competitive_agent: "Competitive Intelligence Agent",
  orchestrator: "Intelligence Orchestrator",
};

const MILESTONES = [
  ["Task Context", "Captured", (t) => t.some((e) => e.event === "task_context_captured")],
  ["Execution Plan", "Stored", (t) => t.some((e) => e.event === "plan_stored")],
  ["Agent Findings", "Retained", (t) => t.some((e) => e.event === "agent_findings_recorded")],
  ["Shared Context", "Passed between agents", (t, m) => (m.shared_events || 0) > 0],
  [
    "Cross-Agent Analysis",
    "Consolidated",
    (t) =>
      t.some(
        (e) =>
          e.event === "compared_with_baseline" || e.event === "memory_consolidated",
      ),
  ],
];

const Block = ({ label, tone, children }) => (
  <Card className={tone ? cx(accentClass(tone), "nb-a-bg") : "bg-bg-2"}>
    <MiniLabel>{label}</MiniLabel>
    {children}
  </Card>
);

export function Memory({ result }) {
  const mem = result?.memory;
  if (!mem || !mem.available || !mem.working) {
    return (
      <p className="text-[12.5px] text-ink-3">
        No context or memory data was recorded for this run.
      </p>
    );
  }

  const w = mem.working;
  const lt = mem.long_term || {};
  const change = mem.change || {};
  const ctx = w.task_context;
  const timeline = w.timeline || [];
  const planSteps = w.plan_steps || [];
  const facts = w.facts || [];

  const sharedEvents = (result?.agents || []).filter(
    (a) => (a.context_shared_from || []).length > 0,
  ).length;

  const ctxAgents = (result?.agents || []).filter(
    (a) => (a.context_received || []).length,
  );

  const notes = [...(w.notes || [])];
  if (lt.store && lt.store.degraded) notes.push(lt.store.degraded);

  const chips = ctx
    ? [
        ...(ctx.topics || []).map((t) => ({ text: t, cls: "topic" })),
        ...(ctx.domain_labels || []).map((d) => ({ text: d, cls: "domain" })),
        ...(ctx.competitors || []).map((c) => ({ text: c, cls: "company" })),
      ]
    : [];

  const ctxMeta = [];
  if (ctx) {
    if (ctx.time_scope && ctx.time_scope !== "unspecified")
      ctxMeta.push(["Time scope", ctx.time_scope]);
    if ((ctx.constraints || []).length)
      ctxMeta.push(["Constraints", ctx.constraints.join("; ")]);
    if (ctx.continuation)
      ctxMeta.push([
        "Continuation",
        ctx.subjectless
          ? "goal refers back to earlier monitoring — subject restored from memory"
          : "goal continues earlier monitoring",
      ]);
    ctxMeta.push(["Extracted by", ctx.author || "heuristic"]);
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div>
        <span className="nb-eyebrow mb-2">Context &amp; memory</span>
        <p className="text-[13.5px] text-ink-2">
          Working memory reached <b className="text-ink">version {w.version}</b>,
          retaining <b className="text-ink">{w.fact_count}</b> fact
          {w.fact_count === 1 ? "" : "s"} ({w.important_fact_count} important) across{" "}
          <b className="text-ink">{planSteps.length}</b> plan step
          {planSteps.length === 1 ? "" : "s"}.{" "}
          {lt.retrieved_count
            ? `${lt.retrieved_count} relevant memory item${lt.retrieved_count === 1 ? "" : "s"} were retrieved from previous runs.`
            : "No previous context was retrieved for this goal."}
        </p>
      </div>

      {ctx ? (
        <Block label="Current task context">
          <TagRow className="my-2">
            {chips.length ? (
              chips.map((c, i) => (
                <span
                  key={i}
                  className={cx(
                    "border-2 px-2 py-0.5 text-[12px] font-semibold",
                    c.cls === "topic" && "border-brand-blue text-brand-blue",
                    c.cls === "company" && "border-brand-purple text-brand-purple",
                    c.cls === "domain" && "border-line-soft text-ink-3",
                  )}
                >
                  {c.text}
                </span>
              ))
            ) : (
              <span className="text-[12.5px] text-ink-3">
                No explicit topic detected in the goal.
              </span>
            )}
          </TagRow>
          <dl className="grid gap-y-0.5 text-[12px]">
            {ctxMeta.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[auto_1fr] gap-2">
                <dt className="font-semibold whitespace-nowrap text-ink-4">{k}:</dt>
                <dd className="m-0 break-words text-ink-2">{v}</dd>
              </div>
            ))}
          </dl>
        </Block>
      ) : null}

      <Block label="Working memory progression">
        <ol className="mt-2 grid gap-1.5">
          {MILESTONES.map(([label, done, test], i) => {
            const ok = test(timeline, { shared_events: sharedEvents });
            return (
              <li key={label} className="grid grid-cols-[1.5rem_1fr] items-center gap-2.5">
                <span
                  className={cx(
                    "grid h-6 w-6 place-items-center border-2 border-line text-[11px] font-bold",
                    ok ? "bg-brand-green-bg text-brand-green" : "bg-surface text-ink-4",
                  )}
                >
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <b className="block text-[13px] font-semibold">{label}</b>
                  <span
                    className={cx(
                      "block text-[11.5px]",
                      ok ? "text-brand-green" : "text-ink-3",
                    )}
                  >
                    {ok ? done : "not reached in this run"}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
        <p className="mt-2 text-[12px] text-ink-3">
          {timeline.length} memory update{timeline.length === 1 ? "" : "s"} recorded,
          ending at version {w.version}.
        </p>
      </Block>

      {planSteps.length ? (
        <Block label="Execution plan held in working memory">
          <ul className="mt-2 grid gap-1.5">
            {planSteps.map((s, i) => {
              const tone = STEP_TONE[s.status] || "slate";
              const StepGlyph = STEP_GLYPH[s.status] || CircleDot;
              return (
                <li key={i} className="grid grid-cols-[1.25rem_1fr_auto] items-center gap-2.5">
                  <StepGlyph
                    aria-hidden="true"
                    className={cx(toneClass(tone), "nb-a-fg h-4 w-4")}
                    strokeWidth={2.6}
                  />
                  <span className="min-w-0">
                    <b className="block text-[13px] font-semibold">{s.step_name}</b>
                    {s.result_reference ? (
                      <span className="block text-[11.5px] text-ink-4">
                        {s.result_reference}
                      </span>
                    ) : null}
                  </span>
                  <Badge tone={tone}>
                    {String(s.status).replace("_", " ").toUpperCase()}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </Block>
      ) : null}

      {ctxAgents.length ? (
        <Block label="Context shared with each agent">
          <div className="mt-2 grid gap-2.5 lg:grid-cols-2">
            {ctxAgents.map((a) => (
              <article
                key={a.agent}
                className={cx(
                  accentClass(a.accent || "blue"),
                  "nb-frame-flat nb-a-border border-l-[6px] bg-surface p-3",
                )}
              >
                <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2 text-[13px] font-bold">
                  <span>
                    {a.icon || AGENT_ICON[a.agent] || "•"}{" "}
                    {a.name || AGENT_NAME[a.agent] || a.agent}
                  </span>
                  {a.memory_version ? (
                    <span className="text-[10.5px] font-semibold whitespace-nowrap text-ink-4">
                      memory v{a.memory_version}
                    </span>
                  ) : null}
                </div>
                <ul className="grid gap-0.5">
                  {(a.context_received || []).map((c, i) => (
                    <li key={i} className="text-[12px] text-brand-green">
                      {c}
                    </li>
                  ))}
                </ul>
                {(a.context_shared_from || []).length ? (
                  <p className="mt-2 text-[12px] font-semibold text-brand-purple">
                    {a.context_facts} finding{a.context_facts === 1 ? "" : "s"}{" "}
                    carried over from{" "}
                    {(a.context_shared_from || [])
                      .map((k) => AGENT_NAME[k] || k)
                      .join(", ")}
                  </p>
                ) : null}
                {(a.context_focus || []).length ? (
                  <div className="mt-2">
                    <b className="text-[12px] font-bold">Search focus from context:</b>
                    <TagRow className="mt-1">
                      {a.context_focus.map((t) => (
                        <Tag key={t}>{t}</Tag>
                      ))}
                    </TagRow>
                  </div>
                ) : null}
                {(a.context_omitted || []).map((o, i) => (
                  <p key={i} className="mt-1.5 text-[11.5px] text-ink-4">
                    ⊘ {o.why}
                  </p>
                ))}
              </article>
            ))}
          </div>
        </Block>
      ) : null}

      <Block label={`Retained findings${facts.length ? ` (${w.fact_count} total, top ${Math.min(facts.length, 6)} shown)` : ""}`}>
        {facts.length ? (
          <ul className="mt-2 grid gap-2">
            {facts.slice(0, 6).map((f, i) => (
              <li key={i} className="grid grid-cols-[auto_1fr] items-baseline gap-2.5">
                <Badge tone={IMPORTANCE_TONE[f.importance] || "slate"}>
                  {f.importance}
                </Badge>
                <span className="min-w-0">
                  <b className="block text-[12.5px] font-semibold">
                    {truncate(f.text, 96)}
                  </b>
                  <span className="block text-[11.5px] text-ink-4">
                    {AGENT_NAME[f.source_agent] || f.source_agent || "unattributed"}
                    {f.simulated ? (
                      <b className="font-bold text-brand-yellow"> · SIMULATED</b>
                    ) : null}
                    {(f.signals || []).length ? ` · ${f.signals.join(", ")}` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12.5px] text-ink-3">
            Nothing cleared the importance floor for this run, so no findings were
            promoted into reusable context.
          </p>
        )}
      </Block>

      <Block label="Long-term memory" tone="purple">
        {(lt.retrieved || []).length ? (
          <ul className="mt-2 grid gap-2">
            {lt.retrieved.map((m, i) => (
              <li key={i} className="grid grid-cols-[auto_1fr] items-baseline gap-2.5">
                <span className="text-[10.5px] font-bold uppercase whitespace-nowrap text-brand-purple">
                  {m.type_label || m.memory_type}
                </span>
                <span className="min-w-0">
                  <b className="block text-[12.5px] font-semibold">
                    {truncate(m.summary || m.content, 110)}
                  </b>
                  <span className="block text-[11.5px] text-ink-4">
                    {m.source_run_id ? `from run ${m.source_run_id}` : ""}
                    {m.relevance ? ` · relevance ${Number(m.relevance).toFixed(2)}` : ""}
                    {m.recurrence > 1 ? ` · seen in ${m.recurrence} runs` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12.5px] text-ink-3">
            No relevant previous context found for this run (
            {lt.retrieval_status || "not attempted"}). Started with current task
            context.
          </p>
        )}

        {change.compared ? (
          <p className="mt-2 flex flex-wrap items-baseline gap-2 text-[12.5px] text-ink-2">
            <b className="font-bold">Compared with previous monitoring:</b>
            <Badge tone={change.verdict === "TREND ACCELERATING" ? "amber" : "green"}>
              {change.verdict}
            </Badge>
            {change.detail || ""}
          </p>
        ) : (
          <p className="mt-2 text-[12.5px] text-ink-3">
            No historical baseline was available, so no change comparison was made.
          </p>
        )}

        <p className="mt-2 text-[12.5px] text-ink-2">
          {Object.keys(lt.consolidation || {}).length ? (
            <>
              Consolidated{" "}
              <b className="font-bold">{lt.consolidation.stored ?? 0}</b> new item
              {(lt.consolidation.stored ?? 0) === 1 ? "" : "s"} for future monitoring
              {lt.consolidation.refreshed
                ? `, refreshed ${lt.consolidation.refreshed}`
                : ""}
              {lt.consolidation.rejected
                ? `, rejected ${lt.consolidation.rejected} as not durable`
                : ""}
              .
              {lt.consolidation.persisted === false ? (
                <b className="font-bold text-brand-yellow">
                  {" "}
                  held in process only — the store could not be written
                </b>
              ) : null}
            </>
          ) : (
            "Nothing was consolidated for this run."
          )}
          {lt.store?.total !== undefined
            ? ` Store now holds ${lt.store.total} item${lt.store.total === 1 ? "" : "s"}.`
            : ""}
        </p>
      </Block>

      {w.compressions ? (
        <Block label="Context compression">
          <p className="text-[12.5px]">
            {w.compressions} compression pass{w.compressions === 1 ? "" : "es"} folded{" "}
            <b className="font-bold">{w.compressed_count}</b> lower-importance fact
            {w.compressed_count === 1 ? "" : "s"} into a summary. Important facts were
            kept verbatim.
          </p>
          {w.narrative_summary ? (
            <p className="mt-2 text-[12px] italic text-ink-3">{w.narrative_summary}</p>
          ) : null}
        </Block>
      ) : null}

      {notes.length ? (
        <Block label="Memory status notes" tone="yellow">
          <ul className="mt-1.5 grid gap-1">
            {notes.map((n, i) => (
              <li key={i} className="text-[12px] text-ink-2">
                {n}
              </li>
            ))}
          </ul>
        </Block>
      ) : null}
    </div>
  );
}
