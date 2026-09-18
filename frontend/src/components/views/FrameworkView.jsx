import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "../../lib/api.js";
import { cx } from "../../lib/accents.js";
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
  Tag,
  TextInput,
} from "../ui/Primitives.jsx";

/* Autonomous Agent Framework (LangGraph).
 *
 * Self-contained: drives the /api/agent/graph endpoints, streams the framework
 * events, animates the graph, and renders a report of what actually happened.
 * Every value comes from the run — nothing here is decorative.
 */

const NODES = [
  ["understand", "Understand"],
  ["plan", "Dynamic Planner"],
  ["decompose", "Task Decomposer"],
  ["resource_check", "Resource / Policy"],
  ["dispatch", "Dynamic Router"],
  ["research_agent", "Research Agent"],
  ["competitive_agent", "Competitive Agent"],
  ["observer", "Observer"],
  ["conflict_resolution", "Conflict Resolution"],
  ["self_evaluator", "Self-Evaluator"],
  ["verify", "Verification"],
  ["replan", "Replanner"],
  ["finalize", "Final Synthesis"],
  ["memory_update", "Memory Update"],
];

const AGENT_NODES = new Set(["research_agent", "competitive_agent"]);

const EVENT_ICON = {
  planner_started: "🎯", plan_created: "🗂", task_decomposed: "🧩",
  parallel_tasks_started: "⚡", agent_started: "🤖",
  tool_started: "🔧", tool_succeeded: "✓", tool_failed: "⚠️", tool_timeout: "⏱",
  retry_started: "🔄", fallback_started: "↩", fallback_succeeded: "✓",
  evaluation_started: "🧭", evaluation_completed: "🧭",
  conflict_detected: "⚠️", conflict_resolved: "✓",
  verification_started: "🔎", verification_completed: "✓",
  replan_triggered: "↻", checkpoint_saved: "💾",
  budget_constraint_detected: "💰", deadlock_detected: "🛑",
  resource_status: "📊", final_synthesis_started: "📊",
  run_completed: "✅", memory_updated: "🧠",
};

const DEMO_GOAL =
  "Analyze important AI-agent research and competitor developments and determine " +
  "whether current evidence indicates meaningful strategic competitive movement.";

const STATUS_STYLE = {
  pending: "opacity-55 bg-surface",
  running: "bg-brand-blue-bg border-brand-blue",
  completed: "bg-brand-green-bg border-brand-green",
  recovered: "bg-brand-yellow-bg border-brand-yellow",
  failed: "bg-brand-red-bg border-brand-red",
  skipped: "opacity-40 bg-surface",
};

const BADGE_STYLE = {
  pending: "bg-brand-slate-bg text-ink-3",
  running: "bg-brand-blue text-white nb-anim-blink",
  completed: "bg-brand-green-bg text-brand-green",
  recovered: "bg-brand-yellow-bg text-brand-yellow",
  failed: "bg-brand-red-bg text-brand-red",
  skipped: "bg-brand-slate-bg text-ink-4",
};

const initialStatuses = () =>
  Object.fromEntries(NODES.map(([id]) => [id, "pending"]));

const pct = (v) => (v == null ? "—" : `${Math.round(Number(v) * 100)}%`);

/**
 * Applies one framework event to the node-status map.
 *
 * Returns a new map rather than mutating, so React sees the change. A completed
 * node is never demoted, except to `recovered` — which is also terminal but more
 * informative, because it records that the node hit a failure and got past it.
 */
function applyTransition(prev, fw, entry) {
  const next = { ...prev };
  const set = (id, s) => {
    if (next[id] !== "completed" || s === "completed" || s === "recovered") {
      next[id] = s;
    }
  };
  const data = entry.data || {};

  switch (fw) {
    case "planner_started": set("understand", "running"); break;
    case "plan_created":
      set("understand", "completed"); set("plan", "completed");
      set("decompose", "running"); break;
    case "task_decomposed":
      set("decompose", "completed"); set("resource_check", "running"); break;
    case "resource_status":
    case "budget_constraint_detected":
      set("resource_check", "completed"); break;
    case "parallel_tasks_started":
      set("dispatch", "completed");
      (data.agents || []).forEach((a) => set(a, "running"));
      break;
    case "agent_started": {
      const a = data.agent;
      if (!a || !AGENT_NODES.has(a)) break;
      // The backend emits this twice per agent: on start (payload has tools/kind)
      // and on completion (payload has status/coverage). Distinguish by payload,
      // not by current state — a tool failure sets `recovered` in between, which
      // would otherwise make the completion event read as a fresh start.
      const isCompletion = data.status !== undefined || data.coverage !== undefined;
      if (isCompletion) {
        set(a, next[a] === "recovered" ? "recovered" : "completed");
      } else if (next[a] !== "completed" && next[a] !== "recovered") {
        set(a, "running");
      }
      break;
    }
    case "tool_failed":
    case "tool_timeout":
      if (data.agent) set(data.agent, "recovered"); break;
    case "fallback_succeeded":
      if (data.agent) set(data.agent, "recovered"); break;
    case "conflict_detected":
      set("observer", "completed"); set("conflict_resolution", "running"); break;
    case "conflict_resolved": set("conflict_resolution", "completed"); break;
    case "evaluation_started":
      set("observer", "completed"); set("conflict_resolution", "completed");
      set("self_evaluator", "running"); break;
    case "evaluation_completed": set("self_evaluator", "completed"); break;
    case "verification_started": set("verify", "running"); break;
    case "verification_completed": set("verify", "completed"); break;
    case "replan_triggered": set("replan", "completed"); break;
    case "final_synthesis_started": set("finalize", "running"); break;
    case "memory_updated": set("memory_update", "completed"); break;
    case "run_completed":
      set("finalize", "completed"); set("memory_update", "completed");
      for (const [id] of NODES) {
        if (next[id] === "pending") next[id] = "skipped";
        // Nothing can still be in flight once the run is over. Settling leftover
        // `running` nodes guarantees the diagram never contradicts the report.
        else if (next[id] === "running") next[id] = "completed";
      }
      break;
    default: break;
  }
  return next;
}

