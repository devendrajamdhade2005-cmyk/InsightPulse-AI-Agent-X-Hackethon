import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { cx } from "../lib/accents.js";
import { useAuth } from "../state/AuthProvider.jsx";
import * as authApi from "../lib/authApi.js";
import { ThemeToggle, Wordmark } from "../components/marketing/Chrome.jsx";
import { TextInput } from "../components/ui/Primitives.jsx";
import { LoadingPanel, Spinner } from "../components/ui/Loading.jsx";
import {
  AlertTriangle,
  ArrowRight,
  Beaker,
  Brain,
  Check,
  Shield,
  Target,
} from "../components/icons/index.jsx";

/* Sign in / sign up / password reset.
 *
 * One layout, three modes. The right-hand panel is static reassurance; the left is
 * the form. Controls that the server cannot support are hidden rather than shown
 * and then failing — `/api/auth/config` reports whether password reset is available,
 * which depends on whether Firebase Identity Toolkit is configured.
 */

const PROOF = [
  { icon: Brain, text: "A real reasoning loop, with the decision trail shown" },
  { icon: Beaker, text: "13 providers across research, patents, news and the live web" },
  { icon: Shield, text: "Simulated data always labelled, never passed off as live" },
  { icon: Target, text: "Prioritized briefings you can export and hand over" },
];

function AuthLayout({ title, lead, children, footer }) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* form side */}
      <div className="flex flex-1 flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Link to="/">
            <Wordmark />
          </Link>
          <ThemeToggle />
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <h1 className="text-2xl font-bold uppercase tracking-tight sm:text-3xl">
            {title}
          </h1>
          {lead ? <p className="mt-2 text-[13.5px] text-ink-2">{lead}</p> : null}
          <div className="mt-7">{children}</div>
          {footer ? <div className="mt-6 text-[13px]">{footer}</div> : null}
        </div>
      </div>

      {/* reassurance side */}
      <aside className="gl-canvas border-t-4 border-line px-5 py-10 sm:px-10 lg:w-[26rem] lg:border-l-4 lg:border-t-0 xl:w-[30rem]">
        <div className="lg:sticky lg:top-10">
          <span className="nb-eyebrow">Why this exists</span>
          <p className="mt-4 text-[15px] font-bold uppercase leading-snug tracking-tight">
            Monitoring research and competitors by hand does not scale.
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-ink-2">
            Papers, filings, launches and funding news arrive faster than anyone can
            read them, and the important ones do not announce themselves.
          </p>
          <ul className="mt-6 grid gap-3">
            {PROOF.map(({ icon: Icon, text }) => (
              <li
                key={text}
                className="gl-card flex items-start gap-3 p-3.5"
              >
                <Icon
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0 text-brand-blue"
                  strokeWidth={2.4}
                />
                <span className="text-[12.5px] leading-relaxed text-ink-2">{text}</span>
              </li>
            ))}
          </ul>
          <Link
            to="/how-it-works"
            className="mt-6 inline-flex items-center gap-1.5 border-b-2 border-brand-blue text-[12px] font-bold uppercase tracking-wide text-brand-blue"
          >
            Read how it works
            <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.6} />
          </Link>
        </div>
      </aside>
    </div>
  );
}

function Alert({ kind = "error", children }) {
  const Icon = kind === "error" ? AlertTriangle : Check;
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={cx(
        "mb-4 flex items-start gap-2 border-2 px-3 py-2.5 text-[12.5px] font-semibold",
        kind === "error"
          ? "border-brand-red bg-brand-red-bg text-brand-red"
          : "border-brand-green bg-brand-green-bg text-brand-green",
      )}
    >
      <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.6} />
      <span>{children}</span>
    </p>
  );
}

function Labelled({ label, htmlFor, children, hint }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="nb-label mb-1.5 block">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1.5 text-[11.5px] text-ink-4">{hint}</p> : null}
    </div>
  );
}

function SubmitButton({ busy, children }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="nb-press flex w-full items-center justify-center gap-2 border-2 border-line bg-brand-blue px-5 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-[var(--shadow-nb-sm)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy ? <Spinner size="sm" label="Submitting" /> : null}
      {children}
    </button>
  );
}

