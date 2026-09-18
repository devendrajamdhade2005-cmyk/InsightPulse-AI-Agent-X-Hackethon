import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cx } from "../lib/accents.js";
import * as authApi from "../lib/authApi.js";
import { fmtNum } from "../lib/format.js";
import { useAuth } from "../state/AuthProvider.jsx";
import { useRun } from "../state/RunProvider.jsx";
import { Sidebar } from "../components/layout/Sidebar.jsx";
import { Topbar } from "../components/layout/Topbar.jsx";
import { ChipInput } from "../components/search/ChipInput.jsx";
import {
  Button,
  EmptyState,
  Field,
  Note,
  Panel,
  PanelHead,
  Select,
  Spinner,
  TextInput,
  Textarea,
} from "../components/ui/Primitives.jsx";
import { SimTag } from "../components/intelligence/Atoms.jsx";
import { Clock, Trash2, User } from "../components/icons/index.jsx";

/* Profile and scan history.
 *
 * Both live inside the workspace chrome so the rail stays available. They share
 * this file because they are two views of the same thing — the account.
 */

function Shell({ title, sub, children }) {
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div data-surface="glass" className="flex min-h-screen">
      <Sidebar
        view=""
        onSelect={(k) => navigate(`/app/${k}`)}
        onOpenSystem={() => navigate("/app/overview")}
        mobileOpen={navOpen}
        onCloseMobile={() => setNavOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          title={title}
          sub={sub}
          agentState="idle"
          agentText="Account"
          onOpenNav={() => setNavOpen(true)}
        />
        <main className="min-h-0 flex-1 overflow-y-auto px-3 py-5 sm:px-5 lg:px-6">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">{children}</div>
        </main>
      </div>
    </div>
  );
}

