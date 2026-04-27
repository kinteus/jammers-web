import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CommunityQuotesCloud } from "@/components/community-quotes-cloud";

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

describe("CommunityQuotesCloud", () => {
  it("renders desktop quotes across the full home scroll area while keeping mobile stack", () => {
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
    expect(html).toContain("community-quotes-mobile-section");
    expect(html).toContain("community-quotes-mobile-stack");
    expect(html).toContain("--quote-top");
    expect(html).not.toContain("community-quotes-canvas");
  });

  it("spreads desktop quotes across distinct vertical positions", () => {
    const html = renderToStaticMarkup(
      <CommunityQuotesCloud
        desktopDisplayLimit={8}
        locale="ru"
        mobileDisplayLimit={2}
        quotes={quotes}
      />,
    );
    const quoteTops = [...html.matchAll(/--quote-top:([^;]+)%/g)].map((match) => match[1]);

    expect(quoteTops).toHaveLength(8);
    expect(new Set(quoteTops).size).toBe(8);
  });

  it("keeps ambient quote previews readable before hover", () => {
    const ambientRule = globalCss.match(/\.community-quote-card--ambient\s*\{[^}]+\}/)?.[0];
    const opacity = Number(ambientRule?.match(/opacity:\s*([0-9.]+)/)?.[1]);

    expect(opacity).toBeGreaterThanOrEqual(0.42);
  });

  it("reveals ambient quotes without moving the hover target away from the edge", () => {
    const hoverRule = globalCss.match(
      /\.community-quote-peek:hover\s+\.community-quote-card--ambient,\s*\.community-quote-peek:focus-within\s+\.community-quote-card--ambient\s*\{[^}]+\}/,
    )?.[0];

    expect(hoverRule).toContain("opacity: 1");
    expect(hoverRule).not.toContain("pointer-events: auto");
    expect(hoverRule).not.toContain("translate3d(var(--quote-open-x)");
  });

  it("keeps ambient previews in the viewport gutters instead of over section content", () => {
    const html = renderToStaticMarkup(
      <CommunityQuotesCloud
        desktopDisplayLimit={8}
        locale="ru"
        mobileDisplayLimit={2}
        quotes={quotes}
      />,
    );

    expect(html).toContain("community-quote-peek");
    expect(html).toContain("--quote-peek-width:11rem");
    expect(html).toContain("left:-2.75rem");
    expect(html).toContain("right:-2.75rem");
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
    expect(ambientRule).toContain("pointer-events: none");
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
  });
});
