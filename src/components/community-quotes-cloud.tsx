import { randomInt } from "node:crypto";
import type { CSSProperties } from "react";

import { pick, type Locale } from "@/lib/i18n";

type CommunityQuote = {
  id: string;
  textEn: string;
  textRu: string;
  sourceLabel: string | null;
};

const QUOTE_SLOTS = [
  {
    left: 2,
    top: 1,
    width: 34,
    depth: "front",
    rotate: "-1.4deg",
    driftX: "-2px",
    floatDistance: "9px",
  },
  {
    left: 48,
    top: 0.7,
    width: 23,
    depth: "back",
    rotate: "1.8deg",
    driftX: "3px",
    floatDistance: "7px",
  },
  {
    left: 74,
    top: 0.9,
    width: 24,
    depth: "mid",
    rotate: "-0.9deg",
    driftX: "2px",
    floatDistance: "10px",
  },
  {
    left: 3,
    top: 6.8,
    width: 32,
    depth: "mid",
    rotate: "1.2deg",
    driftX: "-3px",
    floatDistance: "8px",
  },
  {
    left: 33,
    top: 6.1,
    width: 27,
    depth: "back",
    rotate: "-1.8deg",
    driftX: "4px",
    floatDistance: "9px",
  },
  {
    left: 58,
    top: 7.3,
    width: 19,
    depth: "front",
    rotate: "0.9deg",
    driftX: "-2px",
    floatDistance: "7px",
  },
  {
    left: 74,
    top: 6.6,
    width: 24,
    depth: "mid",
    rotate: "-1.1deg",
    driftX: "2px",
    floatDistance: "8px",
  },
  {
    left: 5,
    top: 12.8,
    width: 22,
    depth: "back",
    rotate: "1.5deg",
    driftX: "-4px",
    floatDistance: "10px",
  },
  {
    left: 29,
    top: 12.2,
    width: 30,
    depth: "front",
    rotate: "-1.2deg",
    driftX: "3px",
    floatDistance: "8px",
  },
  {
    left: 62,
    top: 12.9,
    width: 21,
    depth: "mid",
    rotate: "0.8deg",
    driftX: "-2px",
    floatDistance: "9px",
  },
  {
    left: 80,
    top: 14.1,
    width: 18,
    depth: "back",
    rotate: "-1deg",
    driftX: "2px",
    floatDistance: "7px",
  },
] as const;

const BAND_HEIGHT_REM = 15.8;

function shuffleQuotes<T>(items: T[]) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [copy[index], copy[swapIndex]] = [copy[swapIndex]!, copy[index]!];
  }

  return copy;
}

function pickDisplayQuotes(quotes: CommunityQuote[], displayLimit: number) {
  return shuffleQuotes(quotes).slice(0, Math.min(displayLimit, quotes.length));
}

function getQuoteText(locale: Locale, quote: CommunityQuote) {
  return pick(locale, {
    en: quote.textEn,
    ru: quote.textRu,
  });
}

function MobileQuotesStack({
  locale,
  mobileDisplayLimit,
  quotes,
}: {
  locale: Locale;
  mobileDisplayLimit: number;
  quotes: CommunityQuote[];
}) {
  const mobileQuotes = pickDisplayQuotes(quotes, mobileDisplayLimit);

  return (
    <div className="community-quotes-mobile-stack sm:hidden">
      {mobileQuotes.map((quote, index) => (
        <article
          className="community-mobile-quote-card"
          key={quote.id}
          style={{
            animationDelay: `${index * 0.18}s`,
            animationDuration: `${6.2 + (index % 5) * 0.45}s`,
            ["--mobile-quote-drift" as string]: `${(index % 3) - 1}`,
          }}
        >
          <div className="flex items-start gap-2">
            <p aria-hidden="true" className="pt-0.5 text-sm leading-none text-gold/70">
              “
            </p>
            <blockquote className="community-mobile-quote-card__text text-[0.98rem] leading-6 text-sand/92">
              {getQuoteText(locale, quote)}
            </blockquote>
          </div>
        </article>
      ))}
    </div>
  );
}

