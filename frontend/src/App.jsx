import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./state/AuthProvider.jsx";

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

export default function App() {
  return (
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
  );
}
