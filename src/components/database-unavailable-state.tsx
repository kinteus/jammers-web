import { pick, type Locale } from "@/lib/i18n";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export function DatabaseUnavailableState({
  locale,
  title,
}: {
  locale: Locale;
  title: string;
}) {
  return (
    <div className="space-y-8 text-sand">
      <section className="border-b border-white/8 pb-8">
        <div className="brand-stage rounded-[1.8rem] border border-white/10 px-6 py-6 shadow-[0_28px_80px_rgba(0,0,0,0.42)] md:px-7">
          <div className="space-y-5">
            <Badge className="border-red/24 bg-red/14 text-white">
              {pick(locale, { en: "Local data unavailable", ru: "Локальная база недоступна" })}
            </Badge>
            <div className="space-y-3">
              <h1 className="font-display text-4xl font-semibold uppercase tracking-[0.04em] text-sand lg:text-5xl">
                {title}
              </h1>
              <p className="max-w-3xl text-base leading-7 text-white/76">
                {pick(locale, {
                  en: "The page is reachable, but the local app cannot talk to the database at 127.0.0.1:55432. Restart the Postgres port-forward or point the app back to a working local database.",
                  ru: "Страница доступна, но локальное приложение не может подключиться к базе на 127.0.0.1:55432. Перезапусти port-forward к Postgres или верни приложение на рабочую локальную базу.",
                })}
              </p>
            </div>
            <Card className="brand-shell-soft space-y-3 border-white/10">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                {pick(locale, { en: "What to check", ru: "Что проверить" })}
              </p>
              <div className="space-y-2 text-sm leading-6 text-white/70">
                <p>
                  {pick(locale, {
                    en: "1. Ensure the `kubectl port-forward` to `127.0.0.1:55432` is still running.",
                    ru: "1. Убедись, что `kubectl port-forward` на `127.0.0.1:55432` всё ещё запущен.",
                  })}
                </p>
                <p>
                  {pick(locale, {
                    en: "2. Reload the page after the tunnel is back.",
                    ru: "2. Перезагрузи страницу после восстановления туннеля.",
                  })}
                </p>
              </div>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
