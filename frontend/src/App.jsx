import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./state/AuthProvider.jsx";
import { ErrorBoundary } from "./components/ui/ErrorBoundary.jsx";

import Landing from "./pages/Landing.jsx";
import HowItWorks from "./pages/HowItWorks.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import { History, Profile } from "./pages/Account.jsx";
import {
  FullPageSpinner,
  ResetPassword,
  SignIn,
  SignUp,
} from "./pages/AuthPages.jsx";

/* Routing.
 *
 *   /                public landing
 *   /how-it-works    architecture explainer
 *   /signin /signup  authentication
 *   /app/:section    the workspace (requires a session)
 *
 * The workspace is gated by `RequireAuth`, which waits for the session check
 * before deciding. Redirecting while the check is still in flight would bounce a
 * signed-in user to the login screen on every hard refresh.
 */

function RequireAuth({ children }) {
  const { isAuthenticated, isChecking } = useAuth();
  const location = useLocation();

  if (isChecking) return <FullPageSpinner />;
  if (!isAuthenticated) {
    // Remember where they were headed so sign-in can return them there.
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  }
  return children;
}

/** Last-resort shell for a crash outside any panel boundary. */
function ShellFallback(error, reset) {
  return (
    <div data-surface="glass" className="grid min-h-screen place-items-center p-6">
      <div className="gl-card gl-card-lg max-w-lg p-7 text-center">
        <h1 className="text-xl font-bold uppercase tracking-tight">
          Something broke
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">
          The interface hit an error it could not recover from on its own. Your
          account and saved scans are unaffected.
        </p>
        <p className="mt-3 break-words font-mono text-[11.5px] text-brand-red">
          {String(error?.message || error)}
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="nb-press border-2 border-line bg-brand-blue px-4 py-2 text-[12.5px] font-bold uppercase tracking-wide text-white"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={() => window.location.assign("/app/overview")}
            className="nb-press border-2 border-line bg-surface px-4 py-2 text-[12.5px] font-bold uppercase tracking-wide"
          >
            Reload workspace
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary label="Application" fallback={ShellFallback}>
      <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/how-it-works" element={<HowItWorks />} />

      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/reset" element={<ResetPassword />} />

      <Route
        path="/app"
        element={
          <RequireAuth>
            <Navigate to="/app/overview" replace />
          </RequireAuth>
        }
      />
      <Route
        path="/app/profile"
        element={
          <RequireAuth>
            <Profile />
          </RequireAuth>
        }
      />
      <Route
        path="/app/history"
        element={
          <RequireAuth>
            <History />
          </RequireAuth>
        }
      />
      <Route
        path="/app/:section"
        element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        }
      />

        {/* Unknown paths go home rather than showing a dead end. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
