import { CATEGORY, categoryLabel } from "../../lib/format.js";
import { Pill } from "../ui/Primitives.jsx";
import { useRun } from "../../state/RunProvider.jsx";

/* Active-filter chips + the priority/source pill rows. */

function ActiveChip({ label, value, onClear }) {
  return (
    <span className="inline-flex items-center gap-1.5 border-2 border-line bg-brand-purple-bg px-2 py-1 text-[12px] text-brand-purple">
      {label}: <b className="font-bold">{value}</b>
      <button
        type="button"
        onClick={onClear}
        aria-label={`Clear ${label} filter`}
        className="px-0.5 text-[14px] leading-none opacity-70 hover:opacity-100"
      >
        ×
      </button>
    </span>
  );
}

/** Topic/competitor chips. Shown on every feed so an active filter is never invisible. */
export function ActiveFilters() {
  const { filters, topicLabel, clearFilter } = useRun();
  const chips = [];
  if (filters.topic) {
    chips.push(
      <ActiveChip
        key="topic"
        label="Topic"
        value={topicLabel(filters.topic)}
        onClear={() => clearFilter("topic")}
      />,
    );
  }
  if (filters.competitor) {
    chips.push(
      <ActiveChip
        key="competitor"
        label="Company"
        value={filters.competitor}
        onClear={() => clearFilter("competitor")}
      />,
    );
  }
  if (!chips.length) return null;
  return <div className="mb-4 flex flex-wrap gap-2">{chips}</div>;
}

/** Priority + source rows, used by the Insights view. */
export function InsightFilters() {
  const { filters, setFilter } = useRun();

  const priorities = [
    ["all", "All"],
    ["HIGH", "High"],
    ["MEDIUM", "Medium"],
    ["LOW", "Low"],
  ];
  const sources = [
    ["all", "All sources"],
    ...Object.keys(CATEGORY).map((k) => [k, categoryLabel(k)]),
  ];

  return (
    <div className="mb-4 flex flex-col gap-2.5">
      <div
        role="group"
        aria-label="Filter by priority"
        className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {priorities.map(([v, l]) => (
          <Pill
            key={v}
            active={filters.priority === v}
            onClick={() => setFilter("priority", v)}
          >
            {l}
          </Pill>
        ))}
      </div>
      <div
        role="group"
        aria-label="Filter by source"
        className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {sources.map(([v, l]) => (
          <Pill
            key={v}
            active={filters.source === v}
            onClick={() => setFilter("source", v)}
          >
            {l}
          </Pill>
        ))}
      </div>
      <ActiveFilters />
    </div>
  );
}
