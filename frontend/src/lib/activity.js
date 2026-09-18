/* Agent progress + activity interpretation.
 *
 * Ported from the original `agent/activity.js`, with one deliberate change: the
 * functions that used to return HTML strings now return plain data, so React
 * renders them. The *semantics* — which phase maps to which tracker step, and the
 * exact plain-English wording for each phase — are unchanged.
 *
 * Nothing here exposes private chain-of-thought: every string is the agent's own
 * user-facing activity-log output.
 */

import { SIGNAL_LABEL, categoryLabel, toolHuman, toolLabel } from "./format.js";

export const STEPS = [
  { key: "goal", label: "Understanding your goal" },
  { key: "plan", label: "Creating search plan" },
  { key: "search", label: "Searching relevant sources" },
  { key: "analyze", label: "Analyzing findings" },
  { key: "trends", label: "Detecting trends" },
  { key: "report", label: "Preparing intelligence" },
];

/** Maps an activity phase to a tracker step. Forward-only, enforced by the caller. */
export function phaseToStep(entry) {
  switch (entry.phase) {
    case "start":
    case "goal":
      return "goal";
    case "plan":
      return "plan";
    case "decision":
    case "action":
    case "observation":
      return "search";
    // A thought before any tool call is still planning.
    case "thought":
      return entry.iteration ? "search" : "plan";
    case "final":
      return "analyze";
    case "insight":
      return entry.data?.priority_counts ? "report" : "trends";
    case "done":
      return "report";
    default:
      return null;
  }
}

/** Plain-language status line. Returns "" to leave the current line unchanged. */
export function humanMessage(entry) {
  const d = entry.data || {};
  switch (entry.phase) {
    case "start":
      return "Reading your tracking goal…";
    case "goal":
      return "Goal understood. Working out where to look.";
    case "plan": {
      const needs = (d.required_needs || []).map((n) =>
        categoryLabel(n).toLowerCase(),
      );
      return needs.length
        ? `Plan ready — will check ${needs.join(", ")}.`
        : "Search plan ready.";
    }
    case "decision":
      return d.tool
        ? `Decided to search ${toolHuman(d.tool)}.`
        : "Deciding the next action…";
    case "action":
      return `Searching ${toolHuman(d.tool) || "sources"}…`;
    case "observation": {
      const rel = d.relevant ?? 0;
      const dup = d.duplicates ?? 0;
      if (dup > 0) {
        return `Found ${rel} relevant finding${rel === 1 ? "" : "s"}, skipped ${dup} duplicate${dup === 1 ? "" : "s"}.`;
      }
      return `Found ${rel} relevant finding${rel === 1 ? "" : "s"}.`;
    }
    case "thought": {
      const title = entry.title || "";
      if (/^holding back/i.test(title)) {
        const need = d.need ? categoryLabel(d.need).toLowerCase() : "some sources";
        return `Skipping ${need} for now — only worth searching if the evidence calls for it.`;
      }
      if (/need is now satisfied/i.test(title)) {
        const which = (title.match(/'([^']+)'/) || [])[1];
        return `Got enough on ${which ? categoryLabel(which).toLowerCase() : "that"}. Deciding what's next…`;
      }
      return title || "Comparing new results with what was already collected…";
    }
    case "warning": {
      const t = entry.title || "";
      if (/llm|reasoner|model/i.test(t)) return "";
      if (/simulation/i.test(t)) return "Using demo data for a fast offline run.";
      if (/degraded|provider/i.test(t))
        return "One source was unavailable — continuing with the others.";
      if (/iteration limit/i.test(t))
        return "Reached the step limit — summarizing what was found.";
      if (/unavailable/i.test(t))
        return "A tool is unavailable — continuing with the rest.";
      return "";
    }
    case "error":
      return "A source failed. Continuing with the rest.";
    case "final":
      return "Enough information gathered. Prioritizing strategic impact…";
    case "insight":
      return d.priority_counts
        ? "Writing your intelligence report…"
        : "Ranking what matters most…";
    case "done":
      return "Intelligence ready.";
    default:
      return entry.title || "Working…";
  }
}

/** warn / err / "" — drives the tick row styling. */
export const entryTone = (entry) =>
  entry.phase === "warning" ? "warn" : entry.phase === "error" ? "err" : "";

