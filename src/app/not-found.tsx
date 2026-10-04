import type { Metadata } from "next";
import Link from "next/link";

import { pick } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

// Intentionally database-free so it still renders when data is unavailable.
export default async function NotFound() {
  const locale = await getLocale();

  return (
    <div className="mx-auto max-w-[1440px] px-5 py-8 text-sand md:px-6">
      <section className="brand-stage rounded-[1.8rem] border border-white/10 px-6 py-10 shadow-[0_28px_80px_rgba(0,0,0,0.42)] md:px-10 md:py-14">
        <div className="max-w-3xl space-y-6">
          <Badge className="border-gold/24 bg-gold/12 text-gold">404</Badge>
          <div className="space-y-3">
            <h1 className="font-display text-4xl font-semibold uppercase tracking-[0.04em] text-sand lg:text-6xl">
              {pick(locale, {
                en: "This page went off-stage",
                ru: "Эта страница ушла со сцены",
              })}
            </h1>
            <p className="text-base leading-7 text-white/76">
              {pick(locale, {
                en: "The link may be old or mistyped. The next gig board and past setlists are still here.",
                ru: "Ссылка могла устареть или в ней опечатка. Доска ближайшего гига и прошлые сетлисты на месте.",
              })}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/">
                {pick(locale, { en: "Go to the next gig", ru: "К ближайшему гигу" })}
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/archive">
                {pick(locale, { en: "Browse setlists", ru: "Смотреть сетлисты" })}
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
