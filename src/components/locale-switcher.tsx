"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { type Locale, localeCookieName } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const localeLabels: Record<Locale, string> = {
  en: "EN",
  ru: "RU",
};

export function LocaleSwitcher({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateLocale(nextLocale: Locale) {
    if (nextLocale === locale) {
      return;
    }

    document.cookie = `${localeCookieName}=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    const query = searchParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    router.refresh();
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-white/16 bg-black/25 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      {(["en", "ru"] as Locale[]).map((item) => (
        <button
          className={cn(
            "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] transition",
            item === locale
              ? "border border-white/18 bg-white text-stage shadow-[0_10px_24px_rgba(0,0,0,0.28)]"
              : "text-white/80 hover:bg-white/12 hover:text-white",
          )}
          key={item}
          onClick={() => updateLocale(item)}
          type="button"
        >
          {localeLabels[item]}
        </button>
      ))}
    </div>
  );
}
