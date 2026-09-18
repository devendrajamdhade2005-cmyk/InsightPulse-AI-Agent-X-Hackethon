import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "../../lib/api.js";
import { accentClass, cx } from "../../lib/accents.js";
import {
  Button,
  EmptyState,
  Field,
  Note,
  Panel,
  PanelHead,
  Reveal,
  SectionTitle,
  Select,
  Table,
  TableWrap,
  Td,
  Th,
  TextInput,
} from "../ui/Primitives.jsx";
import { ChartColumn, TrendingDown, TrendingUp } from "../icons/index.jsx";

/* Evaluation (Task 6).
 *
 * Every number comes from a stored evaluation result produced by a real agent
 * execution. Where a metric was not measurable this shows the recorded reason
 * instead of a number, and with no suite run yet it shows an explicit empty state
 * rather than placeholder scores.
 */

const SCENARIOS = [
  "NORMAL", "AMBIGUOUS", "ADVERSARIAL", "CONTRADICTORY",
  "INCOMPLETE", "TOOL_FAILURE", "UNSUPPORTED_CONCLUSION",
];

const CARD_METRICS = [
  ["accuracy", "Accuracy", "blue"],
  ["task_completion", "Task completion", "green"],
  ["groundedness", "Groundedness", "cyan"],
  ["hallucination_rate", "Hallucination", "red"],
  ["recovery_rate", "Recovery", "green"],
  ["robustness", "Robustness", "purple"],
  ["evidence_quality", "Evidence quality", "orange"],
  ["uncertainty_handling", "Uncertainty handling", "yellow"],
  ["consistency", "Consistency", "cyan"],
  ["reliability", "Reliability", "green"],
  ["latency", "Median latency", "slate"],
  ["resource_efficiency", "Resource efficiency", "slate"],
];

const HUMAN_DIMS = [
  ["accuracy_score", "Accuracy"],
  ["completion_score", "Task completion"],
  ["evidence_score", "Evidence quality"],
  ["groundedness_score", "Groundedness"],
  ["uncertainty_score", "Uncertainty handling"],
  ["actionability_score", "Actionability"],
  ["overall_score", "Overall quality"],
];

const OUTCOME_STYLE = {
  pass: "bg-brand-green-bg text-brand-green",
  partial: "bg-brand-yellow-bg text-brand-yellow",
  fail: "bg-brand-red-bg text-brand-red",
  error: "bg-brand-red-bg text-brand-red",
};

const fmtMetric = (entry) => {
  if (!entry) return "—";
  if (!entry.available) return "n/a";
  return entry.unit === "ms"
    ? `${Math.round(entry.value)}ms`
    : `${(entry.value * 100).toFixed(0)}%`;
};

function Pill({ outcome }) {
  const key = String(outcome || "").toLowerCase();
  return (
    <span
      className={cx(
        "inline-block border-2 border-line px-1.5 py-0.5 text-[10.5px] font-bold uppercase",
        OUTCOME_STYLE[key] || "bg-brand-slate-bg text-ink-3",
      )}
    >
      {outcome}
    </span>
  );
}

function Delta({ dir, children, title }) {
  return (
    <span
      title={title}
      className={cx(
        "mr-1 inline-block border-2 border-line px-1.5 py-0.5 text-[11px] font-bold",
        dir === "up" && "bg-brand-green-bg text-brand-green",
        dir === "down" && "bg-brand-red-bg text-brand-red",
        dir === "flat" && "bg-brand-slate-bg text-ink-3",
      )}
    >
      {children}
    </span>
  );
}

/**
 * Last-resort lookup for a metric absent from the suite aggregate.
 * Only covers suites stored before the runner rolled these in.
 */
function aggregateFallback(key, metrics) {
  if (key !== "consistency" && key !== "reliability") return null;
  const block = key === "consistency" ? metrics?.consistency : metrics?.reliability;
  const measured = Object.entries(block || {}).filter(
    ([, v]) => v && typeof v === "object" && v.available && typeof v.value === "number",
  );
  if (!measured.length) {
    return {
      available: false,
      unavailable_reason:
        "no case in this suite was repeated, so this cannot be measured",
    };
  }
  const mean = measured.reduce((a, [, v]) => a + v.value, 0) / measured.length;
  return { available: true, value: mean, unit: "ratio", higher_is_better: true };
}

