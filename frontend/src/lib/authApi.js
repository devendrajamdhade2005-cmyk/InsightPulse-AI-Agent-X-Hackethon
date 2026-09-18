/* Auth + account client.
 *
 * Every call goes through `authFetch`, which attaches the bearer token and
 * transparently refreshes it once on a 401. Refreshing in one place means no screen
 * has to think about token expiry — a session that has been open overnight simply
 * keeps working.
 */

import { apiUrl } from "./config.js";

const ACCESS_KEY = "ip.access_token";
const REFRESH_KEY = "ip.refresh_token";

export const tokenStore = {
  get access() {
    try {
      return localStorage.getItem(ACCESS_KEY) || "";
    } catch {
      return "";
    }
  },
  get refresh() {
    try {
      return localStorage.getItem(REFRESH_KEY) || "";
    } catch {
      return "";
    }
  },
  save(session) {
    try {
      if (session?.access_token) localStorage.setItem(ACCESS_KEY, session.access_token);
      if (session?.refresh_token)
        localStorage.setItem(REFRESH_KEY, session.refresh_token);
    } catch {
      /* private mode — the session lives in memory for this tab only */
    }
  },
  clear() {
    try {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
    } catch {
      /* nothing to clear */
    }
  },
};

async function readError(res) {
  try {
    const body = await res.json();
    const detail = body.detail;
    if (Array.isArray(detail)) {
      // FastAPI validation errors arrive as a list of field problems.
      return detail.map((d) => d.msg || "invalid value").join("; ");
    }
    return detail || body.message || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

async function request(path, { method = "GET", body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(apiUrl(path), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const err = new Error(await readError(res));
    err.status = res.status;
    throw err;
  }
  // 204s and empty bodies are valid responses for the delete endpoints.
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

let refreshInFlight = null;

/** Exchange the refresh token for a new session. Concurrent callers share one call. */
async function refreshSession() {
  const refresh = tokenStore.refresh;
  if (!refresh) throw new Error("No refresh token.");
  if (!refreshInFlight) {
    refreshInFlight = request("/api/auth/refresh", {
      method: "POST",
      body: { refresh_token: refresh },
    })
      .then((session) => {
        tokenStore.save(session);
        return session;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

/**
 * Authenticated request with one automatic retry after a token refresh.
 *
 * Only a 401 triggers the retry. A 403 means the token was valid but the action was
 * refused, so refreshing would be pointless and would mask the real reason.
 */
export async function authFetch(path, options = {}) {
  try {
    return await request(path, { ...options, token: tokenStore.access });
  } catch (err) {
    if (err.status !== 401) throw err;
    try {
      const session = await refreshSession();
      return await request(path, { ...options, token: session.access_token });
    } catch {
      tokenStore.clear();
      const expired = new Error("Your session expired. Please sign in again.");
      expired.status = 401;
      throw expired;
    }
  }
}

/* ── auth ────────────────────────────────────────────────── */
export const getAuthConfig = () => request("/api/auth/config");

export const register = (email, password, displayName = "") =>
  request("/api/auth/register", {
    method: "POST",
    body: { email, password, display_name: displayName },
  });

export const login = (email, password) =>
  request("/api/auth/login", { method: "POST", body: { email, password } });

export const requestPasswordReset = (email) =>
  request("/api/auth/password/reset", { method: "POST", body: { email } });

export const changePassword = (currentPassword, newPassword) =>
  authFetch("/api/auth/password/change", {
    method: "POST",
    body: { current_password: currentPassword, new_password: newPassword },
  });

export const logout = () => authFetch("/api/auth/logout", { method: "POST" });

/* ── account ─────────────────────────────────────────────── */
export const getMe = () => authFetch("/api/me");

export const updateProfile = (patch) =>
  authFetch("/api/me/profile", { method: "PATCH", body: patch });

export const toggleSavedFinding = (findingId) =>
  authFetch(`/api/me/saved/${encodeURIComponent(findingId)}`, { method: "POST" });

export const addTrackedTerm = (term) =>
  authFetch("/api/me/tracked", { method: "POST", body: { term } });

export const removeTrackedTerm = (term) =>
  authFetch(`/api/me/tracked/${encodeURIComponent(term)}`, { method: "DELETE" });

/* ── history ─────────────────────────────────────────────── */
export const listHistory = (limit = 50) => authFetch(`/api/history?limit=${limit}`);

export const saveHistory = (result) =>
  authFetch("/api/history", { method: "POST", body: { result } });

export const getHistoryEntry = (entryId) =>
  authFetch(`/api/history/${encodeURIComponent(entryId)}`);

export const deleteHistoryEntry = (entryId) =>
  authFetch(`/api/history/${encodeURIComponent(entryId)}`, { method: "DELETE" });
