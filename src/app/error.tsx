"use client";

import { useEffect, useMemo, useRef } from "react";

import { getPublicErrorId } from "@/lib/error-reporting";

type RootErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

function isDatabaseError(error: Error) {
  return (
    error.message.includes("Can't reach database server") ||
    error.message.includes("database") ||
    error.message.includes("P1001")
  );
}

export default function RootError({ error, reset }: RootErrorProps) {
  const reportedRef = useRef(false);
  const errorId = useMemo(() => getPublicErrorId(error), [error]);

  useEffect(() => {
    console.error(error);

    if (reportedRef.current) {
      return;
    }
    reportedRef.current = true;

    const path =
      typeof window === "undefined"
        ? null
        : `${window.location.pathname}${window.location.search}`;

    void fetch("/api/client-error", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        errorId,
        digest: error.digest ?? null,
        message: error.message,
        name: error.name,
        path,
        stack: error.stack ?? null,
      }),
      keepalive: true,
    }).catch(() => {
      // The visible error id still helps correlate browser reports if logging fails.
    });
  }, [error, errorId]);

  const databaseUnavailable = isDatabaseError(error);

  return (
    <div className="mx-auto max-w-[1440px] px-5 py-8 text-sand md:px-6">
      <section className="border-b border-white/8 pb-8">
        <div className="brand-stage rounded-[1.8rem] border border-white/10 px-6 py-6 shadow-[0_28px_80px_rgba(0,0,0,0.42)] md:px-7">
          <div className="space-y-5">
            <span className="inline-flex items-center rounded-sm border border-red/24 bg-red/14 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
              {databaseUnavailable ? "Local data unavailable" : "Unexpected app error"}
            </span>
            <div className="space-y-3">
              <h1 className="font-display text-4xl font-semibold uppercase tracking-[0.04em] text-sand lg:text-5xl">
                {databaseUnavailable
                  ? "The local app cannot reach its data right now"
                  : "This screen hit an unexpected problem"}
              </h1>
              <p className="max-w-3xl text-base leading-7 text-white/76">
                {databaseUnavailable
                  ? "The page is reachable, but the database at 127.0.0.1:55432 is not responding. Restart the Postgres port-forward or switch the app back to a working local database."
                  : "Try the action again. If the issue keeps happening, reload the page after the local services are back in a healthy state."}
              </p>
              <p className="w-fit rounded-sm border border-white/12 bg-white/6 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
                Error ID <span className="ml-2 text-sand">{errorId}</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                className="inline-flex items-center justify-center rounded-sm border border-white/14 bg-stage px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-sand transition duration-200 hover:border-gold/28 hover:text-white"
                onClick={reset}
                type="button"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