export function EvaluationView() {
  const [state, setState] = useState({
    metrics: null, runs: [], baseline: {}, history: [], regression: {},
    human: null, cases: null,
  });
  const [mode, setMode] = useState("demo");
  const [includeBaseline, setIncludeBaseline] = useState("1");
  const [status, setStatus] = useState("Loading evaluation data…");
  const [progress, setProgress] = useState([]);
  const [running, setRunning] = useState(false);
  const [review, setReview] = useState(null);

  const controllerRef = useRef(null);
  const progressRef = useRef(null);

  useEffect(() => {
    if (progressRef.current) {
      progressRef.current.scrollTop = progressRef.current.scrollHeight;
    }
  }, [progress.length]);

  const refresh = useCallback(async () => {
    try {
      const [metrics, runs, baseline, history, human, cases] = await Promise.all([
        api.getEvaluationMetrics(),
        api.getEvaluationRuns(),
        api.getEvaluationBaseline(),
        api.getEvaluationHistory(),
        api.getEvaluationHuman(),
        api.getEvaluationCases(),
      ]);
      setState({
        metrics,
        runs: runs.runs || [],
        baseline: baseline.comparison || {},
        history: history.history || [],
        regression: history.regression || {},
        human,
        cases,
      });
      const m = metrics || {};
      if (!m.has_data) {
        setStatus(
          `${(cases?.cases || []).length} benchmark cases loaded across ${SCENARIOS.length} scenario types.`,
        );
      } else {
        setStatus(
          `Suite ${m.latest_suite_id} · ${m.counts?.runs || 0} run(s) · ` +
            `${m.counts?.pass || 0} pass / ${m.counts?.partial || 0} partial / ${m.counts?.fail || 0} fail`,
        );
      }
    } catch (err) {
      setStatus(`Could not load evaluation data: ${err.message}`);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onProgress = useCallback((event) => {
    if (event.type !== "evaluation") return;
    const e = event.event;
    let line = "";
    if (e === "suite_started")
      line = `> Suite started — ${event.total_cases} case(s), mode ${event.mode}`;
    else if (e === "case_started")
      line = `• ${event.case_id} ${event.name} (${event.scenario}) ×${event.repeats}`;
    else if (e === "case_result") {
      const g =
        typeof event.groundedness === "number"
          ? ` grounded ${(event.groundedness * 100).toFixed(0)}%`
          : "";
      const glyph =
        event.outcome === "PASS" ? "[pass]" : event.outcome === "FAIL" ? "[fail]" : "[part]";
      line = `   ${glyph} ${event.case_id} → ${event.outcome}${g}`;
    } else if (e === "baseline_started")
      line = `> Baseline ${event.system} — ${event.cases} case(s)`;
    else if (e === "baseline_result")
      line = `   · ${event.system} ${event.case_id} → ${event.outcome}`;
    else if (e === "suite_completed")
      line = `= Suite complete — overall ${typeof event.overall === "number" ? `${(event.overall * 100).toFixed(1)}%` : "n/a"}`;
    if (line) setProgress((prev) => [...prev, line]);
  }, []);

  const runSuite = useCallback(async () => {
    setRunning(true);
    setProgress([]);
    setStatus(`Running the ${mode} evaluation suite against the real agent…`);
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      await api.runEvaluationStream(
        { mode, include_baseline: includeBaseline === "1", simulation_mode: true },
        onProgress,
        controller.signal,
      );
      setStatus("Evaluation complete. Loading results…");
      await refresh();
    } catch (err) {
      setStatus(
        err.name === "AbortError" ? "Stopped." : `Evaluation failed: ${err.message}`,
      );
    } finally {
      controllerRef.current = null;
      setRunning(false);
    }
  }, [mode, includeBaseline, onProgress, refresh]);

  const openReview = useCallback(async (runId) => {
    try {
      const data = await api.getEvaluationRun(runId);
      setReview({ runId, ...data });
    } catch (err) {
      setStatus(`Could not open the run: ${err.message}`);
    }
  }, []);

  const m = state.metrics || {};
  const suiteId = m.latest_suite_id || "";

  return (
    <Panel>
      <PanelHead
        eyebrow="Quality measurement"
        title="Evaluation"
        sub="Automated and human evaluation of the real InsightPulse agent across normal, ambiguous, adversarial, contradictory, incomplete, tool-failure and unsupported-conclusion scenarios — with repeated runs and baseline comparison."
      />

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <Field label="Suite" className="min-w-[12rem] flex-1">
          <Select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="demo">Demo suite (representative)</option>
            <option value="full">Full suite (all cases)</option>
            <option value="adversarial">Adversarial suite</option>
          </Select>
        </Field>
        <Field label="Baseline" className="w-full sm:w-44">
          <Select
            value={includeBaseline}
            onChange={(e) => setIncludeBaseline(e.target.value)}
          >
            <option value="1">Include baseline</option>
            <option value="0">Skip baseline</option>
          </Select>
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={running} onClick={runSuite}>
            Run Evaluation Suite
          </Button>
          {running ? (
            <Button variant="danger" onClick={() => controllerRef.current?.abort()}>
              Stop
            </Button>
          ) : null}
          {["pdf", "md", "html"].map((fmt) => (
            <Button
              key={fmt}
              as="a"
              size="xs"
              variant="ghost"
              href={api.evaluationReportUrl(fmt, suiteId)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {fmt.toUpperCase()}
            </Button>
          ))}
        </div>
      </div>

      <p className="mb-3 border-2 border-line-soft bg-bg-2 px-3 py-2 text-[12.5px]">
        {status}
      </p>

      {progress.length ? (
        <div
          ref={progressRef}
          className="mb-4 max-h-56 overflow-y-auto border-2 border-line bg-bg-2 p-2 font-mono text-[11.5px]"
        >
          {progress.map((line, i) => (
            <div
              key={i}
              className={cx(
                "whitespace-pre-wrap py-0.5",
                line.includes("[fail]") ? "text-brand-red" : "text-ink-2",
              )}
            >
              {line}
            </div>
          ))}
        </div>
      ) : null}

      {!m.has_data ? (
        <>
          <EmptyState
            icon={ChartColumn}
            title="No evaluation data yet"
            body="Run the evaluation suite to measure accuracy, groundedness, hallucination, recovery, consistency, latency and resource efficiency against the real agent."
          />
          <CasesTable cases={state.cases?.cases || []} />
          <Methodology specs={m.methodology || []} />
        </>
      ) : (
        <>
          <MetricCards state={state} />
          <ScenarioMatrix matrix={m.scenario_matrix || {}} />
          <CaseTable runs={state.runs} onReview={openReview} />
          <BaselineView baseline={state.baseline} />
          <HumanView
            human={state.human}
            review={review}
            onReview={openReview}
            onClose={() => setReview(null)}
            onSaved={refresh}
          />
          <HistoryView history={state.history} regression={state.regression} />
          <Methodology specs={m.methodology || []} />
        </>
      )}
    </Panel>
  );
}

/* ── metric cards ────────────────────────────────────────── */
function MetricCards({ state }) {
  const latest = state.metrics?.latest || {};
  const reg = (state.regression?.changes || []).reduce((acc, c) => {
    acc[c.metric] = c;
    return acc;
  }, {});

  // Prefer an unblocked baseline system for the comparison column.
  const systems = Object.values(state.baseline || {});
  const preferred = systems.find((s) => !s.blocked) || systems[0];
  const baselineRows = {};
  for (const row of preferred?.rows || []) baselineRows[row.metric] = row;

  const overall = latest.overall_score;

  return (
    <>
      <div
        className={cx(
          accentClass("cyan"),
          "nb-a-bg mb-4 flex flex-wrap items-center justify-between gap-3 border-2 border-line px-4 py-3",
        )}
      >
        <span className="text-[13px] font-bold uppercase tracking-wide">
          Overall evaluation score
        </span>
        <b className="font-mono text-2xl font-bold tabular-nums">
          {typeof overall === "number" ? `${(overall * 100).toFixed(1)}%` : "n/a"}
        </b>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {CARD_METRICS.map(([key, label, accent]) => {
          const entry = latest[key] || aggregateFallback(key, state.metrics);
          if (!entry) return null;

          if (!entry.available) {
            return (
              <article
                key={key}
                className="nb-frame-flat border-l-[6px] border-l-line-soft p-3 opacity-75"
              >
                <span className="block text-[11.5px] font-semibold text-ink-2">
                  {label}
                </span>
                <b className="my-1 block font-mono text-xl font-bold">n/a</b>
                <span className="block text-[11px] text-ink-4">
                  {entry.unavailable_reason || "not measurable"}
                </span>
              </article>
            );
          }

          const isMs = entry.unit === "ms";
          const value = isMs
            ? `${Math.round(entry.value)}ms`
            : `${(entry.value * 100).toFixed(1)}%`;
          const lower = entry.higher_is_better === false;

          const b = baselineRows[key];
          let cmp = null;
          if (b?.available && typeof b.difference === "number" && b.direction !== "equal") {
            // Two independent signals — conflating them is what made a latency
            // improvement render as an up arrow:
            //   arrow  = which way the number moved (sign of the difference)
            //   colour = whether that movement is good (the declared direction)
            const good = b.direction === "better";
            const ArrowIcon = b.difference < 0 ? TrendingDown : TrendingUp;
            const delta = isMs
              ? `${Math.abs(Math.round(b.difference))}ms`
              : `${Math.abs(b.difference * 100).toFixed(1)}%`;
            cmp = (
              <Delta
                dir={good ? "up" : "down"}
                title={good ? "better than baseline" : "worse than baseline"}
              >
                <ArrowIcon
                  aria-hidden="true"
                  className="mr-1 inline h-3 w-3"
                  strokeWidth={3}
                />
                {delta} vs baseline
              </Delta>
            );
          }

          const r = reg[key];
          const trend =
            r?.direction === "improved" ? (
              <Delta dir="up">improved</Delta>
            ) : r?.direction === "regressed" ? (
              <Delta dir="down">regressed</Delta>
            ) : null;

          return (
            <article
              key={key}
              className={cx(
                accentClass(accent),
                "nb-frame nb-a-border border-l-[6px] p-3",
              )}
            >
              <span className="block text-[11.5px] font-semibold text-ink-2">
                {label}
                {lower ? (
                  <em className="ml-1 not-italic font-normal text-ink-4">
                    (lower is better)
                  </em>
                ) : null}
              </span>
              <b className="my-1 block font-mono text-2xl font-bold tabular-nums">
                {value}
              </b>
              <span className="block min-h-[1.25rem] text-[11px]">
                {cmp}
                {trend}
              </span>
            </article>
          );
        })}
      </div>
    </>
  );
}

/* ── scenario matrix ─────────────────────────────────────── */
function ScenarioMatrix({ matrix }) {
  return (
    <section className="mb-6">
      <SectionTitle>Scenario coverage</SectionTitle>
      <TableWrap>
        <Table>
          <thead>
            <tr>
              {["Scenario", "Cases", "Pass", "Partial", "Fail", "Score"].map((h) => (
                <Th key={h}>{h}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SCENARIOS.map((s) => {
              const b = matrix[s] || {
                total: 0, passed: 0, partial: 0, failed: 0, score: 0,
              };
              const rowClass = !b.total
                ? "text-ink-4"
                : b.failed
                  ? "bg-brand-red-bg"
                  : b.partial
                    ? "bg-brand-yellow-bg"
                    : "";
              return (
                <tr key={s} className={rowClass}>
                  <Td className="capitalize">{s.replace(/_/g, " ").toLowerCase()}</Td>
                  <Td>{b.total || "—"}</Td>
                  <Td>{b.passed || 0}</Td>
                  <Td>{b.partial || 0}</Td>
                  <Td>{b.failed || 0}</Td>
                  <Td className="font-mono">
                    {b.total ? `${(b.score * 100).toFixed(0)}%` : "not run"}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </TableWrap>
    </section>
  );
}

/* ── per-case results ────────────────────────────────────── */
function CaseTable({ runs, onReview }) {
  const mine = (runs || []).filter((r) => r.system === "insightpulse");
  if (!mine.length) return null;

  return (
    <section className="mb-6">
      <SectionTitle>Case results</SectionTitle>
      <TableWrap>
        <Table>
          <thead>
            <tr>
              {["Case", "Scenario", "Status", "Accuracy", "Grounded", "Halluc.", "Recovery", "Latency", "Human"].map(
                (h) => (
                  <Th key={h}>{h}</Th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {mine.map((r, i) => {
              const mm = r.metrics || {};
              return (
                <tr key={`${r.evaluation_run_id}-${i}`}>
                  <Td className="font-mono">
                    {r.case_id}
                    {r.repeat_index ? (
                      <em className="not-italic text-ink-4"> #{r.repeat_index + 1}</em>
                    ) : null}
                  </Td>
                  <Td className="capitalize">
                    {(r.scenario_type || "").replace(/_/g, " ").toLowerCase()}
                  </Td>
                  <Td>
                    <Pill outcome={r.outcome} />
                  </Td>
                  <Td>{fmtMetric(mm.accuracy)}</Td>
                  <Td>{fmtMetric(mm.groundedness)}</Td>
                  <Td>{fmtMetric(mm.hallucination_rate)}</Td>
                  <Td>{fmtMetric(mm.recovery_rate)}</Td>
                  <Td>{fmtMetric(mm.latency)}</Td>
                  <Td>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => onReview(r.evaluation_run_id)}
                    >
                      {r.reviewer_count ? `${r.reviewer_count} reviewed` : "Review"}
                    </Button>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </TableWrap>
      <Note>
        “n/a” means the metric was not applicable to that case — the recorded reason
        is shown in the exported report.
      </Note>
    </section>
  );
}

/* ── baseline ────────────────────────────────────────────── */
function BaselineView({ baseline }) {
  const systems = Object.entries(baseline || {});
  if (!systems.length) return null;

  return (
    <section className="mb-6">
      <SectionTitle>Baseline vs InsightPulse</SectionTitle>
      {systems.map(([name, comp]) => (
        <div key={name} className="mb-4">
          <h4 className="mb-1.5 text-[13px] font-bold uppercase capitalize">
            {name.replace(/_/g, " ")}
          </h4>
          {comp.blocked ? (
            <p className="mb-2 border-2 border-brand-yellow bg-brand-yellow-bg px-3 py-2 text-[12px] text-brand-yellow">
              This baseline could not produce output: {comp.blocked_reason || ""}.{" "}
              {comp.blocked_note || ""}
            </p>
          ) : null}
          <Note>
            Cases compared: {(comp.cases_compared || []).join(", ") || "none"}.
            {(comp.excluded_cases || []).length
              ? ` Excluded: ${comp.excluded_cases.join(", ")} — ${comp.exclusion_reason || ""}`
              : ""}
          </Note>
          <TableWrap className="mt-2">
            <Table>
              <thead>
                <tr>
                  {["Metric", "Baseline", "InsightPulse", "Difference", ""].map((h, i) => (
                    <Th key={i}>{h}</Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(comp.rows || []).map((row, i) => {
                  if (!row.available) {
                    return (
                      <tr key={i} className="text-ink-4">
                        <Td>{row.label}</Td>
                        <Td colSpan={4}>
                          not comparable — {row.unavailable_reason || ""}
                        </Td>
                      </tr>
                    );
                  }
                  const isMs = row.unit === "ms";
                  const fmt = (v) =>
                    isMs ? `${Math.round(v)}ms` : `${(v * 100).toFixed(1)}%`;
                  const dir =
                    row.direction === "better"
                      ? "up"
                      : row.direction === "worse"
                        ? "down"
                        : "flat";
                  return (
                    <tr key={i}>
                      <Td>
                        {row.label}
                        {row.higher_is_better === false ? (
                          <em className="not-italic text-ink-4"> (lower better)</em>
                        ) : null}
                      </Td>
                      <Td className="font-mono">{fmt(row.baseline)}</Td>
                      <Td className="font-mono font-bold">{fmt(row.insightpulse)}</Td>
                      <Td className="font-mono">
                        {isMs
                          ? `${Math.round(row.difference)}ms`
                          : `${(row.difference * 100).toFixed(1)}%`}
                      </Td>
                      <Td>
                        <Delta dir={dir}>{row.direction || ""}</Delta>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        </div>
      ))}
    </section>
  );
}

/* ── human review ────────────────────────────────────────── */
function HumanView({ human, review, onReview, onClose, onSaved }) {
  const h = human || {};
  const pending = h.pending || [];
  const completed = h.completed || [];

  return (
    <section className="mb-6">
      <SectionTitle>Human evaluation</SectionTitle>
      <Note>
        {completed.length} reviewed · {pending.length} awaiting review ·{" "}
        {h.review_count || 0} total review(s) submitted.
      </Note>

      {review ? (
        <ReviewForm review={review} onClose={onClose} onSaved={onSaved} />
      ) : null}

      {completed.length ? (
        <TableWrap className="mt-3">
          <Table>
            <thead>
              <tr>
                {["Case", "Scenario", "Automated", "Reviewers", ""].map((hd, i) => (
                  <Th key={i}>{hd}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {completed.map((c) => (
                <tr key={c.evaluation_run_id}>
                  <Td className="font-mono">{c.case_id}</Td>
                  <Td className="capitalize">
                    {(c.scenario_type || "").replace(/_/g, " ").toLowerCase()}
                  </Td>
                  <Td>
                    <Pill outcome={c.outcome} />
                  </Td>
                  <Td>{c.reviewer_count}</Td>
                  <Td>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => onReview(c.evaluation_run_id)}
                    >
                      Open
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      ) : null}
      <Note>Use the “Review” button in the case table to score a run.</Note>
    </section>
  );
}

function ReviewForm({ review, onClose, onSaved }) {
  const run = review.run || {};
  const hv = review.human_vs_automated || {};
  const [scores, setScores] = useState(() =>
    Object.fromEntries(HUMAN_DIMS.map(([k]) => [k, 3])),
  );
  const [decision, setDecision] = useState("PARTIAL");
  const [comment, setComment] = useState("");
  const [saveStatus, setSaveStatus] = useState("");

  const submit = async () => {
    try {
      const res = await api.submitHumanReview({
        evaluation_run_id: review.runId,
        reviewer_id: `reviewer-${Date.now().toString().slice(-4)}`,
        decision,
        comment: comment.slice(0, 1200),
        ...scores,
      });
      const agg = res.aggregate || {};
      setSaveStatus(
        `Saved. ${agg.reviewer_count} reviewer(s), average overall ${agg.average_overall}` +
          (agg.score_variance ? `, variance ${agg.score_variance}` : ""),
      );
      await onSaved();
    } catch (err) {
      setSaveStatus(`Could not save: ${err.message}`);
    }
  };

  return (
    <div className="nb-frame-flat mt-3 bg-bg-2 p-4">
      <h4 className="mb-1.5 text-[13px] font-bold uppercase">
        Review {run.case_id || review.runId} — {run.case_name || ""}
      </h4>
      <p className="mb-3 flex flex-wrap items-center gap-2 text-[12px] text-ink-3">
        Automated outcome: <Pill outcome={run.outcome || ""} /> ·{" "}
        {(run.outcome_reasons || []).join("; ")}
      </p>

      <div className="mb-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {HUMAN_DIMS.map(([key, label]) => (
          <Field key={key} label={label}>
            <Select
              value={scores[key]}
              onChange={(e) =>
                setScores((prev) => ({ ...prev, [key]: Number(e.target.value) }))
              }
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </Field>
        ))}
      </div>

      <div className="mb-3 grid gap-2.5 sm:grid-cols-2">
        <Field label="Decision">
          <Select value={decision} onChange={(e) => setDecision(e.target.value)}>
            <option value="PASS">PASS</option>
            <option value="PARTIAL">PARTIAL</option>
            <option value="FAIL">FAIL</option>
          </Select>
        </Field>
        <Field label="Comment (optional)">
          <TextInput
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What stood out?"
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={submit}>
          Submit review
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>

      {saveStatus ? (
        <p className="mt-2 text-[12px] font-semibold text-brand-green">{saveStatus}</p>
      ) : null}

      {hv.available ? (
        <div className="mt-4 border-t-2 border-line pt-3">
          <h5 className="mb-2 text-[12.5px] font-bold uppercase">
            Automated vs human
            {hv.disagreement_detected ? (
              <span className="ml-2 text-brand-yellow">— disagreement detected</span>
            ) : null}
          </h5>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  {["Dimension", "Automated", "Human", "Gap"].map((hd) => (
                    <Th key={hd}>{hd}</Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(hv.rows || []).map((r, i) => (
                  <tr key={i} className={r.disagreement ? "bg-brand-yellow-bg" : ""}>
                    <Td>{r.metric}</Td>
                    <Td className="font-mono">
                      {typeof r.automated === "number"
                        ? `${(r.automated * 100).toFixed(0)}%`
                        : "n/a"}
                    </Td>
                    <Td className="font-mono">
                      {typeof r.human_normalised === "number"
                        ? `${(r.human_normalised * 100).toFixed(0)}%`
                        : "—"}
                    </Td>
                    <Td className="font-mono">
                      {typeof r.gap === "number" ? `${(r.gap * 100).toFixed(0)}%` : "—"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </div>
      ) : null}
    </div>
  );
}

/* ── history + regression ────────────────────────────────── */
function HistoryView({ history, regression }) {
  const reg = regression || {};
  return (
    <section className="mb-6">
      <SectionTitle>Evaluation history</SectionTitle>
      {history.length ? (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                {["Suite", "When", "Mode", "Overall", "Change"].map((h) => (
                  <Th key={h}>{h}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.slice(0, 8).map((h, i) => {
                const overall = (h.aggregate || {}).overall_score;
                return (
                  <tr key={h.suite_id}>
                    <Td className="font-mono">{h.suite_id}</Td>
                    <Td>
                      {(h.completed_at || h.started_at || "")
                        .slice(0, 16)
                        .replace("T", " ")}
                    </Td>
                    <Td>{h.mode || ""}</Td>
                    <Td className="font-mono">
                      {typeof overall === "number"
                        ? `${(overall * 100).toFixed(1)}%`
                        : "n/a"}
                    </Td>
                    <Td>
                      {i === 0 && typeof reg.overall_delta === "number" ? (
                        <Delta dir={reg.overall_delta >= 0 ? "up" : "down"}>
                          {reg.overall_delta >= 0 ? "+" : ""}
                          {(reg.overall_delta * 100).toFixed(1)}%
                        </Delta>
                      ) : null}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
      ) : (
        <Note>No history yet.</Note>
      )}

      {reg.compared ? (
        <div className="mt-3 border-2 border-line-soft bg-bg-2 p-3">
          <h4 className="mb-1.5 text-[12.5px] font-bold uppercase">
            Regression vs {reg.previous_suite_id || "previous suite"}
          </h4>
          {(reg.regressions || []).length ? (
            <ul className="grid gap-0.5 text-[12px] text-brand-red">
              {reg.regressions.map((r, i) => (
                <li key={i}>
                  {r.label || r.metric}: {r.previous} → {r.current}
                </li>
              ))}
            </ul>
          ) : (
            <Note>No regressions detected.</Note>
          )}
          {(reg.improvements || []).length ? (
            <ul className="mt-1.5 grid gap-0.5 text-[12px] text-brand-green">
              {reg.improvements.map((r, i) => (
                <li key={i}>
                  {r.label || r.metric}: {r.previous} → {r.current}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <Note>{reg.reason || "No previous suite to compare against."}</Note>
      )}
    </section>
  );
}

/* ── dataset + methodology ───────────────────────────────── */
function CasesTable({ cases }) {
  if (!cases.length) return null;
  return (
    <section className="mb-6 mt-5">
      <SectionTitle>Benchmark dataset</SectionTitle>
      <TableWrap>
        <Table>
          <thead>
            <tr>
              {["Case", "Scenario", "Goal", "Difficulty", "Repeats"].map((h) => (
                <Th key={h}>{h}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => (
              <tr key={c.case_id}>
                <Td className="font-mono">{c.case_id}</Td>
                <Td className="capitalize">
                  {(c.scenario_type || "").replace(/_/g, " ").toLowerCase()}
                </Td>
                <Td>{c.user_goal}</Td>
                <Td>{c.difficulty}</Td>
                <Td>{c.repeat_count}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrap>
    </section>
  );
}

function Methodology({ specs }) {
  if (!specs.length) return null;
  return (
    <Reveal summary="Metric methodology" className="mt-4">
      <TableWrap>
        <Table>
          <thead>
            <tr>
              {["Metric", "Definition", "Formula", "Data source"].map((h) => (
                <Th key={h}>{h}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {specs.map((s) => (
              <tr key={s.label}>
                <Td>
                  <b className="font-bold">{s.label}</b>
                  <br />
                  <span className="text-[11px] text-ink-4">
                    {s.unit} · {s.scope} ·{" "}
                    {s.higher_is_better ? "higher better" : "lower better"}
                  </span>
                </Td>
                <Td>{s.definition}</Td>
                <Td className="font-mono text-[11px]">{s.formula}</Td>
                <Td className="text-ink-3">{s.data_source}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrap>
    </Reveal>
  );
}
