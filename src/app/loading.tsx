import { getLocale } from "@/lib/i18n-server";
import { pick } from "@/lib/i18n";
import { Loader } from "@/components/ui/loader";

export default async function GlobalLoading() {
  const locale = await getLocale();

  return (
    <div className="flex min-h-[calc(100vh-73px)] items-center justify-center">
      <div className="brand-shell flex min-w-[260px] flex-col items-center gap-3 px-8 py-7 text-center">
        <Loader label={pick(locale, { en: "Loading page...", ru: "Загружаем страницу..." })} />
        <p className="text-sm text-white/60">
          {pick(locale, {
            en: "Preparing the next screen.",
            ru: "Готовим следующий экран.",
          })}
        </p>
      </div>
    </div>
  );
}
