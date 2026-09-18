import { forwardRef } from "react";
import { Button, Panel, Reveal, Select, TextInput, Textarea } from "../ui/Primitives.jsx";
import { ChipInput } from "./ChipInput.jsx";

/* The tracking-goal form.
 *
 * Presets, chip fields, advanced options and the run/stop pair are all ported
 * from the original markup. The goal textarea keeps its Cmd/Ctrl+Enter shortcut.
 */

const PRESETS = [
  {
    label: "AI Agents",
    goal: "Track important developments in AI agents and monitor OpenAI and Anthropic",
    keywords: ["AI agents", "multi-agent systems"],
    competitors: ["OpenAI", "Anthropic"],
  },
  {
    label: "Generative AI",
    goal: "Monitor generative AI patents and competitor IP activity",
    keywords: ["generative AI"],
    competitors: ["OpenAI", "Google"],
  },
  {
    label: "Voice AI",
    goal: "Track voice AI research and recent competitor announcements",
    keywords: ["voice AI", "speech synthesis"],
    competitors: ["OpenAI", "ElevenLabs"],
  },
  {
    label: "Cybersecurity",
    goal: "Monitor AI security research, vulnerabilities and industry response",
    keywords: ["LLM security", "prompt injection"],
    competitors: [],
  },
  {
    label: "Robotics",
    goal: "Track robotics research and embodied AI developments",
    keywords: ["robotics", "embodied AI"],
    competitors: ["Tesla", "Figure"],
  },
  {
    label: "Healthcare AI",
    goal: "Track healthcare AI research, patents and regulatory developments",
    keywords: ["healthcare AI", "medical imaging"],
    competitors: [],
  },
];

export const SearchPanel = forwardRef(function SearchPanel(
  {
    goal,
    setGoal,
    keywords,
    setKeywords,
    competitors,
    setCompetitors,
    maxIterations,
    setMaxIterations,
    mode,
    setMode,
    running,
    error,
    onRun,
    onStop,
    goalRef,
  },
  ref,
) {
  const submit = (e) => {
    e.preventDefault();
    onRun();
  };

  const applyPreset = (preset) => {
    setGoal(preset.goal);
    setKeywords(preset.keywords);
    setCompetitors(preset.competitors);
    goalRef?.current?.focus();
  };

  return (
    <Panel ref={ref} className="relative overflow-hidden p-0">
      {/* accent rail — the brutalist stripe across the top of the primary surface */}
      <div className="flex h-2.5 w-full">
        <span className="flex-1 bg-brand-blue" />
        <span className="flex-1 bg-brand-purple" />
        <span className="flex-1 bg-brand-cyan" />
        <span className="flex-1 bg-pop-yellow" />
        <span className="flex-1 bg-brand-pink" />
      </div>

      <div className="p-4 sm:p-6">
        <h2 className="mb-4 text-xl font-bold uppercase tracking-tight sm:text-2xl">
          What would you like to track?
        </h2>

        <form onSubmit={submit} autoComplete="off">
          <label htmlFor="goal" className="sr-only">
            Tracking goal
          </label>
          <Textarea
            id="goal"
            ref={goalRef}
            rows={2}
            required
            maxLength={600}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                onRun();
              }
            }}
            placeholder="Track AI agents, generative AI patents, competitor announcements and emerging research."
            className="min-h-[4.5rem]"
          />

          {/* presets */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="nb-label">Quick presets</span>
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p)}
                className="nb-press border-2 border-line bg-surface px-2.5 py-1 text-[12px] font-bold uppercase tracking-wide hover:bg-pop-yellow hover:text-black"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* chips */}
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <ChipInput
              inputId="kw-input"
              label="Keywords"
              placeholder="Add keyword…"
              values={keywords}
              onChange={setKeywords}
            />
            <ChipInput
              inputId="comp-input"
              label="Competitors"
              placeholder="Add company…"
              values={competitors}
              onChange={setCompetitors}
            />
          </div>

          {/* advanced */}
          <Reveal summary="Advanced options" className="mt-5" bare>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="max-iter" className="nb-label mb-1.5 block">
                  Max reasoning steps
                </label>
                <TextInput
                  id="max-iter"
                  type="number"
                  min="1"
                  max="25"
                  value={maxIterations}
                  onChange={(e) => setMaxIterations(e.target.value)}
                />
                <p className="mt-1.5 text-[11.5px] text-ink-4">
                  Safety limit on the agent&apos;s loop.
                </p>
              </div>
              <div>
                <label htmlFor="mode" className="nb-label mb-1.5 block">
                  Data mode
                </label>
                <Select
                  id="mode"
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                >
                  <option value="live">Live sources</option>
                  <option value="sim">Demo data (offline, instant)</option>
                </Select>
                <p className="mt-1.5 text-[11.5px] text-ink-4">
                  Live queries real APIs. Demo runs fully offline with labelled
                  data.
                </p>
              </div>
            </div>
          </Reveal>

          {/* actions */}
          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
            <Button
              type="submit"
              size="lg"
              disabled={running}
              className="flex-1"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="h-4 w-4"
              >
                <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5 10.1 12 4.5 10l5.6-1.5z" />
              </svg>
              {running ? "Agent Working…" : "Run Intelligence Scan"}
            </Button>
            {running ? (
              <Button variant="danger" size="lg" onClick={onStop}>
                Stop Agent
              </Button>
            ) : null}
          </div>

          {error ? (
            <p
              role="alert"
              className="mt-3 border-2 border-brand-red bg-brand-red-bg px-3 py-2 text-[13px] font-semibold text-brand-red"
            >
              {error}
            </p>
          ) : null}
        </form>
      </div>
    </Panel>
  );
});