/* ── sign in ─────────────────────────────────────────────── */
export function SignIn() {
  const { signIn, isAuthenticated, isChecking, config } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (isChecking) return <FullPageSpinner />;
  if (isAuthenticated) {
    return <Navigate to={location.state?.from || "/app"} replace />;
  }

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      navigate(location.state?.from || "/app", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Sign in"
      lead="Pick up where you left off — your scan history and tracked companies are waiting."
      footer={
        <p className="text-ink-2">
          No account yet?{" "}
          <Link to="/signup" className="border-b-2 border-brand-blue font-bold text-brand-blue">
            Create one
          </Link>
        </p>
      }
    >
      {error ? <Alert>{error}</Alert> : null}
      <form onSubmit={submit} className="grid gap-4">
        <Labelled label="Email" htmlFor="email">
          <TextInput
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
          />
        </Labelled>
        <Labelled label="Password" htmlFor="password">
          <TextInput
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </Labelled>
        <SubmitButton busy={busy}>Sign in</SubmitButton>
      </form>

      {/* Only offered when the server can actually send a reset email. */}
      {config?.password_reset_available ? (
        <p className="mt-4 text-[12.5px]">
          <Link to="/reset" className="border-b-2 border-line-soft text-ink-2">
            Forgot your password?
          </Link>
        </p>
      ) : null}
    </AuthLayout>
  );
}

/* ── sign up ─────────────────────────────────────────────── */
export function SignUp() {
  const { signUp, isAuthenticated, isChecking, config } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (isChecking) return <FullPageSpinner />;
  if (isAuthenticated) return <Navigate to="/app" replace />;

  const minLength = config?.password_min_length || 8;
  const registrationClosed = config && config.registration_open === false;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signUp(form.email.trim(), form.password, form.name.trim());
      navigate("/app", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Create account"
      lead="Set a tracking brief and let the agent do the reading."
      footer={
        <p className="text-ink-2">
          Already registered?{" "}
          <Link to="/signin" className="border-b-2 border-brand-blue font-bold text-brand-blue">
            Sign in
          </Link>
        </p>
      }
    >
      {registrationClosed ? (
        <Alert>Registration is closed on this deployment.</Alert>
      ) : null}
      {error ? <Alert>{error}</Alert> : null}

      <form onSubmit={submit} className="grid gap-4">
        <Labelled label="Name" htmlFor="name">
          <TextInput
            id="name"
            autoComplete="name"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="Your name"
          />
        </Labelled>
        <Labelled label="Email" htmlFor="email">
          <TextInput
            id="email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            placeholder="you@company.com"
          />
        </Labelled>
        <Labelled
          label="Password"
          htmlFor="password"
          hint={`At least ${minLength} characters. Length is what matters — no symbol quotas.`}
        >
          <TextInput
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={minLength}
            value={form.password}
            onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))
            }
            placeholder="••••••••"
          />
        </Labelled>
        <SubmitButton busy={busy}>Create account</SubmitButton>
      </form>
    </AuthLayout>
  );
}

/* ── password reset ──────────────────────────────────────── */
export function ResetPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await authApi.requestPasswordReset(email.trim());
    } catch {
      // The endpoint answers identically either way so that an address cannot be
      // probed for existence; a network error is treated the same.
    } finally {
      setBusy(false);
      setSent(true);
    }
  };

  return (
    <AuthLayout
      title="Reset password"
      lead="We'll email a reset link if that address has an account."
      footer={
        <Link to="/signin" className="border-b-2 border-brand-blue font-bold text-brand-blue">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <Alert kind="ok">
          If that address has an account, a reset link is on its way.
        </Alert>
      ) : null}
      <form onSubmit={submit} className="grid gap-4">
        <Labelled label="Email" htmlFor="email">
          <TextInput
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
          />
        </Labelled>
        <SubmitButton busy={busy}>Send reset link</SubmitButton>
      </form>
    </AuthLayout>
  );
}

export function FullPageSpinner() {
  return (
    <div data-surface="glass" className="grid min-h-screen place-items-center">
      <LoadingPanel
        label="Checking your session"
        sub="One moment while we restore your workspace"
      />
    </div>
  );
}
