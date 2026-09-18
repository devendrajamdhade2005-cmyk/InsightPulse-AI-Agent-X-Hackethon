import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "../../lib/api.js";
import { accentClass, cx, toneClass } from "../../lib/accents.js";
import { fmtNum, ratioPct } from "../../lib/format.js";
import {
  Button,
  Card,
  DataLine,
  Field,
  Note,
  Panel,
  PanelHead,
  SectionTitle,
  Select,
  Table,
  TableWrap,
  Td,
  Th,
} from "../ui/Primitives.jsx";
import { ArrowRight, spanIcon } from "../icons/index.jsx";

/* Observability (Task 7) — trace explorer + the self-improvement loop.
 *
 * Everything is read from a real recorded trace. Where a value was not measurable
 * (token usage when the provider reported none) the recorded reason is shown
 * instead of a number. There are no placeholder metrics in this view.
 */

const KIND_STYLE = {
  run: "blue",
  orchestrator: "blue",
  node: "slate",
  agent: "purple",
  decision: "cyan",
  llm: "pink",
  tool: "orange",
  provider: "slate",
  retry: "yellow",
  fallback: "yellow",
  memory: "cyan",
  evaluation: "green",
  verification: "green",
  synthesis: "purple",
};

const VERDICT_TONE = {
  IMPROVEMENT_VERIFIED: "green",
  IMPROVEMENT_REJECTED: "red",
  NO_MATERIAL_CHANGE: "yellow",
  NOT_MEASURABLE: "slate",
  NO_SAFE_IMPROVEMENT: "slate",
  NO_DIAGNOSIS: "slate",
  RERUN_FAILED: "red",
};

const STAGE_LABELS = [
  ["trace", "Trace"],
  ["understand", "Understand"],
  ["diagnose", "Diagnose"],
  ["choose", "Choose"],
  ["apply", "Apply"],
  ["rerun", "Re-run"],
  ["measure", "Measure"],
  ["verify", "Verify"],
];

// SSE event → which stage just reported, and what it said.
const EVENT_STAGE = {
  cycle_started: ["trace", "running", "running the baseline with the controlled failure armed"],
  baseline_traced: ["trace", "done", null],
  trace_analyzed: ["understand", "done", null],
  root_cause_identified: ["diagnose", "done", null],
  improvement_proposed: ["choose", "done", null],
  improvement_applied: ["apply", "done", null],
  rerun_completed: ["rerun", "done", null],
  metrics_collected: ["measure", "done", null],
  cycle_completed: ["verify", "done", null],
};

function describeEvent(event) {
  switch (event.type) {
    case "baseline_traced":
      return `${event.spans} spans, ${event.errors} error(s)`;
    case "trace_analyzed":
      return `${event.errors} error(s), ${event.wasted_retries} provider(s) with spent retries`;
    case "root_cause_identified":
      return `${event.root_cause} on ${event.component} (${ratioPct(event.confidence)})`;
    case "improvement_proposed":
      return `${event.improvement_type || "none"} — ${event.parameter || "no parameter"}`;
    case "improvement_applied":
      return `runtime policy v${event.version}`;
    case "rerun_completed":
      return "same scenario re-run";
    case "metrics_collected":
      return event.validated ? "scored by the Task 6 evaluators" : "runtime metrics only";
    default:
      return "done";
  }
}

const TAG_STYLE = {
  ok: "bg-brand-green-bg text-brand-green",
  green: "bg-brand-green-bg text-brand-green",
  error: "bg-brand-red-bg text-brand-red",
  red: "bg-brand-red-bg text-brand-red",
  degraded: "bg-brand-yellow-bg text-brand-yellow",
  yellow: "bg-brand-yellow-bg text-brand-yellow",
};

const Tag = ({ status }) => (
  <span
    className={cx(
      "inline-block border-2 border-line px-1.5 py-0.5 text-[10px] font-bold uppercase",
      TAG_STYLE[status] || "bg-brand-slate-bg text-ink-3",
    )}
  >
    {status}
  </span>
);

