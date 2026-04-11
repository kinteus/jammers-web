import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { pick, type Locale } from "@/lib/i18n";

type EventBoardGuideProps = {
  allowClosedOptionalRequests: boolean;
  locale: Locale;
  optionalOpenSeatCount: number;
  requiredOpenSeatCount: number;
  roleShortages: Array<[string, number]>;
  tracksNeedingPlayers: number;
};

export function EventBoardGuide({
  allowClosedOptionalRequests,
  locale,
  optionalOpenSeatCount,
  requiredOpenSeatCount,
  roleShortages,
  tracksNeedingPlayers,
}: EventBoardGuideProps) {
  const legend = [
    {
      dotClass: "bg-gold",
      label: pick(locale, { en: "Open seat", ru: "Открытое место" }),
      text: pick(locale, {
        en: "This part still needs a player.",
        ru: "Этой партии всё ещё нужен музыкант.",
      }),
    },
    {
      dotClass: "bg-blue",
      label: pick(locale, { en: "Claimed seat", ru: "Занятое место" }),
      text: pick(locale, {
        en: "Someone is already in the line-up.",
        ru: "Кто-то уже в этом лайнапе.",
      }),
    },
    {
      dotClass: "bg-white/38",
      label: pick(locale, { en: "Skipped in arrangement", ru: "Пропущено в аранжировке" }),
      text: pick(locale, {
        en: "The slot exists in the event, but this track is not using it.",
        ru: "Слот есть в событии, но конкретный трек его не использует.",
      }),
    },
  ];

  return (
    <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <Card className="brand-shell space-y-4 border-white/10">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/56">
            {pick(locale, { en: "Board guide", ru: "Как читать борд" })}
          </p>
          <h2 className="font-display text-3xl font-semibold uppercase tracking-[0.04em] text-sand">
            {pick(locale, {
              en: "Read this board in 30 seconds",
              ru: "Разобраться в борде за 30 секунд",
            })}
          </h2>
          <p className="max-w-3xl text-sm leading-6 text-white/72">
            {pick(locale, {
              en: "Gold means the part is still needed, blue means someone is already in, and pale cells mean this arrangement skips that slot.",
              ru: "Золото означает, что партия ещё нужна, синий — что человек уже в составе, а светлые ячейки показывают, что эта аранжировка слот не использует.",
            })}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {legend.map((item) => (
            <div className="brand-shell-soft rounded-xl p-4" key={item.label}>
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${item.dotClass}`} />
                <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-sand">
                  {item.label}
                </h3>
              </div>
              <p className="mt-3 text-sm leading-6 text-white/72">{item.text}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="brand-stage space-y-4 border-white/10">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/56">
            {pick(locale, { en: "Best next move", ru: "Лучший следующий шаг" })}
          </p>
          <h2 className="font-display text-3xl font-semibold uppercase tracking-[0.04em] text-sand">
            {pick(locale, {
              en: "Strengthen what's already moving",
              ru: "Усиль то, что уже движется",
            })}
          </h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
              {pick(locale, { en: "Required seats open", ru: "Открыто обязательных мест" })}
            </p>
            <p className="mt-2 text-3xl font-semibold text-sand">{requiredOpenSeatCount}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
              {pick(locale, { en: "Tracks needing players", ru: "Треков ждут людей" })}
            </p>
            <p className="mt-2 text-3xl font-semibold text-sand">{tracksNeedingPlayers}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
              {pick(locale, { en: "Optional seats open", ru: "Открыто optional-мест" })}
            </p>
            <p className="mt-2 text-3xl font-semibold text-sand">{optionalOpenSeatCount}</p>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm leading-6 text-white/74">
            {allowClosedOptionalRequests
              ? pick(locale, {
                  en: "Core sign-ups are already closed, but optional seats can still be requested through the track author.",
                  ru: "Основная запись уже закрыта, но optional-места всё ещё можно запросить через автора трека.",
                })
              : pick(locale, {
                  en: "Close the real gaps first. A stronger board makes every new proposal easier to support.",
                  ru: "Сначала закрой реальные дыры. Чем крепче текущий борд, тем легче поддержать каждую новую песню.",
                })}
          </p>
          {roleShortages.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {roleShortages.map(([label, count]) => (
                <Badge className="border-gold/24 bg-gold/10 text-white" key={label}>
                  {label} · {count}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      </Card>
    </section>
  );
}
