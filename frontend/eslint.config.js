import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

/* Lint config.
 *
 * The rule that matters most here is `no-undef`. A `<Bubbles />` left behind after
 * a component was renamed is perfectly valid JavaScript — Vite compiles it happily
 * and it only explodes at runtime, as a blank page. `no-undef` turns that into a
 * build failure, which is where it belongs.
 *
 * `react-hooks` rules are on because a hook placed after an early return is the
 * other failure mode that survives compilation and breaks at runtime.
 */
export default [
  { ignores: ["dist/**", "node_modules/**"] },

  // Build config runs in Node, not the browser, so it gets Node globals. Without
  // this, `process.env` in vite.config.js is a no-undef error.
  {
    files: ["*.config.js", "vite.config.js", "eslint.config.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: { ...js.configs.recommended.rules },
  },

  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ...globals.es2024 },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,

      // The bug this config exists to catch.
      "no-undef": "error",

      // ── react-hooks v7 compiler rules: advisory here, not gating ──────────
      //
      // v7 bundles the React Compiler's rule set, which is considerably stricter
      // than the classic rules-of-hooks pair. These four flag idioms that work
      // correctly in this app but are not what the compiler would prefer:
      //
      //   set-state-in-effect  one-time seeding from a fetched profile, count-up
      //                        animation frames, IntersectionObserver reveal
      //   static-components    small render helpers declared next to their only
      //                        caller
      //   immutability         in-place array building inside chart layout math,
      //                        on arrays that never leave the function
      //   refs                 the read-latest-value ref pattern
      //
      // They are kept visible as warnings rather than switched off, because each
      // is a legitimate thing to revisit. They are not errors because none of them
      // indicates present breakage, and gating the build on that refactor would
      // mean restructuring working state providers and chart code without the
      // behavioural test coverage to prove the result is identical.
      //
      // Correctness rules stay at error: rules-of-hooks below, plus no-undef above.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/rules-of-hooks": "error",

      // JSX-referenced identifiers must not be reported as unused. Capitalised
      // names are components; UPPER_CASE are constant maps.
      "no-unused-vars": [
        "warn",
        { varsIgnorePattern: "^[A-Z_]", argsIgnorePattern: "^_" },
      ],

      // Empty catch blocks are used deliberately for best-effort paths (localStorage
      // in private mode, a failed sign-out call), and each one is commented.
      "no-empty": ["error", { allowEmptyCatch: true }],

      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
];