function DesktopQuotesWall({
  desktopDisplayLimit,
  locale,
  quotes,
}: {
  desktopDisplayLimit: number;
  locale: Locale;
  quotes: CommunityQuote[];
}) {
  const desktopQuotes = pickDisplayQuotes(quotes, desktopDisplayLimit);
  const layoutOffset = randomInt(QUOTE_SLOTS.length);
  const desktopBandCount = Math.ceil(desktopQuotes.length / QUOTE_SLOTS.length);
  const desktopStageHeight = Math.max(30, desktopBandCount * BAND_HEIGHT_REM + 3);

  return (
    <div
      className="community-quotes-canvas hidden sm:block"
      style={
        {
          ["--quotes-stage-height" as string]: `${desktopStageHeight}rem`,
        } as CSSProperties
      }
    >
      {desktopQuotes.map((quote, index) => {
        const slot = QUOTE_SLOTS[(index + layoutOffset) % QUOTE_SLOTS.length];
        const bandIndex = Math.floor(index / QUOTE_SLOTS.length);
        const topOffset = bandIndex * BAND_HEIGHT_REM + slot.top;

        return (
          <article
            className="community-quote-card"
            data-depth={slot.depth}
            key={quote.id}
            style={{
              left: `${slot.left}%`,
              top: `${topOffset}rem`,
              width: `${slot.width}%`,
              animationDelay: `${index * 0.45}s`,
              animationDuration: `${9 + (index % 4) * 1.35}s`,
              ["--quote-drift-x" as string]: slot.driftX,
              ["--quote-float-distance" as string]: slot.floatDistance,
              ["--quote-rotate" as string]: slot.rotate,
            }}
          >
            <div className="community-quote-card__glow" aria-hidden="true" />
            <div className="relative z-[1] flex items-start gap-2">
              <p aria-hidden="true" className="pt-0.5 text-xl leading-none text-gold/72">
                “
              </p>
              <blockquote className="community-quote-card__text text-[0.95rem] leading-7 text-sand/92 sm:text-[1.05rem] sm:leading-8">
                {getQuoteText(locale, quote)}
              </blockquote>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function CommunityQuotesCloud({
  desktopDisplayLimit,
  locale,
  mobileDisplayLimit,
  quotes,
}: {
  desktopDisplayLimit: number;
  locale: Locale;
  mobileDisplayLimit: number;
  quotes: CommunityQuote[];
}) {
  if (quotes.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="community-quotes-title"
      className="mx-auto max-w-[1360px] space-y-5"
    >
      <div className="space-y-2 px-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/52">
          {pick(locale, {
            en: "Community pulse",
            ru: "Пульс коммьюнити",
          })}
        </p>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <h2
            className="font-display text-3xl font-semibold uppercase tracking-[0.04em] text-sand md:text-4xl"
            id="community-quotes-title"
          >
            {pick(locale, {
              en: "Quotes the scene already knows by heart",
              ru: "Фразы, которые сцена уже знает наизусть",
            })}
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-white/66">
            {pick(locale, {
              en: "A moving wall of in-jokes, backstage wisdom, and the lines that keep coming back after every jam.",
              ru: "Живая стена внутренних мемов, сценической мудрости и фраз, которые возвращаются после каждого джема.",
            })}
          </p>
        </div>
      </div>

      <div className="community-quotes-stage rounded-[2rem] border border-white/10 px-4 py-5 md:px-5 md:py-6">
        <MobileQuotesStack
          locale={locale}
          mobileDisplayLimit={mobileDisplayLimit}
          quotes={quotes}
        />
        <DesktopQuotesWall
          desktopDisplayLimit={desktopDisplayLimit}
          locale={locale}
          quotes={quotes}
        />
      </div>
    </section>
  );
}
