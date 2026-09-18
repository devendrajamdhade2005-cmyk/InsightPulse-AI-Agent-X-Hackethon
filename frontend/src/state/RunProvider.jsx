import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as derive from "../lib/derive.js";
import { categoryOf } from "../lib/format.js";

/* Client state + derived selectors — the React replacement for core/store.js.
 *
 * Shape and semantics are preserved from the original:
 *   · one run in memory, plus the previous run so KPI deltas have a baseline
 *   · every derivation computed once per run and cached
 *   · filtering is entirely client-side, so changing a filter or a nav section
 *     never refetches and never re-runs the agent
 *
 * The original cleared a Map cache inside setRun(). Here the derivations are
 * `useMemo`s keyed on `run`, which gives the same "compute once per run"
 * behaviour without a manual cache to invalidate.
 */

const RunContext = createContext(null);

const EMPTY_FILTERS = {
  priority: "all",
  source: "all",
  topic: null,
  competitor: null,
};

function readSet(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function persistSet(key, set) {
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    /* private mode — saved/tracked stay in memory for this session */
  }
}

export function RunProvider({ children }) {
  const [run, setRunState] = useState(null);
  const [previousRun, setPreviousRun] = useState(null);
  const [tools, setTools] = useState(null);
  const [report, setReport] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [chartWindow, setChartWindow] = useState(30);
  const [saved, setSaved] = useState(() => readSet("ip.saved"));
  const [tracked, setTracked] = useState(() => readSet("ip.tracked"));

  // Holds the live run so setRun can compare run_ids without adding `run` to the
  // callback's dependency list (which would recreate it on every run change).
  //
  // Written in an effect rather than during render: a render-phase ref write is
  // not safe under concurrent rendering, where a render can be started and thrown
  // away, latching a value that was never committed. setRun is only ever called
  // from an event handler or an async callback — i.e. after commit — so reading
  // the committed value here is both correct and what we actually want.
  const runRef = useRef(null);
  useEffect(() => {
    runRef.current = run;
  }, [run]);

  const setRun = useCallback((result) => {
    const current = runRef.current;
    if (current && current.run_id !== result.run_id) setPreviousRun(current);
    setRunState(result);
    setReport(null);
    setFilters(EMPTY_FILTERS);
  }, []);

  /* ── memoized derivations ─────────────────────────────── */
  const kpis = useMemo(() => derive.kpis(run, previousRun), [run, previousRun]);
  const topics = useMemo(() => derive.topics(run), [run]);
  const landscape = useMemo(() => derive.landscape(run), [run]);
  const sources = useMemo(() => derive.sources(run), [run]);
  const competitors = useMemo(() => derive.competitors(run), [run]);
  const contributors = useMemo(() => derive.contributors(run), [run]);
  const connections = useMemo(() => derive.connections(run), [run]);
  const counts = useMemo(() => derive.summaryCounts(run), [run]);
  const trend = useMemo(() => derive.mainTrend(run), [run]);
  const activity = useMemo(
    () => derive.activitySeries(run, chartWindow),
    [run, chartWindow],
  );

  /* ── O(1) lookups, built once per run ─────────────────── */
  const byId = useMemo(
    () => new Map((run?.findings || []).map((f) => [f.id, f])),
    [run],
  );
  const insightByFinding = useMemo(
    () => new Map((run?.insights || []).map((i) => [i.finding_id, i])),
    [run],
  );

  const findings = useMemo(() => run?.findings || [], [run]);
  const insights = useMemo(() => run?.insights || [], [run]);

  const findingById = useCallback((id) => byId.get(id) || null, [byId]);
  const insightForFinding = useCallback(
    (id) => insightByFinding.get(id) || null,
    [insightByFinding],
  );

  /** Findings that share a company or a signal with the given one. */
  const relatedTo = useCallback(
    (finding, limit = 5) => {
      if (!finding) return [];
      const signals = new Set(finding.signals || []);
      const company = (finding.competitor || "").toLowerCase();
      return findings
        .filter((f) => {
          if (f.id === finding.id) return false;
          if (company && (f.competitor || "").toLowerCase() === company) return true;
          return (f.signals || []).some((s) => signals.has(s));
        })
        .sort((a, b) => (b.relevance || 0) - (a.relevance || 0))
        .slice(0, limit);
    },
    [findings],
  );

  // The set of finding ids allowed by the active topic filter, or null when no
  // topic filter is set.
  const topicItems = useMemo(() => {
    if (!filters.topic) return null;
    const match = topics.find((t) => t.key === filters.topic);
    return new Set(match?.items || []);
  }, [filters.topic, topics]);

  const visibleInsights = useMemo(() => {
    const { priority, source, competitor } = filters;
    return insights.filter((i) => {
      if (priority !== "all" && i.priority !== priority) return false;
      if (source !== "all" && categoryOf(i.source) !== source) return false;
      if (
        competitor &&
        (i.competitor || "").toLowerCase() !== competitor.toLowerCase()
      ) {
        return false;
      }
      if (topicItems && !topicItems.has(i.finding_id)) return false;
      return true;
    });
  }, [filters, insights, topicItems]);

  const visibleFindings = useCallback(
    (category = null) => {
      const { competitor } = filters;
      return findings
        .filter((f) => {
          if (category && f.source !== category) return false;
          if (competitor && !matchesCompetitor(f, competitor)) return false;
          if (topicItems && !topicItems.has(f.id)) return false;
          return true;
        })
        .sort((a, b) => (b.relevance || 0) - (a.relevance || 0));
    },
    [filters, findings, topicItems],
  );

  const topicLabel = useCallback(
    (key) => topics.find((t) => t.key === key)?.label || "",
    [topics],
  );

  /* ── filters ──────────────────────────────────────────── */
  const setFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  /** Topic chips toggle: clicking the active topic clears it. */
  const toggleTopic = useCallback((key) => {
    let cleared = false;
    setFilters((prev) => {
      cleared = prev.topic === key;
      return { ...prev, topic: cleared ? null : key };
    });
    return !cleared;
  }, []);

  const clearFilter = useCallback((key) => {
    setFilters((prev) => ({ ...prev, [key]: null }));
  }, []);

  /* ── saved / tracked (local only, clearly user-scoped) ── */
  const isSaved = useCallback((id) => saved.has(id), [saved]);

  const toggleSaved = useCallback((id) => {
    let nowSaved = false;
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      nowSaved = next.has(id);
      persistSet("ip.saved", next);
      return next;
    });
    return nowSaved;
  }, []);

  const isTracked = useCallback((term) => tracked.has(term), [tracked]);

  const addTracked = useCallback((term) => {
    setTracked((prev) => {
      if (prev.has(term)) return prev;
      const next = new Set(prev);
      next.add(term);
      persistSet("ip.tracked", next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      run,
      previousRun,
      tools,
      report,
      filters,
      chartWindow,
      saved,
      tracked,
      hasRun: Boolean(run),
      setRun,
      setTools,
      setReport,
      setChartWindow,
      setFilter,
      toggleTopic,
      clearFilter,
      // derived
      kpis,
      topics,
      landscape,
      sources,
      competitors,
      contributors,
      connections,
      counts,
      trend,
      activity,
      findings,
      insights,
      // lookups
      findingById,
      insightForFinding,
      relatedTo,
      visibleInsights,
      visibleFindings,
      topicLabel,
      // local prefs
      isSaved,
      toggleSaved,
      isTracked,
      addTracked,
    }),
    [
      run,
      previousRun,
      tools,
      report,
      filters,
      chartWindow,
      saved,
      tracked,
      setRun,
      setFilter,
      toggleTopic,
      clearFilter,
      kpis,
      topics,
      landscape,
      sources,
      competitors,
      contributors,
      connections,
      counts,
      trend,
      activity,
      findings,
      insights,
      findingById,
      insightForFinding,
      relatedTo,
      visibleInsights,
      visibleFindings,
      topicLabel,
      isSaved,
      toggleSaved,
      isTracked,
      addTracked,
    ],
  );

  return <RunContext.Provider value={value}>{children}</RunContext.Provider>;
}

function matchesCompetitor(f, name) {
  const needle = name.toLowerCase();
  if ((f.competitor || "").toLowerCase() === needle) return true;
  return `${f.title} ${f.summary}`.toLowerCase().includes(needle);
}

export function useRun() {
  const ctx = useContext(RunContext);
  if (!ctx) throw new Error("useRun must be used inside <RunProvider>");
  return ctx;
}
