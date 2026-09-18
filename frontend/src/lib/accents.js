/* Accent / tone name → CSS class.
 *
 * Accent and tone names arrive from two places: our own format.js maps, and the
 * backend payload (`agent.accent`, span `accent`, …). Because the backend set
 * cannot be enumerated from the frontend, an unknown name must degrade to slate
 * rather than render with no colour variables at all — that would leave
 * `var(--a)` unset and the element would silently lose its accent.
 */

const KNOWN = new Set([
  "blue",
  "purple",
  "cyan",
  "orange",
  "pink",
  "yellow",
  "amber",
  "green",
  "red",
  "slate",
]);

/** `accentClass("blue")` → "nb-accent-blue"; unknown → "nb-accent-slate". */
export function accentClass(name) {
  const key = String(name || "").toLowerCase();
  return KNOWN.has(key) ? `nb-accent-${key}` : "nb-accent-slate";
}

/** Tones use the same palette; kept as a separate name for readability. */
export const toneClass = accentClass;

/** Joins truthy class names. Tiny local helper so we avoid a clsx dependency. */
export function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}
