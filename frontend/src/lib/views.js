/* The ten dashboard sections.
 *
 * Declared once. The nav, the section headings and the router all derive from this
 * list, so they cannot drift apart. Icons are resolved by key from
 * `components/icons`, which keeps this file free of presentation concerns.
 *
 * `group` drives the sidebar's headings. `selfDriving` marks sections that run
 * their own work and are therefore usable before any scan has happened.
 */

export const VIEWS = [
  {
    key: "overview",
    label: "Overview",
    group: "Intelligence",
    title: "Intelligence Overview",
    sub: "Everything this scan found, summarised and cross-referenced",
    accent: "blue",
  },
  {
    key: "insights",
    label: "Insights",
    group: "Intelligence",
    title: "Prioritized Insights",
    sub: "Everything the agent judged worth your attention",
    accent: "pink",
  },
  {
    key: "research",
    label: "Research",
    group: "Evidence",
    title: "Research Intelligence",
    sub: "Peer-reviewed papers and preprints, scored against your goal",
    accent: "blue",
  },
  {
    key: "patents",
    label: "Patents",
    group: "Evidence",
    title: "Patent Intelligence",
    sub: "Filings and grants, with competitor-owned IP flagged",
    accent: "cyan",
  },
  {
    key: "competitors",
    label: "Competitors",
    group: "Evidence",
    title: "Competitor Intelligence",
    sub: "Company-scoped activity across news, repos, forums and the live web",
    accent: "orange",
  },
  {
    key: "news",
    label: "News",
    group: "Evidence",
    title: "Industry News",
    sub: "Curated trade press and live open-web coverage",
    accent: "green",
  },
  {
    key: "framework",
    label: "Framework",
    group: "Agent internals",
    title: "Autonomous Agent Framework",
    sub: "LangGraph orchestration — run it live, or launch the adversarial test",
    accent: "purple",
    selfDriving: true,
  },
  {
    key: "evaluation",
    label: "Evaluation",
    group: "Agent internals",
    title: "Evaluation",
    sub: "Measured quality of the agent — automated metrics, human review and baseline comparison",
    accent: "cyan",
    selfDriving: true,
  },
  {
    key: "observability",
    label: "Observability",
    group: "Agent internals",
    title: "Observability",
    sub: "End-to-end traces, root-cause diagnosis, and the verified self-improvement loop",
    accent: "purple",
    selfDriving: true,
  },
  {
    key: "reports",
    label: "Reports",
    group: "Deliverables",
    title: "Reports",
    sub: "Export this scan as a professional intelligence document",
    accent: "yellow",
  },
];

export const VIEW_KEYS = VIEWS.map((v) => v.key);

export const VIEW_GROUPS = VIEWS.reduce((acc, v) => {
  const bucket = acc.find((g) => g.name === v.group);
  if (bucket) bucket.views.push(v);
  else acc.push({ name: v.group, views: [v] });
  return acc;
}, []);

export const viewByKey = (key) => VIEWS.find((v) => v.key === key) || VIEWS[0];

export const isSelfDriving = (key) => Boolean(viewByKey(key).selfDriving);