function NodeBox({ id, label, status }) {
  return (
    <div
      className={cx(
        "flex items-center justify-between gap-2 border-2 border-line px-3 py-1.5 text-[12.5px] font-bold",
        STATUS_STYLE[status] || STATUS_STYLE.pending,
      )}
      data-node={id}
    >
      <span>{label}</span>
      <span
        className={cx(
          "border-2 border-line px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide",
          BADGE_STYLE[status] || BADGE_STYLE.pending,
        )}
      >
        {status}
      </span>
    </div>
  );
}

function Graph({ statuses }) {
  const rows = [];
  for (const [id, label] of NODES) {
    if (id === "competitive_agent") continue; // rendered beside research_agent
    if (id === "research_agent") {
      rows.push(
        <div key="branch" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <NodeBox id="research_agent" label="Research Agent" status={statuses.research_agent} />
          <NodeBox id="competitive_agent" label="Competitive Agent" status={statuses.competitive_agent} />
        </div>,
      );
      continue;
    }
    rows.push(<NodeBox key={id} id={id} label={label} status={statuses[id]} />);
  }
  return (
    <div className="flex flex-col">
      {rows.map((row, i) => (
        <div key={i}>
          {i ? (
            <div aria-hidden="true" className="py-0.5 text-center text-[12px] text-ink-4">
              ↓
            </div>
          ) : null}
          {row}
        </div>
      ))}
    </div>
  );
}

