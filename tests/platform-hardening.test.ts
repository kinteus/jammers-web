import { describe, expect, it, vi } from "vitest";

import nextConfig from "../next.config";
import robots from "@/app/robots";
import { metadata as aboutMetadata } from "@/app/about/page";
import { metadata as rootMetadata } from "@/app/layout";

const dbMock = vi.hoisted(() => ({
  event: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_APP_URL: "https://thejammers.org",
    NEXT_PUBLIC_TELEGRAM_BOT_USERNAME: "the_jammers_bot",
  },
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

describe("platform hardening", () => {
  it("serves blocking metadata to Telegram and hides framework fingerprinting", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
    expect(nextConfig.htmlLimitedBots).toBeInstanceOf(RegExp);
    expect(nextConfig.htmlLimitedBots?.test("TelegramBot (like TwitterBot)")).toBe(true);
  });

  it("does not allow eval in the production CSP", async () => {
    const headers = await nextConfig.headers?.();
    const globalHeaders = headers?.find((entry) => entry.source === "/(.*)")?.headers ?? [];
    const csp = globalHeaders.find((header) => header.key === "Content-Security-Policy")?.value;

    expect(csp).toBeDefined();
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it("keeps share images and icons available from root metadata", () => {
    expect(rootMetadata.icons).toMatchObject({
      icon: "/logo-mark.svg",
    });
    expect(rootMetadata.openGraph?.images).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ url: "/brand/the-jammers-logo.png" }),
      ]),
    );
    expect(rootMetadata.twitter?.images).toEqual(["/brand/the-jammers-logo.png"]);
  });

  it("gives About its own canonical and social metadata", () => {
    expect(aboutMetadata.alternates).toMatchObject({ canonical: "/about" });
    expect(aboutMetadata.openGraph).toMatchObject({
      url: "/about",
      title: "About Us",
    });
    expect(aboutMetadata.twitter).toMatchObject({
      title: "About Us",
    });
  });

  it("allows crawlers to read profile noindex while keeping private routes blocked", () => {
    const rules = robots().rules;
    expect(rules).toEqual([
      {
        userAgent: "*",
        allow: ["/", "/faq", "/about", "/events/", "/profile"],
        disallow: ["/admin/", "/api/"],
      },
    ]);
  });

  it("includes the About page in the sitemap", async () => {
    dbMock.event.findMany.mockResolvedValue([]);

    const { default: sitemap } = await import("@/app/sitemap");
    await expect(sitemap()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ url: "https://thejammers.org/about" }),
      ]),
    );
  });
});
