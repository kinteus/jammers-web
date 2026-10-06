"use client";

import { useEffect, useState } from "react";

const numberFormat = new Intl.NumberFormat("en-GB");

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// The final value is always in the DOM (server-rendered and in an sr-only copy), so crawlers,
// link previews and screen readers never see intermediate frames. The count-up is visual only.
export function AnimatedNumber({
  value,
  duration = 900,
}: {
  value: number;
  duration?: number;
}) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplayValue(value);
      return;
    }

    let frame = 0;
    const startedAt = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(value * eased));

      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [duration, value]);

  return (
    <>
      <span className="sr-only">{numberFormat.format(value)}</span>
      <span aria-hidden="true" data-animated-number>
        {numberFormat.format(displayValue)}
      </span>
    </>
  );
}