export function ObservabilityView() {
  const [state, setState] = useState({
    status: null, traces: [], errors: null, targets: null,
    policy: null, cycles: [], openTrace: null, tree: null,
    diagnosis: null, report: null,
  });
  const [stages, setStages] = useState({});
  const [showStages, setShowStages] = useState(false);
  const [statusLine, setStatusLine] = useState("Loading trace data…");
  const [running, setRunning] = useState(false);
  const [form, setForm] = useState({
    target: "", failure: "", count: "2", metric: "duration_ms",
  });

  const controllerRef = useRef(null);
  const timelineRef = useRef(null);

  const summaryLine = useCallback((s) => {
    if (!s) return "Trace data loaded.";
    const stored = s.trace_provider?.traces_stored ?? 0;
    const version = s.policy?.version ?? 0;
    const exportNote = s.external_export?.enabled
      ? "external export on"
      : "local traces only";
    const armed = (s.armed_failures || []).length;
    return (
      `${stored} trace(s) recorded · runtime policy v${version} · ${exportNote}` +
      (armed ? ` · ${armed} controlled failure(s) armed` : "")
    );
  }, []);

  const refresh = useCallback(async () => {
    setStatusLine("Loading trace data…");
    const results = await Promise.allSettled([
      api.getObservabilityStatus(),
      api.getTraces(20),
      api.getTraceErrors(10),
      api.getFailureTargets(),
      api.getOptimizationPolicy(),
      api.getImprovementCycles(),
    ]);
    const [status, traces, errors, targets, policy, cycles] = results;

    if (results.every((r) => r.status === "rejected")) {
      setStatusLine(
        `Could not reach the observability API: ${results[0].reason?.message || "unknown error"}`,
      );
      return;
    }

    setState((prev) => ({
      ...prev,
      status: status.status === "fulfilled" ? status.value : prev.status,
      traces: traces.status === "fulfilled" ? traces.value.traces || [] : prev.traces,
      errors: errors.status === "fulfilled" ? errors.value : prev.errors,
      targets: targets.status === "fulfilled" ? targets.value : prev.targets,
      policy: policy.status === "fulfilled" ? policy.value : prev.policy,
      cycles: cycles.status === "fulfilled" ? cycles.value.cycles || [] : prev.cycles,
    }));

    if (targets.status === "fulfilled") {
      const t = targets.value;
      setForm((prev) => ({
        ...prev,
        target: prev.target || t.default?.target_source || (t.targets || [])[0] || "",
        failure:
          prev.failure || t.default?.failure_type || (t.failure_types || [])[0] || "",
      }));
    }
    if (status.status === "fulfilled") setStatusLine(summaryLine(status.value));
  }, [summaryLine]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onCycleEvent = useCallback((event) => {
    const mapped = EVENT_STAGE[event.type];
    if (!mapped) return;
    const [stage, status, note] = mapped;

    setStages((prev) => {
      const next = { ...prev };
      next[stage] = { status, detail: note || describeEvent(event) };
      // Mark the following stage as running, so the strip always shows where we are.
      if (status === "done") {
        const order = STAGE_LABELS.map(([k]) => k);
        const following = order[order.indexOf(stage) + 1];
        if (following && !next[following]) {
          next[following] = { status: "running", detail: "working…" };
        }
      }
      if (event.type === "cycle_completed") {
        next.verify = {
          status: event.verified ? "done" : "rejected",
          detail: `${event.verdict}`,
        };
      }
      return next;
    });
  }, []);

  const runCycle = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setStages({});
    setShowStages(true);
    setState((prev) => ({ ...prev, report: null }));
    setStatusLine(`Running the cycle against ${form.target} (${form.failure})…`);

    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const report = await api.runImprovementStream(
        {
          target_source: form.target,
          failure_type: form.failure,
          failure_count: Number(form.count),
          primary_metric: form.metric,
          simulation_mode: true,
          validate_with_evaluation: true,
        },
        onCycleEvent,
        controller.signal,
      );
      setState((prev) => ({ ...prev, report }));
      await refresh();
      // refresh() writes its own summary; the verdict is what the user waited for,
      // so it has to win.
      const verified = report.improvement_verified ? "verified and kept" : "not kept";
      setStatusLine(
        `${(report.verdict || "").replace(/_/g, " ")} — the change was ${verified}. ` +
          `${(report.reasons || [])[0] || ""}`,
      );
    } catch (err) {
      setStatusLine(
        err.name === "AbortError" ? "Cycle stopped." : `Cycle failed: ${err.message}`,
      );
    } finally {
      controllerRef.current = null;
      setRunning(false);
    }
  }, [running, form, onCycleEvent, refresh]);

  const resetPolicy = useCallback(async () => {
    try {
      const res = await api.resetOptimizationPolicy();
      setStatusLine(`Runtime policy reset to v${res.version} — the shipped defaults.`);
      await refresh();
    } catch (err) {
      setStatusLine(`Could not reset the policy: ${err.message}`);
    }
  }, [refresh]);

  const openTrace = useCallback(
    async (traceId) => {
      setStatusLine(`Loading trace ${traceId}…`);
      try {
        const [tree, diagnosis] = await Promise.all([
          api.getTraceTree(traceId),
          api.getTraceRootCause(traceId).catch(() => null),
        ]);
        setState((prev) => ({ ...prev, openTrace: traceId, tree, diagnosis }));
        setStatusLine(summaryLine(state.status));
        requestAnimationFrame(() =>
          timelineRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
        );
      } catch (err) {
        setStatusLine(`Could not load that trace: ${err.message}`);
      }
    },
    [summaryLine, state.status],
  );

  const targets = state.targets || {};

  return (
    <Panel>
      <PanelHead
        eyebrow="Tracing & self-improvement"
        title="Observability"
        sub="End-to-end traces of every agent run — agent, decision, prompt, tool, provider, latency, token and error spans. Then the loop that matters: inject a controlled failure, diagnose the root cause from the trace, apply a bounded runtime change, re-run the same scenario and verify with the Task 6 evaluators whether the system actually improved."
      />

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <Field label="Controlled failure target" className="min-w-[12rem] flex-1">
          <Select
            value={form.target}
            onChange={(e) => setForm((p) => ({ ...p, target: e.target.value }))}
          >
            {(targets.targets || []).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Failure type" className="w-full sm:w-44">
          <Select
            value={form.failure}
            onChange={(e) => setForm((p) => ({ ...p, failure: e.target.value }))}
          >
            {(targets.failure_types || []).map((name) => (
              <option key={name} value={name}>
                {name.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Failures" className="w-full sm:w-28">
          <Select
            value={form.count}
            onChange={(e) => setForm((p) => ({ ...p, count: e.target.value }))}
          >
            {["1", "2", "3"].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Target metric" className="w-full sm:w-52">
          <Select
            value={form.metric}
            onChange={(e) => setForm((p) => ({ ...p, metric: e.target.value }))}
          >
            <option value="duration_ms">Latency (duration_ms)</option>
            <option value="errors">Errors</option>
            <option value="retries">Retries</option>
            <option value="provider_calls">Provider calls</option>
          </Select>
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button disabled={running} onClick={runCycle}>
            Run Improvement Cycle
          </Button>
          {running ? (
            <Button variant="danger" onClick={() => controllerRef.current?.abort()}>
              Stop
            </Button>
          ) : null}
          <Button size="xs" variant="ghost" onClick={resetPolicy}>
            Reset policy
          </Button>
          <Button size="xs" variant="ghost" onClick={refresh}>
            Refresh
          </Button>
        </div>
      </div>

      <p className="mb-4 border-2 border-line-soft bg-bg-2 px-3 py-2 text-[12.5px]">
        {statusLine}
      </p>

      {showStages ? <StageStrip stages={stages} /> : null}
      {state.report ? <CycleReport report={state.report} onOpenTrace={openTrace} /> : null}
      <PolicyBlock policy={state.policy} />
      <TraceList
        traces={state.traces}
        openTrace={state.openTrace}
        degraded={state.status?.trace_provider?.degraded}
        onOpenTrace={openTrace}
      />
      {state.tree ? (
        <div ref={timelineRef}>
          <Timeline tree={state.tree} diagnosis={state.diagnosis} />
        </div>
      ) : null}
      <ErrorsBlock errors={state.errors} />
      {state.cycles.length ? <CycleHistory cycles={state.cycles} /> : null}
    </Panel>
  );
}

/* ── the 8-stage strip ───────────────────────────────────── */
function StageStrip({ stages }) {
  return (
    <div className="mb-5 flex items-stretch gap-1 overflow-x-auto border-2 border-line bg-bg-2 p-3">
      {STAGE_LABELS.map(([key, label], i) => {
        const s = stages[key];
        const status = s?.status || "pending";
        return (
          <div key={key} className="flex items-stretch gap-1">
            {i ? (
              <ArrowRight
                aria-hidden="true"
                className="h-3.5 w-3.5 self-center text-ink-4"
                strokeWidth={2.4}
              />
            ) : null}
            <div
              className={cx(
                "flex min-w-[7rem] flex-1 items-center gap-2 border-2 border-line p-2",
                status === "pending" && "bg-surface opacity-60",
                status === "running" && "border-brand-blue bg-brand-blue-bg",
                status === "done" && "border-brand-green bg-brand-green-bg",
                status === "rejected" && "border-brand-red bg-brand-red-bg",
              )}
            >
              <span
                className={cx(
                  "grid h-5 w-5 shrink-0 place-items-center border-2 border-line text-[10.5px] font-bold",
                  status === "running" && "nb-anim-blink bg-brand-blue text-white",
                  status === "done" && "bg-brand-green-bg text-brand-green",
                  status === "rejected" && "bg-brand-red-bg text-brand-red",
                  status === "pending" && "bg-brand-slate-bg text-ink-3",
                )}
              >
                {i + 1}
              </span>
              <span className="min-w-0">
                <b className="block text-[12px] font-bold">{label}</b>
                <em className="block not-italic text-[10.5px] text-ink-3">
                  {s?.detail || "waiting"}
                </em>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── cycle report ────────────────────────────────────────── */
function CycleReport({ report: r, onOpenTrace }) {
  const tone = VERDICT_TONE[r.verdict] || "slate";
  const cmp = r.comparison || {};
  const dx = r.diagnosis || {};
  const plan = r.plan || {};
  const ev = r.evaluation || {};
  const impact = dx.impact || {};

  const rows = (cmp.rows || []).filter((row) => row.change !== null);
  const changed = rows.filter((row) => row.direction !== "unchanged");
  const shown = changed.length ? changed : rows;

  return (
    <div
      className={cx(
        toneClass(tone),
        "nb-a-bg nb-a-border mb-5 border-2 p-4",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="nb-a-solid shrink-0 border-2 border-line px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
          {(r.verdict || "").replace(/_/g, " ")}
        </span>
        <div>
          <b className="block text-[13.5px] font-bold">
            {r.improvement_verified
              ? "The change was verified and kept"
              : "The change was not kept"}
          </b>
          <em className="mt-0.5 block not-italic text-[12px] text-ink-2">
            {(r.reasons || [])[0] || ""}
          </em>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Card>
          <h4 className="mb-2 text-[12.5px] font-bold uppercase">Root cause</h4>
          <DataLine label="Cause" value={dx.root_cause_type || "—"} />
          <DataLine label="Component" value={dx.affected_component || "—"} />
          <DataLine label="Confidence" value={ratioPct(dx.confidence)} />
          <DataLine
            label="Certain enough to act"
            value={dx.uncertain ? "needs review" : "yes"}
            valueClass={dx.uncertain ? "" : "text-brand-green"}
          />
          {(dx.evidence || []).length ? (
            <ul className="mt-2 list-disc pl-4 text-[11.5px] leading-relaxed text-ink-2">
              {dx.evidence.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          ) : null}
        </Card>

        <Card>
          <h4 className="mb-2 text-[12.5px] font-bold uppercase">Improvement applied</h4>
          <DataLine label="Type" value={plan.improvement_type || "—"} />
          <DataLine
            label="Parameter"
            value={<span className="font-mono">{plan.changed_parameter || "—"}</span>}
          />
          <DataLine
            label="Before → after"
            value={`${Object.values(plan.current_configuration || {}).join(", ") || "—"} → ${
              Object.values(plan.proposed_configuration || {}).join(", ") || "—"
            }`}
          />
          <DataLine
            label="Policy version"
            value={`v${plan.previous_version ?? 0} → v${plan.optimization_version ?? 0}`}
          />
          <DataLine label="Status" value={plan.status || "—"} />
          {plan.risk ? <Note>Risk: {plan.risk}</Note> : null}
          <Note>
            This changes runtime configuration only — no source file is modified.
          </Note>
        </Card>

        <Card>
          <h4 className="mb-2 text-[12.5px] font-bold uppercase">Measured impact</h4>
          <DataLine
            label="Latency added by the fault"
            value={`${fmtNum(impact.latency_added_ms)} ms`}
          />
          <DataLine
            label="Share of the run"
            value={ratioPct(impact.latency_share_of_run)}
          />
          <DataLine label="Retry calls" value={fmtNum(impact.retry_calls)} />
          <DataLine label="Errors" value={fmtNum(impact.error_count)} />
          <DataLine label="Fallbacks" value={fmtNum(impact.fallback_count)} />
          {impact.token_overhead == null ? (
            <Note>
              Token overhead: not measurable —{" "}
              {impact.token_overhead_note || "no usage reported"}
            </Note>
          ) : (
            <DataLine label="Token overhead" value={fmtNum(impact.token_overhead)} />
          )}
          {impact.estimated_cost_change_usd == null ? (
            <Note>
              Cost change: not measurable —{" "}
              {impact.estimated_cost_note || "derived from token usage"}
            </Note>
          ) : (
            <DataLine
              label="Cost change"
              value={`$${fmtNum(impact.estimated_cost_change_usd)}`}
            />
          )}
        </Card>
      </div>

      <SectionTitle className="mt-5">
        Before vs after — same scenario, re-run
      </SectionTitle>
      <TableWrap>
        <Table>
          <thead>
            <tr>
              {["Metric", "Before", "After", "Change", "Direction"].map((h) => (
                <Th key={h}>{h}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, i) => (
              <tr
                key={i}
                className={cx(
                  row.direction === "improved" && "text-brand-green",
                  row.direction === "regressed" && "text-brand-red",
                  row.metric === cmp.primary_metric && "bg-bg-2",
                )}
              >
                <Td>
                  {row.metric}
                  {row.metric === cmp.primary_metric ? (
                    <span className="ml-1.5 border-2 border-line bg-brand-blue-bg px-1 text-[9.5px] font-bold uppercase text-brand-blue">
                      target
                    </span>
                  ) : null}
                </Td>
                <Td className="font-mono">{fmtNum(row.before)}</Td>
                <Td className="font-mono">{fmtNum(row.after)}</Td>
                <Td className="font-mono">
                  {row.change > 0 ? "+" : ""}
                  {fmtNum(row.change)}
                </Td>
                <Td>{row.direction}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrap>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Card>
          <h4 className="mb-2 text-[12.5px] font-bold uppercase">
            Task 6 quality validation
          </h4>
          <DataLine
            label="Validated by evaluators"
            value={ev.validated_with_task6 ? "yes" : "no"}
          />
          <DataLine label="Before outcome" value={ev.before?.outcome || "not measured"} />
          <DataLine label="After outcome" value={ev.after?.outcome || "not measured"} />
          {(cmp.quality_regressions || []).length ? (
            <Note tone="bad">
              Quality regressions: {cmp.quality_regressions.join("; ")}
            </Note>
          ) : (
            <Note>No quality metric regressed beyond tolerance.</Note>
          )}
          {ev.before?.error ? <Note tone="bad">{ev.before.error}</Note> : null}
        </Card>

        <Card>
          <h4 className="mb-2 text-[12.5px] font-bold uppercase">Traces compared</h4>
          <DataLine
            label="Before"
            value={<span className="font-mono">{r.before_trace_id || "—"}</span>}
          />
          <DataLine
            label="After"
            value={<span className="font-mono">{r.after_trace_id || "—"}</span>}
          />
          <DataLine
            label="Scenario"
            value={<span className="font-mono">{r.scenario || "—"}</span>}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {r.before_trace_id ? (
              <Button
                size="xs"
                variant="ghost"
                onClick={() => onOpenTrace(r.before_trace_id)}
              >
                View before trace
              </Button>
            ) : null}
            {r.after_trace_id ? (
              <Button
                size="xs"
                variant="ghost"
                onClick={() => onOpenTrace(r.after_trace_id)}
              >
                View after trace
              </Button>
            ) : null}
          </div>
        </Card>

        <Card>
          <h4 className="mb-2 text-[12.5px] font-bold uppercase">Reasoning</h4>
          <ul className="list-disc pl-4 text-[11.5px] leading-relaxed text-ink-2">
            {(r.reasons || ["—"]).map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
          {r.reverted ? (
            <Note tone="bad">The policy change was rolled back automatically.</Note>
          ) : null}
        </Card>
      </div>
    </div>
  );
}

/* ── runtime policy ──────────────────────────────────────── */
function PolicyBlock({ policy: p }) {
  if (!p) return null;
  const active = p.active || {};
  const retries = Object.entries(active.retry_attempts_by_source || {});
  const timeouts = Object.entries(active.timeout_by_source || {});
  const history = p.history || [];

  return (
    <div className="mb-5">
      <SectionTitle>Runtime optimization policy — v{p.version ?? 0}</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Card>
          <h4 className="mb-2 text-[12.5px] font-bold uppercase">Active values</h4>
          {retries.length ? (
            retries.map(([k, v]) => (
              <DataLine
                key={k}
                label={<span className="font-mono">retry_attempts[{k}]</span>}
                value={v}
              />
            ))
          ) : (
            <Note>
              No retry override in force — every source uses its shipped ceiling.
            </Note>
          )}
          {timeouts.map(([k, v]) => (
            <DataLine
              key={k}
              label={<span className="font-mono">timeout[{k}]</span>}
              value={`${v}s`}
            />
          ))}
          <DataLine
            label="Deduplicate identical tool calls"
            value={active.dedup_identical_tool_calls ? "on" : "off"}
          />
        </Card>

        <Card>
          <h4 className="mb-2 text-[12.5px] font-bold uppercase">Bounds enforced</h4>
          {Object.entries(p.bounds || {}).map(([k, v]) => (
            <DataLine
              key={k}
              label={<span className="font-mono">{k}</span>}
              value={`${v[0]} – ${v[1]}`}
            />
          ))}
          {p.note ? <Note>{p.note}</Note> : null}
        </Card>

        <Card>
          <h4 className="mb-2 text-[12.5px] font-bold uppercase">Version history</h4>
          {history.length ? (
            history
              .slice(-6)
              .reverse()
              .map((h, i) => (
                <DataLine key={i} label={`v${h.version}`} value={h.reason || "initial defaults"} />
              ))
          ) : (
            <Note>Only the shipped defaults have ever been active.</Note>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ── trace list ──────────────────────────────────────────── */
function TraceList({ traces, openTrace, degraded, onOpenTrace }) {
  if (!traces.length) {
    return (
      <div className="mb-5 border-2 border-dashed border-line bg-bg-2 p-6 text-center text-[13px] text-ink-3">
        No traces recorded yet. Run the improvement cycle above, or start any agent run
        from Overview or Framework — every run is traced automatically.
      </div>
    );
  }

  const tokenLabel = (t) => {
    const tokens = t.token_usage || {};
    return tokens.status === "measured" ? `${tokens.total_tokens ?? 0}` : "unavailable";
  };

  return (
    <div className="mb-5">
      <SectionTitle>Recorded traces</SectionTitle>
      <TableWrap>
        <Table>
          <thead>
            <tr>
              {["Trace", "Scenario", "Status", "Spans", "Errors", "Duration", "Policy", "Tokens", ""].map(
                (h, i) => (
                  <Th key={i}>{h}</Th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {traces.map((t) => (
              <tr
                key={t.trace_id}
                className={openTrace === t.trace_id ? "bg-brand-blue-bg" : ""}
              >
                <Td className="font-mono">{t.trace_id}</Td>
                <Td>{t.scenario || "normal"}</Td>
                <Td>
                  <Tag status={t.status || "ok"} />
                </Td>
                <Td className="font-mono">{fmtNum(t.span_count)}</Td>
                <Td className="font-mono">{fmtNum(t.error_count)}</Td>
                <Td className="font-mono">{fmtNum(t.duration_ms)} ms</Td>
                <Td>v{t.optimization_version ?? 0}</Td>
                <Td>
                  {tokenLabel(t)}
                  {t.partial ? (
                    <span className="ml-1.5 border-2 border-line bg-brand-blue-bg px-1 text-[9.5px] font-bold uppercase text-brand-blue">
                      summary
                    </span>
                  ) : null}
                </Td>
                <Td>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => onOpenTrace(t.trace_id)}
                  >
                    Inspect
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrap>
      {degraded ? <Note tone="bad">Trace store: {degraded}</Note> : null}
    </div>
  );
}

/* ── span timeline ───────────────────────────────────────── */
function Timeline({ tree, diagnosis }) {
  const total = Math.max(1, tree.duration_ms || 1);
  const rows = [];

  const walk = (nodes) => {
    for (const span of nodes) {
      const accent = KIND_STYLE[span.kind] || "slate";
      const SpanGlyph = spanIcon(span.kind);
      const width = Math.max(0.6, (span.duration_ms / total) * 100);
      const attrs = span.attributes || {};
      const detail = [
        attrs.provider && `provider ${attrs.provider}`,
        attrs.tool && `tool ${attrs.tool}`,
        attrs.prompt_type && `prompt ${attrs.prompt_type}`,
        Number.isFinite(attrs.result_count) && `${attrs.result_count} result(s)`,
        Number.isFinite(attrs.attempts) && attrs.attempts > 0 && `${attrs.attempts} attempt(s)`,
        Number.isFinite(attrs.retry_wait_ms) && attrs.retry_wait_ms > 0 && `${attrs.retry_wait_ms}ms backoff`,
        attrs.decision && `→ ${attrs.decision}`,
        attrs.providers_failed && `lost ${attrs.providers_failed}`,
      ]
        .filter(Boolean)
        .join(" · ");

      rows.push(
        <div
          key={span.span_id || `${span.name}-${rows.length}`}
          // Indentation is data (the span's depth in the tree), so it stays inline.
          style={{ marginLeft: `${span.depth * 14}px` }}
          className={cx(
            "border-2 border-l-[6px] border-line bg-surface px-2.5 py-1.5",
            span.status === "ok" && "border-l-brand-green",
            span.status === "error" && "border-l-brand-red bg-brand-red-bg",
            span.status === "degraded" && "border-l-brand-yellow bg-brand-yellow-bg",
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <SpanGlyph
              aria-hidden="true"
              className={cx(accentClass(accent), "nb-a-fg h-3.5 w-3.5 shrink-0")}
              strokeWidth={2.5}
            />
            <b className="text-[12px] font-bold">{span.name}</b>
            <span className="border-2 border-line bg-bg-2 px-1 text-[9.5px] font-bold uppercase text-ink-3">
              {span.kind}
            </span>
            {span.agent ? (
              <span className="text-[10px] font-bold text-brand-purple">
                {span.agent}
              </span>
            ) : null}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div
              className={cx(accentClass(accent), "nb-a-solid h-1.5 min-w-[2px]")}
              style={{ width: `${width.toFixed(2)}%` }}
            />
            <span className="shrink-0 font-mono text-[10.5px] text-ink-3">
              {fmtNum(span.duration_ms)} ms
            </span>
          </div>
          {detail ? (
            <div className="mt-0.5 text-[10.5px] text-ink-3">{detail}</div>
          ) : null}
          {(span.events || []).length ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {span.events.map((e, i) => (
                <span
                  key={i}
                  className="border-2 border-line bg-brand-yellow-bg px-1 text-[9.5px] font-bold text-brand-yellow"
                >
                  {e.name}
                </span>
              ))}
            </div>
          ) : null}
        </div>,
      );
      if (span.children?.length) walk(span.children);
    }
  };
  walk(tree.tree || []);

  const tokens = tree.token_usage || {};

  // A restored trace has counts but no span detail. Say so plainly rather than
  // rendering an empty timeline that looks like a bug.
  if (tree.partial && !rows.length) {
    return (
      <div className="mb-5">
        <SectionTitle>
          Span timeline — <span className="font-mono">{tree.trace_id}</span>
        </SectionTitle>
        <div className="mb-2 flex flex-wrap gap-4 text-[11.5px] text-ink-3">
          <span>
            <b className="text-ink">{fmtNum(tree.recorded_span_count)}</b> spans were
            recorded
          </span>
          <span>
            <b className="text-ink">{fmtNum(tree.duration_ms)}</b> ms total
          </span>
          <span>
            scenario <b className="text-ink">{tree.scenario || "normal"}</b>
          </span>
        </div>
        <div className="border-2 border-dashed border-line bg-bg-2 p-6 text-center text-[13px] text-ink-3">
          {tree.partial_reason ||
            "Span detail is not retained for this trace. Run the cycle above to produce a full trace."}
        </div>
      </div>
    );
  }

  const dx = diagnosis?.diagnosis || {};

  return (
    <div className="mb-5 scroll-mt-24">
      <SectionTitle>
        Span timeline — <span className="font-mono">{tree.trace_id}</span>
      </SectionTitle>

      <div className="mb-2 flex flex-wrap gap-4 text-[11.5px] text-ink-3">
        <span>
          <b className="text-ink">{fmtNum(tree.span_count)}</b> spans
        </span>
        <span>
          <b className="text-ink">{fmtNum(tree.duration_ms)}</b> ms total
        </span>
        <span>
          scenario <b className="text-ink">{tree.scenario || "normal"}</b>
        </span>
        <span>
          policy <b className="text-ink">v{tree.optimization_version ?? 0}</b>
        </span>
        <span className={tree.orphan_count ? "font-semibold text-brand-red" : ""}>
          parent/child integrity:{" "}
          <b className="text-ink">
            {tree.orphan_count ? `${tree.orphan_count} orphan span(s)` : "intact"}
          </b>
        </span>
        <span>
          tokens:{" "}
          <b className="text-ink">
            {tokens.status === "measured"
              ? `${tokens.total_tokens} (${tokens.model || "model"})`
              : "unavailable"}
          </b>
        </span>
      </div>

      {tokens.status !== "measured" && tokens.reason ? (
        <Note>Token usage was not recorded for this run: {tokens.reason}</Note>
      ) : null}

      {dx.root_cause_type ? (
        <div
          className={cx(
            toneClass(
              dx.root_cause_type === "UNKNOWN"
                ? "slate"
                : dx.uncertain
                  ? "yellow"
                  : "red",
            ),
            "nb-a-bg nb-a-border mb-3 border-2 p-3",
          )}
        >
          <b className="text-[12.5px] font-bold">
            Diagnosis: {dx.root_cause_type}
            {dx.affected_component ? ` on ${dx.affected_component}` : ""}
          </b>
          <span className="ml-2 text-[11px] text-ink-3">
            confidence {ratioPct(dx.confidence)}
            {dx.uncertain ? " · needs review" : ""}
          </span>
          <ul className="mt-1.5 list-disc pl-4 text-[11.5px] leading-relaxed text-ink-2">
            {(dx.evidence || []).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
          {dx.recommended_improvement ? (
            <Note>{dx.recommended_improvement}</Note>
          ) : null}
          {(dx.alternatives || []).length ? (
            <Note>Other explanations considered: {dx.alternatives.join(", ")}</Note>
          ) : null}
        </div>
      ) : null}

      <div className="flex max-h-[35rem] flex-col gap-1 overflow-y-auto border-2 border-line bg-bg-2 p-3">
        {rows}
      </div>
    </div>
  );
}

/* ── errors ──────────────────────────────────────────────── */
function ErrorsBlock({ errors: e }) {
  if (!e || !e.count) return null;
  return (
    <div className="mb-5">
      <SectionTitle>Errors across recent traces</SectionTitle>
      <div className="mb-2 flex flex-wrap gap-4 text-[11.5px] text-ink-3">
        <span>
          <b className="text-ink">{fmtNum(e.count)}</b> total
        </span>
        <span>
          <b className="text-ink">{fmtNum(e.recovered)}</b> recovered
        </span>
        <span>
          <b className="text-ink">{fmtNum(e.injected)}</b> deliberately injected
        </span>
      </div>
      <div className="mb-2 flex flex-wrap gap-2">
        {Object.entries(e.by_category || {}).map(([k, v]) => (
          <span
            key={k}
            className="border-2 border-line bg-bg-2 px-2 py-1 text-[11px] text-ink-2"
          >
            {k} <b className="font-bold text-ink">{v}</b>
          </span>
        ))}
      </div>
      <TableWrap>
        <Table>
          <thead>
            <tr>
              {["Component", "Type", "HTTP", "Retryable", "Recovery", "Injected", "Message"].map(
                (h) => (
                  <Th key={h}>{h}</Th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {(e.errors || []).slice(0, 24).map((err, i) => (
              <tr key={i}>
                <Td>{err.provider || err.component || "—"}</Td>
                <Td>{err.error_type || "—"}</Td>
                <Td>{err.http_status ?? "—"}</Td>
                <Td>{err.retryable ? "yes" : "no"}</Td>
                <Td>{err.recovery_status || "—"}</Td>
                <Td>{err.injected ? "yes" : "no"}</Td>
                <Td className="max-w-[20rem] text-[11.5px] text-ink-2">
                  {err.safe_message || ""}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrap>
      <Note>
        Messages are recorded through a redaction filter, so no credential, prompt text
        or internal reasoning can appear here.
      </Note>
    </div>
  );
}

/* ── cycle history ───────────────────────────────────────── */
function CycleHistory({ cycles }) {
  return (
    <div>
      <SectionTitle>Previous improvement cycles</SectionTitle>
      <TableWrap>
        <Table>
          <thead>
            <tr>
              {["Cycle", "Root cause", "Confidence", "Parameter", "Verdict", "Kept"].map(
                (h) => (
                  <Th key={h}>{h}</Th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {cycles.map((c) => (
              <tr key={c.cycle_id}>
                <Td className="font-mono">{c.cycle_id}</Td>
                <Td>{c.root_cause || "—"}</Td>
                <Td className="font-mono">{ratioPct(c.confidence)}</Td>
                <Td className="font-mono">{c.changed_parameter || "—"}</Td>
                <Td>
                  <Tag status={VERDICT_TONE[c.verdict] || "slate"} />
                  <span className="ml-1.5 text-[11px]">
                    {(c.verdict || "").replace(/_/g, " ")}
                  </span>
                </Td>
                <Td>
                  {c.improvement_verified ? "kept" : c.reverted ? "reverted" : "no"}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrap>
    </div>
  );
}
