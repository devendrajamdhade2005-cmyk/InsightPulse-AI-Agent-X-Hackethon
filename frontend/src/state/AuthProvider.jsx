import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as authApi from "../lib/authApi.js";

/* Session state.
 *
 * On mount, if a stored token exists it is validated against /api/me before the app
 * treats the user as signed in. Trusting the presence of a token alone would flash
 * the dashboard and then bounce a user whose session had actually expired.
 */

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [saved, setSaved] = useState([]);
  const [tracked, setTracked] = useState([]);
  const [config, setConfig] = useState(null);
  // "checking" until we know whether the stored token is usable.
  const [status, setStatus] = useState("checking");

  const applyAccount = useCallback((payload) => {
    setUser(payload.user || null);
    setProfile(payload.profile || null);
    if (Array.isArray(payload.saved)) setSaved(payload.saved);
    if (Array.isArray(payload.tracked)) setTracked(payload.tracked);
  }, []);

  // What the sign-in screen can offer depends on the server's configuration.
  useEffect(() => {
    let cancelled = false;
    authApi
      .getAuthConfig()
      .then((c) => !cancelled && setConfig(c))
      .catch(() => !cancelled && setConfig(null));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!authApi.tokenStore.access) {
      setStatus("anonymous");
      return undefined;
    }
    authApi
      .getMe()
      .then((me) => {
        if (cancelled) return;
        applyAccount(me);
        setStatus("authenticated");
      })
      .catch(() => {
        if (cancelled) return;
        authApi.tokenStore.clear();
        setStatus("anonymous");
      });
    return () => {
      cancelled = true;
    };
  }, [applyAccount]);

  const adoptSession = useCallback(
    async (session) => {
      authApi.tokenStore.save(session);
      setUser(session.user || null);
      setProfile(session.profile || null);
      setStatus("authenticated");
      // Pull the saved/tracked lists, which the session payload does not carry.
      try {
        applyAccount(await authApi.getMe());
      } catch {
        /* the session is valid; these lists can load later */
      }
    },
    [applyAccount],
  );

  const signIn = useCallback(
    async (email, password) => {
      await adoptSession(await authApi.login(email, password));
    },
    [adoptSession],
  );

  const signUp = useCallback(
    async (email, password, displayName) => {
      await adoptSession(await authApi.register(email, password, displayName));
    },
    [adoptSession],
  );

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Tokens are stateless, so a failed call cannot prevent signing out locally.
    }
    authApi.tokenStore.clear();
    setUser(null);
    setProfile(null);
    setSaved([]);
    setTracked([]);
    setStatus("anonymous");
  }, []);

  const saveProfile = useCallback(async (patch) => {
    const res = await authApi.updateProfile(patch);
    setProfile(res.profile);
    if (res.profile?.display_name) {
      setUser((prev) =>
        prev ? { ...prev, display_name: res.profile.display_name } : prev,
      );
    }
    return res.profile;
  }, []);

  /* Server-backed saved/tracked, so they follow the user across devices. The
     optimistic update keeps the click responsive; the server response is
     authoritative and replaces it. */
  const toggleSaved = useCallback(async (findingId) => {
    setSaved((prev) =>
      prev.includes(findingId)
        ? prev.filter((x) => x !== findingId)
        : [...prev, findingId],
    );
    try {
      const res = await authApi.toggleSavedFinding(findingId);
      if (Array.isArray(res.all)) setSaved(res.all);
      return res.saved;
    } catch {
      setSaved((prev) =>
        prev.includes(findingId)
          ? prev.filter((x) => x !== findingId)
          : [...prev, findingId],
      );
      return null;
    }
  }, []);

  const addTracked = useCallback(async (term) => {
    try {
      const res = await authApi.addTrackedTerm(term);
      if (Array.isArray(res.tracked)) setTracked(res.tracked);
    } catch {
      /* non-fatal */
    }
  }, []);

  const removeTracked = useCallback(async (term) => {
    try {
      const res = await authApi.removeTrackedTerm(term);
      if (Array.isArray(res.tracked)) setTracked(res.tracked);
    } catch {
      /* non-fatal */
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      profile,
      config,
      status,
      isAuthenticated: status === "authenticated",
      isChecking: status === "checking",
      saved,
      tracked,
      signIn,
      signUp,
      signOut,
      saveProfile,
      toggleSaved,
      addTracked,
      removeTracked,
      isSaved: (id) => saved.includes(id),
    }),
    [
      user, profile, config, status, saved, tracked,
      signIn, signUp, signOut, saveProfile, toggleSaved, addTracked, removeTracked,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