export function FrameworkView() {
  const [goal, setGoal] = useState(DEMO_GOAL);
  const [competitors, setCompetitors] = useState("OpenAI, Anthropic");
  const [scenario, setScenario] = useState("full");
  const [statuses, setStatuses] = useState(initialStatuses);
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState(
    "Ready. Runs offline in simulation mode — repeatable and safe.",
  );
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);

  const controllerRef = useRef(null);
  const liveRef = useRef(null);

  useEffect(() => {
    if (liveRef.current) liveRef.current.scrollTop = liveRef.current.scrollHeight;
  }, [events.length]);

  const onEvent = useCallback((event) => {
    if (event.type !== "activity" || !event.entry) return;
    const entry = event.entry;
    const fw = entry.data?.fw_event;
    if (!fw) return;
    setStatuses((prev) => applyTransition(prev, fw, entry));
    setEvents((prev) => [...prev, { fw, entry }]);
  }, []);

  const run = useCallback(
    async (path, adversarial) => {
      setStatuses(initialStatuses());
      setEvents([]);
      setResult(null);
      setRunning(true);
      setStatus(
        adversarial
          ? `Running adversarial scenario "${scenario}" — tools will fail and evidence will conflict; the graph must recover.`
          : "Running the LangGraph orchestration…",
      );

      const controller = new AbortController();
      controllerRef.current = controller;

      try {
        const res = await api.runGraphStream(
          path,
          {
            goal: goal.trim() || DEMO_GOAL,
            competitors: competitors.split(",").map((s) => s.trim()).filter(Boolean),
            keywords: ["AI agents"],
            simulation_mode: true,
            adversarial,
            scenario,
          },
          onEvent,
          controller.signal,
        );
        setResult(res);
        setStatus(`${res.status} — objective completed autonomously.`);
      } catch (err) {
        setStatus(
          err.name === "AbortError" ? "Stopped." : `Run failed: ${err.message}`,
        );
      } finally {
        controllerRef.current = null;
        setRunning(false);
      }
    },
    [goal, competitors, scenario, onEvent],
  );

  return (
    <Panel>
      <PanelHead
        eyebrow="LangGraph runtime"
        title="Autonomous Agent Framework"
        sub="A stateful LangGraph StateGraph: dynamic planning, parallel agents, checkpointing, failure recovery, conflict resolution, verification, self-evaluation and autonomous replanning — shown live as it runs."
      />

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <Field label="Goal" className="min-w-[14rem] flex-1">
          <TextInput value={goal} onChange={(e) => setGoal(e.target.value)} />
        </Field>
        <Field label="Competitors" className="w-full sm:w-44">
          <TextInput
            value={competitors}
            onChange={(e) => setCompetitors(e.target.value)}
          />
        </Field>
        <Field label="Scenario" className="w-full sm:w-44">
          <Select value={scenario} onChange={(e) => setScenario(e.target.value)}>
            <option value="full">Full adversarial</option>
            <option value="tool_failure">Tool failure only</option>
            <option value="conflict">Evidence conflict</option>
            <option value="budget">Budget constraint</option>
          </Select>
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={running}
            onClick={() => run("/api/agent/graph/run/stream", false)}
          >
            Run LangGraph Scan
          </Button>
          <Button
            variant="ghost"
            disabled={running}
            onClick={() => run("/api/agent/graph/adversarial", true)}
          >
            Run Adversarial Test
          </Button>
          {running ? (
            <Button variant="danger" onClick={() => controllerRef.current?.abort()}>
              Stop
            </Button>
          ) : null}
        </div>
      </div>

      <p className="mb-4 border-2 border-line-soft bg-bg-2 px-3 py-2 text-[12.5px]">
        {status}
      </p>

      <div className="grid gap-4 lg:grid-cols-[minmax(16rem,1fr)_1.3fr]">
        <div>
          <SectionTitle>Execution graph</SectionTitle>
          <Graph statuses={statuses} />
          <div className="mt-2.5 flex flex-wrap gap-3 text-[11px] text-ink-3">
            {[
              ["completed", "done"],
              ["running", "running"],
              ["recovered", "recovered"],
              ["failed", "failed"],
              ["pending", "pending"],
            ].map(([k, label]) => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <i
                  aria-hidden="true"
                  className={cx(
                    "inline-block h-2.5 w-2.5 border-2 border-line",
                    k === "completed" && "bg-brand-green",
                    k === "running" && "bg-brand-blue",
                    k === "recovered" && "bg-brand-yellow",
                    k === "failed" && "bg-brand-red",
                    k === "pending" && "bg-brand-slate opacity-50",
                  )}
                />
                {label}
              </span>
            ))}
          </div>
        </div>

        <div>
          <SectionTitle>Live framework events</SectionTitle>
          <div
            ref={liveRef}
            className="flex max-h-[26rem] flex-col gap-1.5 overflow-y-auto border-2 border-line bg-bg-2 p-2"
          >
            {events.length ? (
              events.map(({ fw, entry }, i) => (
                <div
                  key={i}
                  className={cx(
                    "grid grid-cols-[1.25rem_1fr] items-baseline gap-2 border-2 px-2 py-1.5 text-[12.5px]",
                    /(failed|timeout|conflict_detected|deadlock|budget)/.test(fw)
                      ? "border-brand-yellow bg-brand-yellow-bg"
                      : "border-line-soft bg-surface",
                  )}
                >
                  <span aria-hidden="true" className="text-center">
                    {EVENT_ICON[fw] || "•"}
                  </span>
                  <span className="min-w-0">
                    <b className="font-bold">{entry.title || fw}</b>
                    {entry.detail ? (
                      <em className="mt-0.5 block not-italic text-[11.5px] text-ink-3">
                        {entry.detail}
                      </em>
                    ) : null}
                  </span>
                </div>
              ))
            ) : (
              <p className="p-2 text-[12px] text-ink-3">
                Run the graph to stream its events here.
              </p>
            )}
          </div>
        </div>
      </div>

      {result ? <FrameworkReport result={result} /> : null}
    </Panel>
  );
}

