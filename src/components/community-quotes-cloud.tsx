import { randomInt } from "node:crypto";
import React from "react";

import { pick, type Locale } from "@/lib/i18n";

type CommunityQuote = {
  id: string;
  textEn: string;
  textRu: string;
  sourceLabel: string | null;
};

const QUOTE_SLOTS = [
  {
    edge: "left",
    x: -13.4,
    topNudge: -1,
    width: 18,
    depth: "front",
    rotate: "-1.4deg",
    driftX: "-1px",
    floatDistance: "5px",
  },
  {
    edge: "right",
    x: -13.8,
    topNudge: 1,
    width: 18,
    depth: "back",
    rotate: "1.8deg",
    driftX: "1px",
    floatDistance: "5px",
  },
  {
    edge: "left",
    x: -14.8,
    topNudge: 0,
    width: 19,
    depth: "mid",
    rotate: "-0.9deg",
    driftX: "1px",
    floatDistance: "6px",
  },
  {
    edge: "right",
    x: -14.6,
    topNudge: -1,
    width: 20,
    depth: "mid",
    rotate: "1.2deg",
    driftX: "-1px",
    floatDistance: "5px",
  },
  {
    edge: "left",
    x: -13.8,
    topNudge: 1,
    width: 19,
    depth: "back",
    rotate: "-1.8deg",
    driftX: "1px",
    floatDistance: "5px",
  },
  {
    edge: "right",
    x: -13.4,
    topNudge: 0,
    width: 20,
    depth: "front",
    rotate: "0.9deg",
    driftX: "-1px",
    floatDistance: "5px",
  },
  {
    edge: "left",
    x: -15,
    topNudge: -1,
    width: 19,
    depth: "mid",
    rotate: "-1.1deg",
    driftX: "1px",
    floatDistance: "5px",
  },
  {
    edge: "right",
    x: -15,
    topNudge: 1,
    width: 20,
    depth: "back",
    rotate: "1.5deg",
    driftX: "-1px",
    floatDistance: "6px",
  },
  {
    edge: "left",
    x: -13.8,
    topNudge: 0,
    width: 20,
    depth: "front",
    rotate: "-1.2deg",
    driftX: "1px",
    floatDistance: "5px",
  },
  {
    edge: "right",
    x: -13.8,
    topNudge: -1,
    width: 19,
    depth: "mid",
    rotate: "0.8deg",
    driftX: "-1px",
    floatDistance: "5px",
  },
  {
    edge: "left",
    x: -15.4,
    topNudge: 1,
    width: 18,
    depth: "back",
    rotate: "-1deg",
    driftX: "1px",
    floatDistance: "5px",
  },
] as const;

const MAX_DESKTOP_AMBIENT_QUOTES = 14;

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

function getAmbientQuoteTop(index: number, total: number, topNudge: number) {
  if (total <= 1) {
    return 50;
  }

  const rawTop = 6 + (index / (total - 1)) * 88 + topNudge;
  return Math.min(96, Math.max(4, rawTop));
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

function DesktopQuotesPerimeter({
  desktopDisplayLimit,
  locale,
  quotes,
}: {
  desktopDisplayLimit: number;
  locale: Locale;
  quotes: CommunityQuote[];
}) {
  const desktopQuotes = pickDisplayQuotes(
    quotes,
    Math.min(desktopDisplayLimit, MAX_DESKTOP_AMBIENT_QUOTES),
  );
  const layoutOffset = randomInt(QUOTE_SLOTS.length);

  return (
    <div className="community-quotes-perimeter hidden xl:block" aria-hidden="true">
      {desktopQuotes.map((quote, index) => {
        const slot = QUOTE_SLOTS[(index + layoutOffset) % QUOTE_SLOTS.length];
        const peekWidth = "11rem";
        const edgeOffset = 4;
        const sideStyle =
          slot.edge === "left"
            ? {
                left: `-${edgeOffset}rem`,
              }
            : {
                right: `-${edgeOffset}rem`,
              };

        return (
          <div
            className="community-quote-peek"
            data-depth={slot.depth}
            data-edge={slot.edge}
            key={quote.id}
            style={{
              ...sideStyle,
              ["--quote-card-width" as string]: `${slot.width}rem`,
              ["--quote-peek-width" as string]: peekWidth,
              ["--quote-top" as string]: `${getAmbientQuoteTop(
                index,
                desktopQuotes.length,
                slot.topNudge,
              )}%`,
              ["--quote-drift-x" as string]: slot.driftX,
              ["--quote-float-distance" as string]: slot.floatDistance,
              ["--quote-rotate" as string]: slot.rotate,
            }}
          >
            <article
              className="community-quote-card community-quote-card--ambient"
              data-depth={slot.depth}
              data-edge={slot.edge}
              style={{
                animationDelay: `${index * 0.28}s`,
                animationDuration: `${11 + (index % 4) * 1.6}s`,
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
          </div>
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
      className="community-quotes-root"
    >
      <h2 className="sr-only" id="community-quotes-title">
        {pick(locale, {
          en: "Quotes the scene already knows by heart",
          ru: "Фразы, которые сцена уже знает наизусть",
        })}
      </h2>
      <div className="community-quotes-mobile-section mx-auto max-w-[1360px] space-y-5 sm:hidden">
        <div className="space-y-2 px-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/52">
            {pick(locale, {
              en: "Community pulse",
              ru: "Пульс коммьюнити",
            })}
          </p>
          <h3 className="font-display text-3xl font-semibold uppercase tracking-[0.04em] text-sand">
            {pick(locale, {
              en: "Quotes the scene already knows by heart",
              ru: "Фразы, которые сцена уже знает наизусть",
            })}
          </h3>
          <p className="max-w-2xl text-sm leading-6 text-white/66">
            {pick(locale, {
              en: "A moving wall of in-jokes, backstage wisdom, and the lines that keep coming back after every jam.",
              ru: "Живая стена внутренних мемов, сценической мудрости и фраз, которые возвращаются после каждого джема.",
            })}
          </p>
        </div>

        <div className="community-quotes-stage rounded-[2rem] border border-white/10 px-4 py-5">
          <MobileQuotesStack
            locale={locale}
            mobileDisplayLimit={mobileDisplayLimit}
            quotes={quotes}
          />
        </div>
      </div>
      <DesktopQuotesPerimeter
        desktopDisplayLimit={desktopDisplayLimit}
        locale={locale}
        quotes={quotes}
      />
    </section>
  );
}
