"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { isRouteNavigation } from "@/lib/navigation-progress";

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    function clearPendingTimeout() {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }

    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(target instanceof HTMLAnchorElement)) {
        return;
      }

      if (
        !isRouteNavigation({
          currentHref: window.location.href,
          target: target.getAttribute("target"),
          targetHref: target.href,
        })
      ) {
        return;
      }

      clearPendingTimeout();
      setIsNavigating(true);
      timeoutRef.current = window.setTimeout(() => {
        setIsNavigating(false);
        timeoutRef.current = null;
      }, 8000);
    }

    document.addEventListener("click", handleClick, { capture: true });

    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
      clearPendingTimeout();
    };
  }, []);

  useEffect(() => {
    setIsNavigating(false);
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [pathname, searchParams]);

  return (
    <div
      aria-hidden="true"
      className={[
        "pointer-events-none fixed left-0 top-0 z-[80] h-1 w-full overflow-hidden bg-transparent transition-opacity duration-150",
        isNavigating ? "opacity-100" : "opacity-0",
      ].join(" ")}
    >
      <div className="h-full w-1/2 animate-[navigation-progress_0.95s_ease-in-out_infinite] bg-gradient-to-r from-gold via-red to-blue shadow-[0_0_18px_rgba(255,167,38,0.45)]" />
    </div>
  );
}
