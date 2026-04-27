import { pick, type Locale } from "@/lib/i18n";

type TrackBoardEmptyStateInput = {
  activeView: "all" | "open" | "mine";
  hasFilters: boolean;
  locale: Locale;
  totalTrackCount: number;
};

export function getTrackBoardEmptyState({
  activeView,
  hasFilters,
  locale,
  totalTrackCount,
}: TrackBoardEmptyStateInput) {
  if (hasFilters && totalTrackCount > 0) {
    return pick(locale, {
      en: "Nothing matches the current search or filters. Clear them to see every song on this gig.",
      ru: "Ничего не найдено по текущему поиску или фильтрам. Сбрось их, чтобы увидеть все песни этого гига.",
    });
  }

  if (activeView === "mine") {
    return pick(locale, {
      en: "You are not part of any songs here yet.",
      ru: "Ты пока не участвуешь ни в одной из этих песен.",
    });
  }

  if (activeView === "open") {
    return pick(locale, {
      en: "Every visible song is already assembled.",
      ru: "Все видимые песни уже собраны.",
    });
  }

  return pick(locale, {
    en: "This gig does not have song proposals yet.",
    ru: "В этом гиге пока нет заявленных песен.",
  });
}
