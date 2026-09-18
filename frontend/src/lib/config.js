/* Single source of truth for where the backend lives.
 *
 * Resolution order (first match wins):
 *   1. window.__API_BASE__     runtime override from the browser console
 *   2. VITE_API_BASE           build-time env (Vercel project setting)
 *   3. ""                      same-origin
 *
 * Local development resolves to case 3: `npm run dev` proxies /api and /health
 * to the FastAPI server (see vite.config.js), so same-origin works with no
 * configuration and no CORS.
 *
 * On Vercel the frontend and backend are different origins, so VITE_API_BASE
 * must be set. The backend URL is public, not a secret — no provider API key is
 * ever placed in frontend code.
 */

const trim = (value) => String(value || "").replace(/\/+$/, "");

function resolveApiBase() {
  if (typeof window !== "undefined" && window.__API_BASE__) {
    return trim(window.__API_BASE__);
  }
  const fromEnv = import.meta.env?.VITE_API_BASE;
  if (fromEnv) return trim(fromEnv);
  return "";
}

/** Configured backend origin. "" means same-origin. */
export const API_BASE = resolveApiBase();

/** Join the configured base with an absolute API path like "/api/…" or "/health". */
export function apiUrl(path) {
  return `${API_BASE}${path}`;
}

/** Shown in the system-info panel so the active target is never a mystery. */
export const API_TARGET_LABEL = API_BASE || "same-origin (dev proxy)";
