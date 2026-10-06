import { randomInt } from "node:crypto";
import React from "react";

import { pick, type Locale } from "@/lib/i18n";

import { DismissibleAmbientQuote } from "@/components/dismissible-ambient-quote";
import { QuoteSpotPlacer } from "@/components/quote-spot-placer";

type CommunityQuote = {
  id: string;
  textEn: string;
  textRu: string;
  sourceLabel: string | null;
};

// Each spot ties a bubble to a home section (data-quote-anchor) and a point on its height; the
// QuoteSpotPlacer turns that into a top offset once the page is laid out. Bubbles fill the spots
// in this order, so with fewer quotes only the first ones are used.
export const QUOTE_SPOTS = [
  { anchor: "hero", align: "start", edge: "left" },
  { anchor: "hero", align: "middle", edge: "right" },
  { anchor: "hero", align: "end", edge: "left" },
  { anchor: "next-gig", align: "start", edge: "right" },
  { anchor: "next-gig", align: "middle", edge: "left" },
  { anchor: "next-gig", align: "end", edge: "right" },
  { anchor: "orientation", align: "middle", edge: "left" },
  { anchor: "scene", align: "start", edge: "left" },
  { anchor: "scene", align: "upper-quarter", edge: "right" },
  { anchor: "scene", align: "middle", edge: "left" },
  { anchor: "scene", align: "lower-quarter", edge: "right" },
  { anchor: "scene", align: "end", edge: "left" },
] as const;

const QUOTE_LOOKS = [
  { depth: "front", rotate: "-1.4deg", driftX: "-1px", floatDistance: "5px" },
  { depth: "back", rotate: "1.8deg", driftX: "1px", floatDistance: "5px" },
  { depth: "mid", rotate: "-0.9deg", driftX: "1px", floatDistance: "6px" },
  { depth: "mid", rotate: "1.2deg", driftX: "-1px", floatDistance: "5px" },
  { depth: "back", rotate: "-1.8deg", driftX: "1px", floatDistance: "5px" },
  { depth: "front", rotate: "0.9deg", driftX: "-1px", floatDistance: "5px" },
] as const;

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

function QuotesPerimeter({
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
  const desktopQuotes = pickDisplayQuotes(
    quotes,
    Math.min(desktopDisplayLimit, QUOTE_SPOTS.length),
  );

  // The bubbles sit behind all page content (see .community-quotes-root in globals.css), so they
  // only show where nothing else is drawn. Phones show the first mobileDisplayLimit of them.
  return (
    <div className="community-quotes-perimeter">
      {desktopQuotes.map((quote, index) => {
        const spot = QUOTE_SPOTS[index]!;
        const look = QUOTE_LOOKS[index % QUOTE_LOOKS.length]!;
        const peekWidth = "14rem";
        const edgeOffset = "max(1rem, env(safe-area-inset-left))";
        const sideStyle =
          spot.edge === "left"
            ? {
                left: edgeOffset,
              }
            : {
                right: edgeOffset.replace("safe-area-inset-left", "safe-area-inset-right"),
              };

        return (
          <div
            className="community-quote-peek"
            data-anchor={spot.anchor}
            data-align={spot.align}
            data-depth={look.depth}
            data-edge={spot.edge}
            data-mobile-hidden={index >= mobileDisplayLimit ? "" : undefined}
            key={quote.id}
            style={{
              ...sideStyle,
              ["--quote-peek-width" as string]: peekWidth,
              ["--quote-drift-x" as string]: look.driftX,
              ["--quote-float-distance" as string]: look.floatDistance,
              ["--quote-rotate" as string]: look.rotate,
            }}
          >
            <DismissibleAmbientQuote
              className="community-quote-card community-quote-card--ambient"
              depth={look.depth}
              edge={spot.edge}
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
            </DismissibleAmbientQuote>
          </div>
        );
      })}
      <QuoteSpotPlacer />
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
      <QuotesPerimeter
        desktopDisplayLimit={desktopDisplayLimit}
        locale={locale}
        mobileDisplayLimit={mobileDisplayLimit}
        quotes={quotes}
      />
    </section>
  );
}
