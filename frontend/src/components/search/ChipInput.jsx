import { useRef, useState } from "react";
import { cx } from "../../lib/accents.js";

/* Comma/Enter chip entry for keywords and competitors.
 *
 * Behaviour ported from the original `chipField()`:
 *   · Enter or comma commits the current text
 *   · one entry may be pasted as a comma-separated list and is split
 *   · Backspace on an empty input removes the last chip
 *   · blur commits any leftover text, so a typed value is never silently lost
 *   · duplicates are rejected case-insensitively
 *   · hard caps: 10 entries, 120 characters each
 *
 * Controlled by the parent so presets can replace the whole set in one go.
 */

const MAX_ENTRIES = 10;
const MAX_LENGTH = 120;

export function ChipInput({
  label,
  optional = true,
  placeholder,
  values,
  onChange,
  inputId,
}) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);

  const commit = (raw) => {
    const additions = String(raw)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!additions.length) {
      setDraft("");
      return;
    }
    const next = [...values];
    for (const entry of additions) {
      if (next.length >= MAX_ENTRIES) break;
      if (next.some((x) => x.toLowerCase() === entry.toLowerCase())) continue;
      next.push(entry.slice(0, MAX_LENGTH));
    }
    onChange(next);
    setDraft("");
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
    } else if (e.key === "Backspace" && !draft && values.length) {
      onChange(values.slice(0, -1));
    }
  };

  const removeAt = (i) => onChange(values.filter((_, idx) => idx !== i));

  const atCapacity = values.length >= MAX_ENTRIES;

  return (
    <div className="min-w-0">
      <label htmlFor={inputId} className="nb-label mb-1.5 block">
        {label}
        {optional ? (
          <span className="ml-1 font-normal normal-case tracking-normal text-ink-4">
            optional
          </span>
        ) : null}
      </label>

      <div
        onClick={(e) => {
          if (e.target === e.currentTarget) inputRef.current?.focus();
        }}
        className={cx(
          "flex min-h-[3rem] flex-wrap items-center gap-1.5 border-2 border-line bg-surface px-2 py-2",
          "shadow-[var(--shadow-nb-xs)] focus-within:shadow-[var(--shadow-nb)]",
        )}
      >
        {values.map((v, i) => (
          <span
            key={`${v}-${i}`}
            className="inline-flex items-center gap-1 border-2 border-line bg-brand-blue-bg px-1.5 py-0.5 text-[12px] font-semibold text-brand-blue"
          >
            {v}
            <button
              type="button"
              onClick={() => removeAt(i)}
              aria-label={`Remove ${v}`}
              className="px-0.5 text-[14px] leading-none opacity-70 hover:opacity-100"
            >
              ×
            </button>
          </span>
        ))}

        <input
          id={inputId}
          ref={inputRef}
          type="text"
          value={draft}
          disabled={atCapacity}
          placeholder={atCapacity ? `Limit ${MAX_ENTRIES} reached` : placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => draft.trim() && commit(draft)}
          className="min-w-[8rem] flex-1 border-none bg-transparent px-1 py-0.5 text-[13.5px] outline-none disabled:cursor-not-allowed"
        />
      </div>
    </div>
  );
}