/* ── judge-facing reasoning trail ───────────────────────── */
/**
 * Rebuilds the decision trail as structured steps.
 * Same content and ordering as the original `reasoningTrail()`, minus the HTML.
 */
export function reasoningTrail(result) {
  const st = result.state || {};
  const m = result.metrics || {};
  const plan = st.plan || {};
  const steps = [];

  steps.push({ stage: "Goal understood", detail: st.user_goal || "" });

  const required = (plan.needs || []).filter((n) => n.required).map((n) => n.key);
  steps.push({
    stage: "Plan created",
    detail:
      `Information needs identified: ${required.join(", ") || "none"}.` +
      (plan.opening_move ? ` ${plan.opening_move}` : ""),
  });

  const held = (plan.needs || []).filter((n) => !n.required).map((n) => n.key);
  if (held.length) {
    steps.push({
      stage: `Deferred: ${held.join(", ")}`,
      detail:
        "Held back deliberately — searched only if the evidence justified it. " +
        "This is the agent choosing, not a fixed pipeline.",
    });
  }

  (st.tool_calls || []).forEach((call, i) => {
    const decision = (st.decisions || [])[i] || {};
    const obs = (st.observations || []).find((o) => o.iteration === call.iteration);

    steps.push({
      stage: `Decision ${i + 1} → ${toolLabel(call.tool)}`,
      detail: decision.reasoning || call.reasoning || "",
      tone: "decision",
    });
    steps.push({
      stage: `Tool called: ${toolLabel(call.tool)}`,
      detail: describeInput(call.tool_input || {}),
      tone: "action",
    });
    steps.push({
      stage: `Observed ${call.items_returned} result${call.items_returned === 1 ? "" : "s"}`,
      detail: (obs && obs.summary) || call.note || "",
      tone: "observe",
    });
    if (obs) {
      const sig = (obs.signals || []).map((s) => SIGNAL_LABEL[s] || s).join(", ");
      steps.push({
        stage: "Analyzed relevance",
        detail:
          `${obs.relevant_items} relevant; yield judged "${obs.yield_quality}"` +
          (sig ? `; signals: ${sig}` : "") +
          ".",
        tone: "analyze",
      });
    }
  });

  steps.push({
    stage: "Decided collection was complete",
    detail: st.stop_reason || st.final_decision || "",
    tone: "decision",
  });
  const c = m.priority_counts || {};
  steps.push({
    stage: `Generated ${m.insights || 0} prioritized insight${m.insights === 1 ? "" : "s"}`,
    detail: `${c.HIGH || 0} high, ${c.MEDIUM || 0} medium, ${c.LOW || 0} low.`,
    tone: "done",
  });

  return steps;
}

function describeInput(input) {
  const bits = [];
  if (input.query) bits.push(`query "${input.query}"`);
  if ((input.keywords || []).length) bits.push(`keywords: ${input.keywords.join(", ")}`);
  if ((input.competitors || []).length)
    bits.push(`companies: ${input.competitors.join(", ")}`);
  if (input.since_days) bits.push(`window: last ${input.since_days} days`);
  return bits.join(" · ");
}

/* ── technical details ──────────────────────────────────── */
/** The ten run statistics shown behind "Show technical details". */
export function technicalStats(result) {
  const m = result.metrics || {};
  const llm = m.llm || {};
  return [
    ["Reasoning steps", `${m.iterations ?? "–"} / ${m.max_iterations ?? "–"}`],
    ["Tool calls", m.tool_calls ?? "–"],
    ["Findings", m.findings_total ?? "–"],
    ["Relevant", m.findings_relevant ?? "–"],
    ["Duplicates cut", m.duplicates_suppressed ?? 0],
    ["Duration", m.duration_ms != null ? `${(m.duration_ms / 1000).toFixed(1)}s` : "–"],
    ["Reasoner", m.reasoner || "–"],
    ["Model calls", llm.calls ?? 0],
    ["Est. cost", `$${llm.cost_usd ?? 0}`],
    ["Errors handled", m.errors ?? 0],
  ];
}

/** Observation rows for the Observations tab. */
export const observationRows = (result) => result?.state?.observations || [];
