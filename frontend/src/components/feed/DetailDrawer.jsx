import { accentClass, cx } from "../../lib/accents.js";
import {
  categoryLabel,
  formatDate,
  providerLabel,
  relevanceBand,
  truncate,
} from "../../lib/format.js";
import { Star, categoryIconFor } from "../icons/index.jsx";
import { Drawer } from "../ui/Overlay.jsx";
import {
  CategoryTag,
  PriorityBadge,
  RelevanceBadge,
  SignalTags,
  SimTag,
} from "../intelligence/Atoms.jsx";
import { Button, MiniLabel, Tag, TagRow } from "../ui/Primitives.jsx";
import { useRun } from "../../state/RunProvider.jsx";

/* Evidence drawer. Opens over the current view so the user never loses their place. */

function Section({ accent, label, children }) {
  return (
    <section
      className={cx(
        accent ? accentClass(accent) : "",
        accent ? "nb-a-bg" : "bg-bg-2",
        "mb-3 border-2 border-line p-3",
      )}
    >
      {label ? <MiniLabel>{label}</MiniLabel> : null}
      {children}
    </section>
  );
}

export function DetailDrawer({ findingId, onClose, onOpenOther }) {
  const {
    findingById,
    insightForFinding,
    relatedTo,
    isSaved,
    toggleSaved,
    addTracked,
  } = useRun();

  const finding = findingId ? findingById(findingId) : null;
  if (!finding) return null;

  const insight = insightForFinding(findingId);
  const related = relatedTo(finding);
  const meta = finding.meta || {};
  const band = relevanceBand(finding.relevance);

  const facts = [
    [
      "Relevance",
      finding.relevance != null
        ? `${Math.round(finding.relevance * 100)}% (${band.label})`
        : null,
    ],
    ["Category", categoryLabel(finding.source)],
    ["Published", finding.published_date ? formatDate(finding.published_date) : null],
    ["Provider", providerLabel(finding.provider)],
    ["Source quality", finding.credibility],
    ["Citations", meta.citation_count || null],
    ["Venue", meta.venue || null],
    ["Institution", (meta.institutions || [])[0] || meta.institution || null],
    ["Assignee", meta.assignee || null],
    ["Patent number", meta.patent_number || null],
    ["Filed", meta.filing_date ? formatDate(meta.filing_date) : null],
    ["Technology class", meta.cpc || null],
    ["Language", meta.language || null],
    ["Stars", meta.stars || null],
    ["Outlet", meta.outlet || null],
    ["Search rank", meta.tavily_score || null],
  ].filter(([, v]) => v !== null && v !== undefined && v !== "");

  const techTags = [...(meta.concepts || []), ...(meta.categories || [])].slice(0, 8);

  const onTrack = () => {
    const term =
      finding.competitor ||
      (finding.title || "").split(" ").slice(0, 3).join(" ");
    if (term) addTracked(term);
  };

  return (
    <Drawer open onClose={onClose} title="Evidence">
      <TagRow className="mb-3">
        {insight ? (
          <PriorityBadge priority={insight.priority} />
        ) : (
          <RelevanceBadge score={finding.relevance} />
        )}
        <CategoryTag category={finding.source} />
        {finding.competitor ? <Tag accent="orange">{finding.competitor}</Tag> : null}
        <SignalTags signals={finding.signals} />
        <SimTag on={finding.simulated} />
      </TagRow>

      <h2 className="mb-1.5 text-lg font-bold leading-snug">{finding.title}</h2>
      {finding.author ? (
        <p className="mb-4 text-[12.5px] text-ink-4">
          {truncate(finding.author, 220)}
        </p>
      ) : null}

      {finding.summary ? (
        <Section label="Abstract / excerpt">
          <p className="text-[13px] text-ink-2">{finding.summary}</p>
        </Section>
      ) : null}

      {insight ? (
        <>
          <Section accent="purple" label="AI summary">
            <p className="text-[13px] text-ink-2">
              {insight.summary || insight.what_happened}
            </p>
          </Section>
          <Section accent="pink" label="Why it matters">
            <p className="text-[13px] text-ink-2">{insight.why_it_matters}</p>
          </Section>
          <Section accent="cyan" label="Recommended action">
            <p className="text-[13px] text-ink-2">{insight.recommended_action}</p>
          </Section>
          <p className="mb-4 text-[11.5px] text-ink-4">
            Analysis written by {insight.author || "the agent"}.
          </p>
        </>
      ) : (
        <Section>
          <p className="text-[12.5px] text-ink-3">
            This finding was collected and scored but did not make the prioritized
            briefing, so it has no written analysis.
          </p>
        </Section>
      )}

      {techTags.length ? (
        <Section label="Related technologies">
          <TagRow>
            {techTags.map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
          </TagRow>
        </Section>
      ) : null}

      <Section label="Evidence & metadata">
        <dl className="grid grid-cols-2 gap-2.5">
          {facts.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="nb-label text-[9.5px]">{k}</dt>
              <dd className="mt-0.5 break-words text-[12.5px] text-ink-2">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {related.length ? (
        <Section label={`Related signals (${related.length})`}>
          <ul className="grid gap-1.5">
            {related.map((r) => {
              const RelIcon = categoryIconFor(r.source);
              return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onOpenOther(r.id)}
                  className="nb-press flex w-full items-start gap-2.5 border-2 border-line bg-surface p-2.5 text-left"
                >
                  <RelIcon
                    aria-hidden="true"
                    className="mt-0.5 h-4 w-4 shrink-0 text-ink-3"
                    strokeWidth={2.3}
                  />
                  <span className="min-w-0">
                    <b className="block text-[12.5px] font-semibold">
                      {truncate(r.title, 78)}
                    </b>
                    <em className="block not-italic text-[11px] text-ink-4">
                      {categoryLabel(r.source)} · {providerLabel(r.provider)}
                    </em>
                  </span>
                </button>
              </li>
              );
            })}
          </ul>
        </Section>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2 border-t-2 border-line pt-4">
        {finding.url ? (
          <Button
            as="a"
            size="sm"
            href={finding.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open original ↗
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={() => toggleSaved(finding.id)}>
          <Star
            aria-hidden="true"
            className="h-3.5 w-3.5"
            strokeWidth={2.4}
            fill={isSaved(finding.id) ? "currentColor" : "none"}
          />
          {isSaved(finding.id) ? "Saved" : "Save"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onTrack}>
          + Add to tracking
        </Button>
      </div>
    </Drawer>
  );
}
