import { useCallback, useRef, useState } from "react";
import * as api from "../lib/api.js";
import { STEPS, humanMessage, phaseToStep } from "../lib/activity.js";
import { toolHuman } from "../lib/format.js";
import { useRun } from "../state/RunProvider.jsx";

/* Owns the lifecycle of a classic ReAct agent run.
 *
 * Preserves three behaviours from the original that are easy to lose in a
 * rewrite:
 *
 *  1. The tracker only ever moves forward. Events can legitimately arrive for an
 *     earlier phase (a late observation after analysis started), and letting the
 *     tracker jump backwards makes the agent look like it is thrashing.
 *
 *  2. Collecting and rendering are separate failure domains. If the stream
 *     succeeded, the run is stored before anything renders — so a display bug can
 *     never be reported as "scan failed", which would throw away a run that
 *     actually worked and spend the API quota again.
 *
 *  3. If SSE is blocked (a proxy that buffers, a corporate gateway), the
 *     non-streaming endpoint is tried before declaring failure, and the activity
 *     log from that response backfills the feed.
 */

export function useAgentRun({ onFinished } = {}) {
  const { setRun } = useRun();

  const [running, setRunning] = useState(false);
  const [activeStep, setActiveStep] = useState(null);
  const [searchLabel, setSearchLabel] = useState(null);
  const [message, setMessage] = useState("Starting…");
  const [ticks, setTicks] = useState([]);
  const [error, setError] = useState("");
  const [agentState, setAgentState] = useState("idle");
  const [agentText, setAgentText] = useState("Connecting…");

  const controllerRef = useRef(null);
  const stepIndexRef = useRef(-1);

  const setStatus = useCallback((state, text) => {
    setAgentState(state);
    setAgentText(text);
  }, []);

  const onEvent = useCallback((event) => {
    if (event.type !== "activity" || !event.entry) return;
    const entry = event.entry;

    const step = phaseToStep(entry);
    if (step) {
      const idx = STEPS.findIndex((s) => s.key === step);
      if (idx >= stepIndexRef.current) {
        stepIndexRef.current = idx;
        setActiveStep(step);
        if (entry.phase === "action" && entry.data?.tool) {
          setSearchLabel(`Searching ${toolHuman(entry.data.tool)}`);
        }
      }
    }

    const msg = humanMessage(entry);
    if (msg) setMessage(msg);

    setTicks((prev) => [...prev, entry]);
  }, []);

  const finish = useCallback(
    (result) => {
      // Store first: even if a panel later fails to draw, the scan is safe.
      setRun(result);
      setActiveStep("__done__"); // past the last step, so all six read as done
      setStatus("ready", "Agent Monitoring");
      setRunning(false);
      onFinished?.(result);
    },
    [setRun, setStatus, onFinished],
  );

  const start = useCallback(
    async ({ goal, keywords, competitors, maxIterations, mode }) => {
      const trimmed = String(goal || "").trim();
      if (trimmed.length < 3) {
        setError("Tell the agent what to track first.");
        return false;
      }

      const payload = {
        goal: trimmed,
        keywords,
        competitors,
        max_iterations: Math.min(25, Math.max(1, Number(maxIterations) || 10)),
        simulation_mode: mode === "sim",
      };

      setError("");
      setTicks([]);
      setMessage("Starting the agent…");
      stepIndexRef.current = -1;
      setActiveStep("goal");
      setSearchLabel(null);
      setRunning(true);
      setStatus("running", "Agent Working");

      const controller = new AbortController();
      controllerRef.current = controller;

      try {
        const result = await api.runAgentStream(
          payload,
          onEvent,
          controller.signal,
        );
        finish(result);
        return true;
      } catch (err) {
        if (err.name === "AbortError") {
          setRunning(false);
          setStatus("ready", "Agent Ready");
          return false;
        }
        // SSE may be proxied away — the plain endpoint still works.
        setMessage("Working… (live updates unavailable)");
        try {
          const result = await api.runAgent(payload);
          setTicks(result.activity_log || []);
          finish(result);
          return true;
        } catch (fallbackErr) {
          setRunning(false);
          setStatus("error", "Run failed");
          setError(
            `Scan failed: ${fallbackErr.message}` +
              (err?.message ? ` (stream: ${err.message})` : ""),
          );
          return false;
        }
      } finally {
        controllerRef.current = null;
      }
    },
    [finish, onEvent, setStatus],
  );

  const stop = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  return {
    running,
    activeStep,
    searchLabel,
    message,
    ticks,
    error,
    setError,
    agentState,
    agentText,
    setStatus,
    start,
    stop,
  };
}