/* ── profile ─────────────────────────────────────────────── */
export function Profile() {
  const { user, profile, saveProfile, tracked, removeTracked } = useAuth();

  const [form, setForm] = useState({
    display_name: "",
    organisation: "",
    role: "",
    default_goal: "",
    theme: "system",
  });
  const [keywords, setKeywords] = useState([]);
  const [competitors, setCompetitors] = useState([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  // Password change
  const [pw, setPw] = useState({ current: "", next: "" });
  const [pwStatus, setPwStatus] = useState("");

  useEffect(() => {
    if (!profile) return;
    setForm({
      display_name: profile.display_name || "",
      organisation: profile.organisation || "",
      role: profile.role || "",
      default_goal: profile.default_goal || "",
      theme: profile.theme || "system",
    });
    setKeywords(profile.default_keywords || []);
    setCompetitors(profile.default_competitors || []);
  }, [profile]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setStatus("");
    try {
      await saveProfile({
        ...form,
        default_keywords: keywords,
        default_competitors: competitors,
      });
      setStatus("Profile saved.");
    } catch (err) {
      setStatus(`Could not save: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    setPwStatus("");
    try {
      await authApi.changePassword(pw.current, pw.next);
      setPw({ current: "", next: "" });
      setPwStatus("Password updated.");
    } catch (err) {
      setPwStatus(err.message);
    }
  };

  return (
    <Shell title="Profile" sub="Your account and default scan settings">
      <Panel>
        <PanelHead
          eyebrow="Account"
          title="Who you are"
          sub="Shown in the workspace and attached to the scans you save."
        />
        <div className="mb-4 flex items-center gap-3 border-2 border-line bg-bg-2 p-3">
          <span
            aria-hidden="true"
            className="grid h-11 w-11 shrink-0 place-items-center border-2 border-line bg-brand-purple text-white"
          >
            <User className="h-5 w-5" strokeWidth={2.3} />
          </span>
          <div className="min-w-0">
            <b className="block truncate text-[14px] font-bold">
              {profile?.display_name || user?.display_name || "Analyst"}
            </b>
            <span className="block truncate font-mono text-[11.5px] text-ink-3">
              {user?.email}
            </span>
          </div>
        </div>

        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Display name">
              <TextInput
                value={form.display_name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, display_name: e.target.value }))
                }
              />
            </Field>
            <Field label="Organisation">
              <TextInput
                value={form.organisation}
                onChange={(e) =>
                  setForm((p) => ({ ...p, organisation: e.target.value }))
                }
              />
            </Field>
            <Field label="Role">
              <TextInput
                value={form.role}
                onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
              />
            </Field>
            <Field label="Preferred theme">
              <Select
                value={form.theme}
                onChange={(e) => setForm((p) => ({ ...p, theme: e.target.value }))}
              >
                <option value="system">Match system</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </Select>
            </Field>
          </div>

          <Field
            label="Default tracking goal"
            hint="Pre-fills the scan form so you do not retype your brief."
          >
            <Textarea
              rows={2}
              maxLength={600}
              value={form.default_goal}
              onChange={(e) =>
                setForm((p) => ({ ...p, default_goal: e.target.value }))
              }
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <ChipInput
              inputId="p-kw"
              label="Default keywords"
              placeholder="Add keyword…"
              values={keywords}
              onChange={setKeywords}
            />
            <ChipInput
              inputId="p-comp"
              label="Default competitors"
              placeholder="Add company…"
              values={competitors}
              onChange={setCompetitors}
            />
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save profile"}
            </Button>
            {status ? (
              <span className="text-[12.5px] font-semibold text-brand-green">
                {status}
              </span>
            ) : null}
          </div>
        </form>
      </Panel>

      {tracked.length ? (
        <Panel>
          <PanelHead
            eyebrow="Tracking"
            title="Tracked terms"
            sub="Saved from evidence drawers. These follow your account across devices."
          />
          <div className="flex flex-wrap gap-2">
            {tracked.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-2 border-2 border-line bg-bg-2 px-2.5 py-1 text-[12.5px] font-semibold"
              >
                {t}
                <button
                  type="button"
                  onClick={() => removeTracked(t)}
                  aria-label={`Stop tracking ${t}`}
                  className="text-ink-4 hover:text-brand-red"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2.4} />
                </button>
              </span>
            ))}
          </div>
        </Panel>
      ) : null}

      <Panel>
        <PanelHead eyebrow="Security" title="Change password" />
        <form onSubmit={submitPassword} className="grid gap-4 sm:max-w-md">
          <Field label="Current password">
            <TextInput
              type="password"
              autoComplete="current-password"
              required
              value={pw.current}
              onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
            />
          </Field>
          <Field label="New password">
            <TextInput
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={pw.next}
              onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
            />
          </Field>
          <div className="flex items-center gap-3">
            <Button type="submit" variant="ghost">
              Update password
            </Button>
            {pwStatus ? (
              <span className="text-[12.5px] font-semibold">{pwStatus}</span>
            ) : null}
          </div>
        </form>
      </Panel>
    </Shell>
  );
}

/* ── history ─────────────────────────────────────────────── */
export function History() {
  const navigate = useNavigate();
  const { setRun } = useRun();
  const [entries, setEntries] = useState(null);
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await authApi.listHistory(100);
      setEntries(res.history || []);
    } catch (err) {
      setStatus(err.message);
      setEntries([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* Reopening a stored scan loads the saved payload rather than re-running the
     agent: a re-run costs API quota and would return different data, so it would
     not be the same scan the user is asking to see. */
  const reopen = async (entryId) => {
    setStatus("Loading scan…");
    try {
      const res = await authApi.getHistoryEntry(entryId);
      setRun(res.result);
      navigate("/app/overview");
    } catch (err) {
      setStatus(`Could not load that scan: ${err.message}`);
    }
  };

  const remove = async (entryId) => {
    try {
      await authApi.deleteHistoryEntry(entryId);
      setEntries((prev) => prev.filter((e) => e.entry_id !== entryId));
    } catch (err) {
      setStatus(`Could not delete: ${err.message}`);
    }
  };

  return (
    <Shell title="Scan history" sub="Every completed scan, reopenable without re-running">
      {status ? <Note>{status}</Note> : null}

      {entries === null ? (
        <div className="flex items-center gap-3 p-6">
          <Spinner />
          <span className="nb-label">Loading history</span>
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No saved scans yet"
          body="Completed scans are saved to your account automatically and can be reopened from here."
          action={<Button onClick={() => navigate("/app/overview")}>Run a scan</Button>}
        />
      ) : (
        <div className="grid gap-3">
          {entries.map((e) => (
            <article key={e.entry_id} className="nb-frame nb-lift p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="nb-label">
                    {(e.created_at || "").slice(0, 16).replace("T", " ")}
                  </span>
                  <h3 className="mt-1 text-[14.5px] font-bold leading-snug">
                    {e.goal || "Untitled scan"}
                  </h3>
                  <span className="mt-0.5 block font-mono text-[11px] text-ink-4">
                    {e.run_id}
                  </span>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="xs" onClick={() => reopen(e.entry_id)}>
                    Reopen
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => remove(e.entry_id)}
                    aria-label="Delete this scan"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2.4} />
                  </Button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 border-t-2 border-line pt-3 text-[12px]">
                {[
                  ["findings", fmtNum(e.findings)],
                  ["insights", fmtNum(e.insights)],
                  ["high priority", fmtNum(e.high_priority)],
                  [
                    "duration",
                    e.duration_ms != null
                      ? `${(e.duration_ms / 1000).toFixed(1)}s`
                      : "—",
                  ],
                  ["reasoner", e.reasoner || "—"],
                ].map(([label, value]) => (
                  <span key={label} className="flex flex-col">
                    <b className="font-mono text-[13px] font-bold tabular-nums">
                      {value}
                    </b>
                    <span className="nb-label text-[9px]">{label}</span>
                  </span>
                ))}
                <span className="ml-auto flex items-center gap-2">
                  <SimTag on={e.simulated} />
                  {(e.competitors || []).slice(0, 3).map((c) => (
                    <span
                      key={c}
                      className="border-2 border-line bg-bg-2 px-1.5 py-0.5 text-[11px] font-semibold"
                    >
                      {c}
                    </span>
                  ))}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </Shell>
  );
}
