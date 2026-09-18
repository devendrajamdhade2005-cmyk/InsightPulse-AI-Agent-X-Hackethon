import { useEffect, useRef, useState } from "react";

/* Scroll-reveal + ambient animation helpers.
 *
 * All of these degrade to "content is simply visible" when IntersectionObserver
 * is unavailable or the user prefers reduced motion. An animation helper that can
 * leave content permanently hidden is a bug, not an effect.
 */

const reduced = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Adds `.is-in` once the element scrolls into view.
 *
 * @param {object} opts
 * @param {number} opts.threshold  visible fraction required
 * @param {number} opts.delay      ms stagger, for sequencing siblings
 */
export function useReveal({ threshold = 0.15, delay = 0 } = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    if (reduced() || !("IntersectionObserver" in window)) {
      node.classList.add("is-in");
      return undefined;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (delay) node.style.transitionDelay = `${delay}ms`;
          node.classList.add("is-in");
          io.disconnect();
        }
      },
      { threshold, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [threshold, delay]);

  return ref;
}

/** True once the element has been seen. Use to defer expensive animation. */
export function useInView({ threshold = 0.25 } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    if (!("IntersectionObserver" in window)) {
      setInView(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            io.disconnect();
          }
        }
      },
      { threshold },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [threshold]);

  return [ref, inView];
}

/**
 * Pointer-tracked tilt for the 3D surfaces.
 *
 * Returns a ref plus inline style. Values are clamped and eased, and the whole
 * thing is inert under reduced-motion or on touch — a tilt that only responds to
 * a hover a touch device cannot produce would just be dead weight.
 *
 * @param {number} max maximum rotation in degrees
 */
export function useTilt({ max = 10, scale = 1.02 } = {}) {
  const ref = useRef(null);
  const [style, setStyle] = useState({});

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    if (reduced() || window.matchMedia?.("(hover: none)").matches) return undefined;

    let frame = 0;

    const onMove = (e) => {
      const rect = node.getBoundingClientRect();
      // -0.5 … 0.5 relative to the element's centre.
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setStyle({
          transform:
            `rotateX(${(-py * max).toFixed(2)}deg) ` +
            `rotateY(${(px * max).toFixed(2)}deg) ` +
            `scale(${scale})`,
        });
      });
    };

    const onLeave = () => {
      cancelAnimationFrame(frame);
      setStyle({ transform: "rotateX(0deg) rotateY(0deg) scale(1)" });
    };

    node.addEventListener("pointermove", onMove);
    node.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      node.removeEventListener("pointermove", onMove);
      node.removeEventListener("pointerleave", onLeave);
    };
  }, [max, scale]);

  return [ref, style];
}

/**
 * Steps through an index on an interval, pausing when off-screen or when the tab
 * is hidden. Drives the landing page's rotating demo without burning CPU in a
 * background tab.
 */
export function useCycle(length, { interval = 3200, active = true } = {}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active || length <= 1 || reduced()) return undefined;
    let id = 0;
    const tick = () => {
      if (!document.hidden) setIndex((i) => (i + 1) % length);
    };
    id = window.setInterval(tick, interval);
    return () => window.clearInterval(id);
  }, [length, interval, active]);

  return [index, setIndex];
}

/** Eased 0→1 progress once `active` becomes true. Drives chart draw-ins. */
export function useProgress(active, duration = 900) {
  const [t, setT] = useState(0);

  useEffect(() => {
    if (!active) return undefined;
    if (reduced()) {
      setT(1);
      return undefined;
    }
    let frame = 0;
    const start = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - start) / duration);
      // easeOutCubic
      setT(1 - Math.pow(1 - p, 3));
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [active, duration]);

  return t;
}
