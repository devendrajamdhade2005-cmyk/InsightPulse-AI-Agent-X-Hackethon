import { useEffect, useState } from "react";

/* Animated count-up for KPI values.
 *
 * Ported from the original `countUp()` helper, including its two guards: users
 * who prefer reduced motion get the final value immediately, and environments
 * without requestAnimationFrame are handled rather than assumed away.
 */

const DURATION = 620;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function useCountUp(target, { duration = DURATION } = {}) {
  const final = Number(target);
  const [value, setValue] = useState(() =>
    Number.isFinite(final) ? 0 : final,
  );

  useEffect(() => {
    if (!Number.isFinite(final)) {
      setValue(final);
      return undefined;
    }
    if (prefersReducedMotion() || typeof requestAnimationFrame !== "function") {
      setValue(final);
      return undefined;
    }

    let frame = 0;
    const start = performance.now();

    const step = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(final * eased));
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [final, duration]);

  return Number.isFinite(final) ? value : final;
}
