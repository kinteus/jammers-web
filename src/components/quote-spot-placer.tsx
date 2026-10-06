"use client";

import { useEffect, useRef } from "react";

// Where a bubble sits on its section's height. "start" begins just below the top rounded corner,
// "end" finishes just above the bottom one, and the quarters sit halfway between those and the
// middle.
export function getSpotTop(align: string, section: DOMRect, radiusTop: number, radiusBottom: number, height: number) {
  const startCenter = section.top + radiusTop + height / 2;
  const middleCenter = section.top + section.height / 2;
  const endCenter = section.bottom - radiusBottom - height / 2;
  const centers: Record<string, number> = {
    start: startCenter,
    "upper-quarter": (startCenter + middleCenter) / 2,
    middle: middleCenter,
    "lower-quarter": (middleCenter + endCenter) / 2,
    end: endCenter,
  };

  return (centers[align] ?? middleCenter) - height / 2;
}

/** Moves each quote bubble next to its home section (see QUOTE_SPOTS) and keeps it there on resize. */
export function QuoteSpotPlacer() {
  const markerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const perimeter = markerRef.current?.parentElement;
    const shell = perimeter?.closest(".home-page-shell");

    if (!perimeter || !shell) {
      return;
    }

    const place = () => {
      const origin = perimeter.getBoundingClientRect().top;

      perimeter.querySelectorAll<HTMLElement>(".community-quote-peek[data-anchor]").forEach((peek) => {
        const section = shell.querySelector<HTMLElement>(`[data-quote-anchor="${peek.dataset.anchor}"]`);

        if (!section) {
          peek.removeAttribute("data-placed");
          return;
        }

        const style = getComputedStyle(section);
        const side = peek.dataset.edge === "right" ? "Right" : "Left";
        const top = getSpotTop(
          peek.dataset.align ?? "middle",
          section.getBoundingClientRect(),
          parseFloat(style[`borderTop${side}Radius`]) || 0,
          parseFloat(style[`borderBottom${side}Radius`]) || 0,
          peek.offsetHeight,
        );

        peek.style.setProperty("--quote-top", `${Math.round(top - origin)}px`);
        peek.setAttribute("data-placed", "");
      });
    };

    const observer = new ResizeObserver(place);
    observer.observe(shell);
    shell.querySelectorAll("[data-quote-anchor]").forEach((section) => observer.observe(section));
    place();

    return () => observer.disconnect();
  }, []);

  return <span aria-hidden="true" hidden ref={markerRef} />;
}
