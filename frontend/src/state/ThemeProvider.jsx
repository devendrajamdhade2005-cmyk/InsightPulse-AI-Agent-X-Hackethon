import { createContext, useCallback, useContext, useEffect, useState } from "react";

/* Light / dark theme.
 *
 * Class-based on <html> so it is deterministic and can be applied before first
 * paint — the inline script in index.html reads the same localStorage key, which
 * is what prevents a white flash for dark-mode users.
 *
 * Three states are tracked, not two: "light", "dark", and "system". Collapsing
 * system into a resolved value would lose the user's intent to keep following
 * their OS setting.
 */

const STORAGE_KEY = "ip.theme";
const ThemeContext = createContext(null);

function prefersDark() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function readStored() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(readStored);
  const [systemDark, setSystemDark] = useState(prefersDark);

  const isDark = preference === "dark" || (preference === "system" && systemDark);

  // Follow the OS while the preference is "system".
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  }, [isDark]);

  useEffect(() => {
    try {
      if (preference === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      /* private mode — the theme still applies for this session */
    }
  }, [preference]);

  // Toggling picks the explicit opposite of what is currently showing, so one
  // click always visibly changes the theme regardless of the OS setting.
  const toggle = useCallback(() => {
    setPreference(isDark ? "light" : "dark");
  }, [isDark]);

  return (
    <ThemeContext.Provider
      value={{ preference, isDark, toggle, setPreference }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