function FrameworkReport({ result }) {
  const f = result.framework || {};
  const ev = f.evaluation || {};
  const res = f.resource || {};
  const hyp = (f.hypotheses || [])[0] || {};
  const conflicts = f.conflicting_evidence || [];
  const fallbacks = f.fallback_history || [];

  return (
    <div className="mt-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Card>
          <h4 className="mb-2 text-[12.5px] font-bold uppercase">Planner</h4>
          <DataLine label="Plan version" value={f.plan_version || 1} />
          <DataLine label="Selected agents" value={(f.selected_agents || []).join(", ") || "—"} />
          <DataLine label="Runtime" value={f.runtime || "langgraph"} />
        </Card>

        <Card>
          <h4 className="mb-2 text-[12.5px] font-bold uppercase">Execution</h4>
          <DataLine label="Agents completed" value={(f.completed_agents || []).length} />
          <DataLine label="Graph steps" value={f.graph_steps || 0} />
          <DataLine label="Tool calls" value={(f.tool_executions || []).length} />
        </Card>

        <Card>
          <h4 className="mb-2 text-[12.5px] font-bold uppercase">Failure recovery</h4>
          {fallbacks.length ? (
            fallbacks.map((fb, i) => (
              <DataLine
                key={i}
                label={`${fb.tool} · ${fb.from} failed`}
                value={`recovered via ${fb.to}`}
                valueClass="text-brand-green"
              />
            ))
          ) : (
            <Note>No tool failures in this run.</Note>
          )}
        </Card>

        <Card>
          <h4 className="mb-2 text-[12.5px] font-bold uppercase">Verification</h4>
          <DataLine label="Verifications" value={f.verify_count || 0} />
          <DataLine label="Status" value={f.verification_status || "n/a"} />
          <DataLine label="Independent sources" value={(f.verification_findings || []).length} />
        </Card>

        <Card>
          <h4 className="mb-2 text-[12.5px] font-bold uppercase">Replanning</h4>
          <DataLine label="Replans" value={f.replan_count || 0} />
          <DataLine label="Final plan version" value={f.plan_version || 1} />
        </Card>

        <Card>
          <h4 className="mb-2 text-[12.5px] font-bold uppercase">Self-evaluation</h4>
          <DataLine label="Completion" value={pct(ev.completion_score)} />
          <DataLine label="Evidence" value={pct(ev.evidence_score)} />
          <DataLine
            label="Confidence"
            value={pct(ev.confidence_score != null ? ev.confidence_score : f.overall_confidence)}
          />
        </Card>

        <Card>
          <h4 className="mb-2 text-[12.5px] font-bold uppercase">Resource budget</h4>
          <DataLine
            label="Tool calls"
            value={`${res.tool_calls || 0} / ${res.max_tool_calls || "—"}`}
          />
          <DataLine label="Est. cost" value={`$${(res.estimated_cost || 0).toFixed(3)}`} />
          <DataLine
            label="Under pressure"
            value={f.adversarial && f.adversarial.enabled ? "yes" : "no"}
          />
        </Card>

        <Card>
          <h4 className="mb-2 text-[12.5px] font-bold uppercase">Checkpoints</h4>
          {(f.checkpoints || []).length ? (
            f.checkpoints.map((c, i) => (
              <DataLine key={i} label={c.label} value={`#${c.n}`} />
            ))
          ) : (
            <Note>—</Note>
          )}
        </Card>

        <Card>
          <h4 className="mb-2 text-[12.5px] font-bold uppercase">Hypothesis</h4>
          {hyp.statement ? (
            <>
              <p className="text-[12.5px]">{hyp.statement}</p>
              <div className="mt-2 flex items-center gap-2">
                <Tag accent={hyp.status === "SUPPORTED" ? "green" : "orange"}>
                  {hyp.status || "PROPOSED"}
                </Tag>
                <span className="text-[11.5px] text-ink-3">conf {pct(hyp.confidence)}</span>
              </div>
            </>
          ) : (
            <Note>—</Note>
          )}
        </Card>

        <Card className="sm:col-span-2">
          <h4 className="mb-2 text-[12.5px] font-bold uppercase">Conflict resolution</h4>
          {conflicts.length ? (
            conflicts.map((c, i) => (
              <div key={i} className="mb-2 border-b border-line-soft pb-2 last:border-b-0">
                <DataLine label="Subject" value={(c.subject || "").slice(0, 60)} />
                <p className="mt-1 text-[12px]">
                  A: {c.claim_a || ""}
                  <br />
                  B: {c.claim_b || ""}
                </p>
                <div className="mt-1.5">
                  <Tag accent={c.resolved ? "green" : "yellow"}>
                    {c.verdict || (c.resolved ? "RESOLVED" : "UNRESOLVED")}
                  </Tag>
                </div>
                {c.detail ? <Note>{c.detail}</Note> : null}
              </div>
            ))
          ) : (
            <Note>No conflicting evidence detected.</Note>
          )}
        </Card>

        <Card>
          <h4 className="mb-2 text-[12.5px] font-bold uppercase">Status</h4>
          <DataLine label="Outcome" value={result.status} />
          <DataLine label="Deadlock" value={f.deadlock_detected ? "detected" : "none"} />
          {f.termination_reason ? <Note>{f.termination_reason}</Note> : null}
        </Card>
      </div>

      <p className="mt-4 text-center text-[12px] text-ink-3">
        {(result.insights || []).length} prioritized insight(s) ·{" "}
        {(result.findings || []).length} finding(s) · the dashboard tabs above also
        reflect this run.
      </p>
    </div>
  );
}
