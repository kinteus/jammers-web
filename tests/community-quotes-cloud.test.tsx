/**
 * @vitest-environment jsdom
 */
import React from "react";
import { readFileSync } from "node:fs";
import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CommunityQuotesCloud } from "@/components/community-quotes-cloud";
import { DismissibleAmbientQuote } from "@/components/dismissible-ambient-quote";

const quotes = [
  { id: "q1", textEn: "bass took the chat", textRu: "басисты захватили чат", sourceLabel: null },
  { id: "q2", textEn: "wrong chat", textRu: "это в другой чат", sourceLabel: null },
  { id: "q3", textEn: "ready?", textRu: "ну что, готовы?", sourceLabel: null },
  { id: "q4", textEn: "one more", textRu: "ещё одна фраза", sourceLabel: null },
  { id: "q5", textEn: "again", textRu: "и ещё фраза", sourceLabel: null },
  { id: "q6", textEn: "keep going", textRu: "продолжаем", sourceLabel: null },
  { id: "q7", textEn: "scroll", textRu: "скроллим дальше", sourceLabel: null },
  { id: "q8", textEn: "later", textRu: "дальше по странице", sourceLabel: null },
];

const globalCss = readFileSync("src/app/globals.css", "utf8");

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("React", React);
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("CommunityQuotesCloud", () => {
  it("renders one floating quote layer for every screen size", () => {
    const html = renderToStaticMarkup(
      <CommunityQuotesCloud
        desktopDisplayLimit={3}
        locale="ru"
        mobileDisplayLimit={2}
        quotes={quotes}
      />,
    );

    expect(html).toContain("community-quotes-perimeter");
    expect(html).toContain("community-quote-card--ambient");
    expect(html).not.toContain("community-quotes-mobile-section");
    expect(html).not.toContain("hidden min-[");
    expect(html).toContain('data-anchor="hero"');
    expect(html).not.toContain("community-quotes-canvas");
  });

  it("hides quotes past the mobile limit only on small screens", () => {
    const html = renderToStaticMarkup(
      <CommunityQuotesCloud
        desktopDisplayLimit={5}
        locale="en"
        mobileDisplayLimit={2}
        quotes={quotes}
      />,
    );

    expect(html.match(/community-quote-peek"/g)).toHaveLength(5);
    expect(html.match(/data-mobile-hidden=""/g)).toHaveLength(3);
    expect(globalCss).toMatch(
      /@media \(max-width: 1023px\)\s*\{\s*\.community-quote-peek\[data-mobile-hidden\]\s*\{\s*display: none;/,
    );
  });

  it("keeps quotes behind page content until a bubble is hovered or focused", () => {
    const rootRule = globalCss.match(/\.community-quotes-root\s*\{[^}]+\}/)?.[0];
    const raisedRule = globalCss.match(/\.community-quotes-root:has\([^)]*\)[^{]*\{[^}]+\}/)?.[0];
    const sectionRule = globalCss.match(
      /\.home-page-shell > section:not\(\.community-quotes-root\)\s*\{[^}]+\}/,
    )?.[0];

    expect(rootRule).toContain("z-index: 1");
    expect(sectionRule).toContain("z-index: 2");
    expect(sectionRule).toContain("pointer-events: none");
    expect(raisedRule).toContain(":hover");
    expect(raisedRule).toContain(":focus-within");
    expect(raisedRule).toContain("z-index: 3");
  });

  it("fills the section spots in order and stops at twelve", () => {
    const manyQuotes = Array.from({ length: 15 }, (_, index) => ({
      ...quotes[0]!,
      id: `many-${index}`,
    }));
    const spotsOf = (html: string) =>
      [...html.matchAll(/data-anchor="([^"]+)" data-align="([^"]+)" data-depth="[^"]+" data-edge="([^"]+)"/g)].map(
        (match) => `${match[1]}:${match[2]}:${match[3]}`,
      );

    const fewHtml = renderToStaticMarkup(
      <CommunityQuotesCloud desktopDisplayLimit={8} locale="ru" mobileDisplayLimit={2} quotes={quotes} />,
    );
    const allHtml = renderToStaticMarkup(
      <CommunityQuotesCloud desktopDisplayLimit={60} locale="ru" mobileDisplayLimit={2} quotes={manyQuotes} />,
    );

    expect(spotsOf(fewHtml)).toEqual(spotsOf(allHtml).slice(0, 8));
    expect(spotsOf(allHtml)).toEqual([
      "hero:start:left",
      "hero:middle:right",
      "hero:end:left",
      "next-gig:start:right",
      "next-gig:middle:left",
      "next-gig:end:right",
      "orientation:middle:left",
      "scene:start:left",
      "scene:upper-quarter:right",
      "scene:middle:left",
      "scene:lower-quarter:right",
      "scene:end:left",
    ]);
  });

  it("keeps bubbles hidden until they are placed next to their section", () => {
    expect(globalCss).toMatch(
      /\.community-quote-peek:not\(\[data-placed\]\)\s*\{\s*visibility: hidden;/,
    );
  });

  it("clips resting quotes to the strips outside the content column", () => {
    const clipRule = globalCss.match(
      /\.community-quotes-root:not\(:has\([^)]*\)\)\s*\.community-quotes-perimeter\s*\{[^}]+\}/,
    )?.[0];

    expect(globalCss).toMatch(/\.home-page-shell\s*\{\s*container-type: inline-size;/);
    expect(clipRule).toContain("calc(50% - 50cqw)");
    expect(clipRule).toContain("calc(50% + 50cqw)");
  });

  it("opens a hovered quote only as wide as its text", () => {
    const hoverRule = globalCss.match(
      /\.community-quote-peek:hover\s+\.community-quote-card--ambient,\s*\.community-quote-peek:focus-within\s+\.community-quote-card--ambient\s*\{[^}]+\}/,
    )?.[0];

    expect(hoverRule).toContain("width: max-content");
    expect(hoverRule).toContain("max-width: var(--quote-open-width)");
    expect(globalCss).not.toContain("translateX(calc((var(--quote-open-width)");
  });

  it("keeps ambient quote previews readable before hover", () => {
    const ambientRule = globalCss.match(/\.community-quote-card--ambient\s*\{[^}]+\}/)?.[0];
    const opacity = Number(ambientRule?.match(/opacity:\s*([0-9.]+)/)?.[1]);

    expect(opacity).toBeGreaterThanOrEqual(0.6);
  });

  it("reveals ambient quotes without moving the hover target away from the edge", () => {
    const hoverRule = globalCss.match(
      /\.community-quote-peek:hover\s+\.community-quote-card--ambient,\s*\.community-quote-peek:focus-within\s+\.community-quote-card--ambient\s*\{[^}]+\}/,
    )?.[0];

    expect(hoverRule).toContain("opacity: 1");
    expect(hoverRule).not.toContain("pointer-events: auto");
    expect(hoverRule).not.toContain("translate3d(var(--quote-open-x)");
  });

  it("keeps ambient previews in the page gutters instead of tying them to the viewport", () => {
    const html = renderToStaticMarkup(
      <CommunityQuotesCloud
        desktopDisplayLimit={8}
        locale="ru"
        mobileDisplayLimit={2}
        quotes={quotes}
      />,
    );

    expect(html).toContain("community-quote-peek");
    expect(html).toContain("--quote-peek-width:14rem");
    expect(html).toContain("left:max(1rem, env(safe-area-inset-left))");
    expect(html).toContain("right:max(1rem, env(safe-area-inset-right))");
  });

  it("uses narrow edge hover targets instead of clipped full-width cards", () => {
    const html = renderToStaticMarkup(
      <CommunityQuotesCloud
        desktopDisplayLimit={8}
        locale="ru"
        mobileDisplayLimit={2}
        quotes={quotes}
      />,
    );
    const peekRule = globalCss.match(/\.community-quote-peek\s*\{[^}]+\}/)?.[0];
    const ambientRule = globalCss.match(/\.community-quote-card--ambient\s*\{[^}]+\}/)?.[0];
    const textRule = globalCss.match(/\.community-quote-card__text\s*\{[^}]+\}/)?.[0];
    const compactTextRule = globalCss.match(
      /\.community-quote-peek:not\(:hover\):not\(:focus-within\)\s+\.community-quote-card__text\s*\{[^}]+\}/,
    )?.[0];

    expect(html).not.toContain("--quote-collapsed-clip");
    expect(html).not.toContain("width:var(--quote-card-width)");
    expect(peekRule).toContain("width: var(--quote-peek-width)");
    expect(peekRule).toContain("overflow: hidden");
    expect(peekRule).toContain("pointer-events: auto");
    expect(ambientRule).toContain("pointer-events: auto");
    expect(ambientRule).toContain("width: var(--quote-peek-width)");
    expect(textRule).toContain("min-width: 0");
    expect(compactTextRule).toContain("opacity: 0.82");
    expect(compactTextRule).toContain("-webkit-line-clamp: 1");
    expect(compactTextRule).toContain("padding-inline-end");
    expect(compactTextRule).toContain("text-overflow: ellipsis");
  });

  it("does not reveal every clipped sibling by raising the whole perimeter on hover", () => {
    expect(globalCss).toContain(".home-page-shell > section:not(.community-quotes-root)");
    expect(globalCss).toContain("pointer-events: none");
    expect(globalCss).toContain(".home-page-shell > section:not(.community-quotes-root) > *");
    expect(globalCss).toContain("pointer-events: auto");
    expect(globalCss).not.toContain(".community-quotes-perimeter:has(.community-quote-card--ambient:hover)");
    expect(globalCss).toContain(".community-quote-peek:hover");
    expect(globalCss).toContain(".community-quotes-root");
    expect(globalCss).toContain("position: absolute");
    expect(globalCss).toContain("width: 100vw");
    expect(globalCss).toContain("transform: translateX(-50%)");
    expect(globalCss).not.toContain("position: fixed");
  });

  it("lets users dismiss a quote that covers content", () => {
    render(
      <DismissibleAmbientQuote
        className="community-quote-card community-quote-card--ambient"
        depth="front"
        edge="left"
        style={{}}
      >
        мешающая цитата
      </DismissibleAmbientQuote>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Hide quote" }));

    expect(screen.queryByText("мешающая цитата")).toBeNull();
  });
});
