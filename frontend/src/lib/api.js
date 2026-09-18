/* Backend client.
 *
 * Endpoints and payload shapes are exactly the ones the existing backend serves —
 * this rewrite changes the frontend framework and presentation, not the API
 * contract. Every request routes through apiUrl() so the host is configured in
 * exactly one place (lib/config.js).
 *
 * The original shipped four near-identical SSE readers. They are consolidated
 * into `streamSSE` here, parameterised by which event type carries the payload
 * and what to say when it never arrives — same behaviour, one implementation.
 */

import { apiUrl } from "./config.js";

async function readError(res) {
  try {
    const body = await res.json();
    return body.detail || body.message || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

async function getJSON(path) {
  const res = await fetch(apiUrl(path));
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

async function postJSON(path, payload) {
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

/**
 * Read a server-sent-event stream and resolve with the terminal payload.
 *
 * Frames are delimited by a blank line; within a frame only the `data:` line is
 * meaningful. A frame that fails to parse is skipped rather than aborting the
 * stream, because one malformed activity row should not discard a whole run.
 *
 * @param {string} path            endpoint to POST to
 * @param {object} payload         request body
 * @param {Function} onEvent       called with every decoded event
 * @param {AbortSignal} signal     cancellation
 * @param {object} opts
 * @param {string} opts.resultType event type carrying the final payload
 * @param {string} opts.resultKey  property on that event holding the payload
 * @param {string} opts.errorLabel used when the stream reports `type: "error"`
 * @param {string} opts.missing    used when the stream ends with no payload
 */
async function streamSSE(
  path,
  payload,
  onEvent,
  signal,
  { resultType, resultKey, errorLabel, missing },
) {
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(await readError(res));

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let outcome = null;

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const line = frame.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      let event;
      try {
        event = JSON.parse(line.slice(5).trim());
      } catch {
        continue;
      }
      if (event.type === resultType) outcome = event[resultKey];
      if (event.type === "error") throw new Error(event.message || errorLabel);
      onEvent(event);
    }
  }
  if (!outcome) throw new Error(missing);
  return outcome;
}

/* ── capability + catalogue ──────────────────────────────────── */
export const getTools = () => getJSON("/api/agent/tools");
export const getHealth = () => getJSON("/health");
export const getRuns = () => getJSON("/api/agent/runs");

/* ── the classic ReAct agent run ─────────────────────────────── */
/**
 * Stream an agent run. onEvent receives every decoded event:
 * run_started | activity | result | error | done. Resolves with the result.
 */
export function runAgentStream(payload, onEvent, signal) {
  return streamSSE("/api/agent/run/stream", payload, onEvent, signal, {
    resultType: "result",
    resultKey: "result",
    errorLabel: "agent error",
    missing: "the run ended without producing a report",
  });
}

/** Non-streaming fallback for environments where SSE is proxied away. */
export const runAgent = (payload) => postJSON("/api/agent/run", payload);

/* ── LangGraph agent framework (Task 5) ──────────────────────── */
export const getGraphInfo = () => getJSON("/api/agent/graph/info");

/**
 * Stream a LangGraph run. `path` is the endpoint:
 *   "/api/agent/graph/run/stream"  — normal run
 *   "/api/agent/graph/adversarial" — adversarial demo
 */
export function runGraphStream(path, payload, onEvent, signal) {
  return streamSSE(path, payload, onEvent, signal, {
    resultType: "result",
    resultKey: "result",
    errorLabel: "graph error",
    missing: "the graph run ended without a result",
  });
}

/* ── Evaluation & benchmarking (Task 6) ──────────────────────── */
export const getEvaluationCases = () => getJSON("/api/evaluation/cases");
export const getEvaluationMetrics = () => getJSON("/api/evaluation/metrics");
export const getEvaluationRuns = () => getJSON("/api/evaluation/runs");
export const getEvaluationBaseline = () => getJSON("/api/evaluation/baseline");
export const getEvaluationHistory = () => getJSON("/api/evaluation/history");
export const getEvaluationHuman = () => getJSON("/api/evaluation/human");
export const getEvaluationRun = (id) =>
  getJSON(`/api/evaluation/runs/${encodeURIComponent(id)}`);

export function evaluationReportUrl(format = "md", suiteId = "") {
  const q = new URLSearchParams({ format });
  if (suiteId) q.set("suite_id", suiteId);
  return apiUrl(`/api/evaluation/report?${q.toString()}`);
}

export const submitHumanReview = (payload) =>
  postJSON("/api/evaluation/human-review", payload);

/** Stream an evaluation suite, reporting live progress events. */
export function runEvaluationStream(payload, onEvent, signal) {
  return streamSSE("/api/evaluation/run/stream", payload, onEvent, signal, {
    resultType: "result",
    resultKey: "result",
    errorLabel: "evaluation error",
    missing: "the evaluation ended without producing a result",
  });
}

/* ── Tracing & observability (Task 7) ────────────────────────── */
export const getObservabilityStatus = () => getJSON("/api/observability/status");
export const getTraces = (limit = 20) =>
  getJSON(`/api/observability/traces?limit=${limit}`);
export const getTraceTree = (id) =>
  getJSON(`/api/observability/traces/${encodeURIComponent(id)}/tree`);
export const getTraceErrors = (limit = 10) =>
  getJSON(`/api/observability/errors?limit=${limit}`);
export const getTraceAnalysis = (id) =>
  getJSON(`/api/observability/analysis/${encodeURIComponent(id)}`);
export const getTraceRootCause = (id) =>
  getJSON(`/api/observability/root-cause/${encodeURIComponent(id)}`);
export const getOptimizationPolicy = () => getJSON("/api/observability/policy");
export const getFailureTargets = () =>
  getJSON("/api/observability/failure-targets");
export const getImprovementCycles = () => getJSON("/api/observability/cycles");

export const resetOptimizationPolicy = () =>
  postJSON("/api/observability/policy/reset");
export const revertOptimizationPolicy = () =>
  postJSON("/api/observability/policy/revert");
export const armControlledFailure = (payload) =>
  postJSON("/api/observability/controlled-failure", payload);

/**
 * Stream the full self-improvement cycle: trace → diagnose → improve → re-run →
 * measure → verify. Resolves with the report.
 */
export function runImprovementStream(payload, onEvent, signal) {
  return streamSSE(
    "/api/observability/improve/stream",
    payload,
    onEvent,
    signal,
    {
      resultType: "report",
      resultKey: "report",
      errorLabel: "improvement cycle error",
      missing: "the improvement cycle ended without producing a report",
    },
  );
}

/* ── Reports ─────────────────────────────────────────────────── */
export const generateReport = (runId, { force = false } = {}) =>
  postJSON("/api/report/generate", { run_id: runId, force });

export function reportPreviewUrl(reportId, { embedded = true } = {}) {
  return apiUrl(
    `/api/report/${encodeURIComponent(reportId)}/preview?embedded=${embedded}&t=${Date.now()}`,
  );
}

/** Download via blob so API errors surface instead of navigating away. */
export async function downloadReport(reportId, format) {
  const res = await fetch(
    apiUrl(`/api/report/${encodeURIComponent(reportId)}/download/${format}`),
  );
  if (!res.ok) throw new Error(await readError(res));
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `InsightPulse-Report-${reportId}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
