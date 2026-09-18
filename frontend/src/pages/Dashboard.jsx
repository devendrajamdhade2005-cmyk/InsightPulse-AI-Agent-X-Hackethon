import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import * as api from "../lib/api.js";
import * as authApi from "../lib/authApi.js";
import { VIEW_KEYS, viewByKey } from "../lib/views.js";
import { useAgentRun } from "../hooks/useAgentRun.js";
import { useRun } from "../state/RunProvider.jsx";
import { useAuth } from "../state/AuthProvider.jsx";

import { Sidebar } from "../components/layout/Sidebar.jsx";
import { Topbar } from "../components/layout/Topbar.jsx";
import { SystemInfoDrawer } from "../components/layout/SystemInfoDrawer.jsx";
import { SearchPanel } from "../components/search/SearchPanel.jsx";
import { LiveRun } from "../components/live/LiveRun.jsx";
import { KpiGrid } from "../components/dashboard/KpiGrid.jsx";
import { ExecutiveSummary, HeroInsight } from "../components/dashboard/Summary.jsx";
import { AgentTrail } from "../components/dashboard/AgentTrail.jsx";
import { MultiAgent } from "../components/dashboard/MultiAgent.jsx";
import { Memory } from "../components/dashboard/Memory.jsx";
import { DetailDrawer } from "../components/feed/DetailDrawer.jsx";
import { OverviewView } from "../components/views/OverviewView.jsx";
import {
  CompetitorsView,
  FeedView,
  InsightsView,
  NewsView,
} from "../components/views/FeedViews.jsx";
import { ReportsView } from "../components/views/ReportsView.jsx";
import { FrameworkView } from "../components/views/FrameworkView.jsx";
import { EvaluationView } from "../components/views/EvaluationView.jsx";
import { ObservabilityView } from "../components/views/ObservabilityView.jsx";
import { ViewHead } from "../components/ui/Primitives.jsx";

/* The signed-in workspace.
 *
 * Section is carried in the URL (`/app/:section`) so a view is linkable and the
 * browser back button behaves. The run itself stays in memory — switching sections
 * is a client-side projection over one result and never refetches.
 */

export default function Dashboard() {
  const navigate = useNavigate();
  const { section } = useParams();
  const view = VIEW_KEYS.includes(section) ? section : "overview";

  const { setTools, tools, hasRun, run, counts, trend, insights, findings, kpis, setFilter } =
    useRun();
  const { profile } = useAuth();

  const [systemOpen, setSystemOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [toolsError, setToolsError] = useState("");
  const [drawerId, setDrawerId] = useState(null);
  const [savedNote, setSavedNote] = useState("");

  const searchRef = useRef(null);
  const goalRef = useRef(null);
  const contentRef = useRef(null);

  // form state
  const [goal, setGoal] = useState("");
  const [keywords, setKeywords] = useState([]);
  const [competitors, setCompetitors] = useState([]);
  const [maxIterations, setMaxIterations] = useState(10);
  const [mode, setMode] = useState("live");

  /* A completed scan is persisted against the account, so it survives a refresh
     and shows up in history. A failure here must not disturb the run the user just
     paid for, so it only sets a note. */
  const persistRun = useCallback(async (result) => {
    try {
      await authApi.saveHistory(result);
      setSavedNote("Scan saved to your history.");
    } catch (err) {
      setSavedNote(`Scan complete, but it could not be saved: ${err.message}`);
    }
  }, []);

  const agent = useAgentRun({
    onFinished: (result) => {
      navigate("/app/overview");
      persistRun(result);
      requestAnimationFrame(() =>
        contentRef.current?.scrollTo({ top: 0, behavior: "smooth" }),
      );
    },
  });

  // Seed the form from the saved profile defaults, once.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !profile) return;
    seeded.current = true;
    if (profile.default_goal) setGoal(profile.default_goal);
    if (profile.default_keywords?.length) setKeywords(profile.default_keywords);
    if (profile.default_competitors?.length)
      setCompetitors(profile.default_competitors);
  }, [profile]);

  useEffect(() => {
    let cancelled = false;
    api
      .getTools()
      .then((t) => {
        if (cancelled) return;
        setTools(t);
        agent.setStatus("ready", "Agent Ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setToolsError(err.message);
        agent.setStatus("error", "Backend offline");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = useCallback(
    (next) => {
      navigate(`/app/${VIEW_KEYS.includes(next) ? next : "overview"}`);
      requestAnimationFrame(() =>
        contentRef.current?.scrollTo({ top: 0, behavior: "smooth" }),
      );
    },
    [navigate],
  );

  const scrollToSearch = useCallback(() => {
    searchRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    goalRef.current?.focus();
  }, []);

  const openEvidence = useCallback((id) => setDrawerId(id), []);

  // Applying a filter must show its effect, so jump to the feed it filters.
  const selectTopic = useCallback(
    (key) => {
      setFilter("topic", key);
      go("insights");
    },
    [setFilter, go],
  );

  const viewCompetitorSignals = useCallback(
    (name) => {
      setFilter("competitor", name);
      go("insights");
    },
    [setFilter, go],
  );

  const meta = viewByKey(view);

  const renderView = () => {
    const shared = { onOpenEvidence: openEvidence, onScrollToSearch: scrollToSearch };
    switch (view) {
      case "overview":
        return <OverviewView {...shared} onSelectTopic={selectTopic} />;
      case "research":
        return <FeedView category="research" {...shared} />;
      case "patents":
        return <FeedView category="patent" {...shared} />;
      case "news":
        return <NewsView {...shared} />;
      case "competitors":
        return (
          <CompetitorsView
            onViewSignals={viewCompetitorSignals}
            onScrollToSearch={scrollToSearch}
          />
        );
      case "insights":
        return <InsightsView {...shared} />;
      case "framework":
        return <FrameworkView />;
      case "evaluation":
        return <EvaluationView />;
      case "observability":
        return <ObservabilityView />;
      case "reports":
        return <ReportsView onScrollToSearch={scrollToSearch} />;
      default:
        return null;
    }
  };

  return (
    <div data-surface="glass" className="flex min-h-screen">
      <Sidebar
        view={view}
        onSelect={go}
        onOpenSystem={() => setSystemOpen(true)}
        mobileOpen={navOpen}
        onCloseMobile={() => setNavOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          title={meta.title}
          sub={meta.sub}
          agentState={agent.agentState}
          agentText={agent.agentText}
          onOpenNav={() => setNavOpen(true)}
        />

        <main
          ref={contentRef}
          className="min-h-0 flex-1 overflow-y-auto px-3 py-5 sm:px-5 lg:px-6"
        >
          <div className="mx-auto flex w-full max-w-[100rem] flex-col gap-4">
            <SearchPanel
              ref={searchRef}
              goalRef={goalRef}
              goal={goal}
              setGoal={setGoal}
              keywords={keywords}
              setKeywords={setKeywords}
              competitors={competitors}
              setCompetitors={setCompetitors}
              maxIterations={maxIterations}
              setMaxIterations={setMaxIterations}
              mode={mode}
              setMode={setMode}
              running={agent.running}
              error={agent.error}
              onRun={() =>
                agent.start({ goal, keywords, competitors, maxIterations, mode })
              }
              onStop={agent.stop}
            />

            {agent.running ? (
              <LiveRun
                activeStep={agent.activeStep}
                searchLabel={agent.searchLabel}
                message={agent.message}
                ticks={agent.ticks}
              />
            ) : null}

            {savedNote && !agent.running ? (
              <p className="border-2 border-line bg-brand-green-bg px-3 py-2 text-[12.5px] font-semibold text-brand-green">
                {savedNote}
              </p>
            ) : null}

            {hasRun ? (
              <>
                <KpiGrid items={kpis} />
                <ExecutiveSummary
                  counts={counts}
                  trend={trend}
                  nextStep={insights[0]?.recommended_action || ""}
                  findingCount={findings.length}
                  fullSummary={(run.summary || "").trim()}
                  simulated={run.metrics?.simulated_data_used}
                />
                <HeroInsight insight={insights[0]} onOpenEvidence={openEvidence} />
                <AgentTrail
                  result={run}
                  multiAgent={<MultiAgent result={run} />}
                  memory={<Memory result={run} />}
                />
              </>
            ) : null}

            <section>
              <ViewHead title={meta.title} sub={meta.sub} accent={meta.accent} />
              {renderView()}
            </section>
          </div>
        </main>
      </div>

      <SystemInfoDrawer
        open={systemOpen}
        onClose={() => setSystemOpen(false)}
        tools={tools}
        error={toolsError}
      />

      {drawerId ? (
        <DetailDrawer
          findingId={drawerId}
          onClose={() => setDrawerId(null)}
          onOpenOther={setDrawerId}
        />
      ) : null}
    </div>
  );
}
