import crypto from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

const db = new PrismaClient();
const sessionSecret = process.env.SESSION_SECRET ?? "ci-local-session-secret";
const sessionCookieName = process.env.SESSION_COOKIE_NAME ?? "jammers_session";
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3003";

function hashToken(rawToken: string) {
  return crypto.createHmac("sha256", sessionSecret).update(rawToken).digest("hex");
}

async function signInLocally(page: Page, username: string) {
  const user = await db.user.findUniqueOrThrow({
    where: { telegramUsername: username },
    select: { id: true },
  });
  const rawToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db.authSession.deleteMany({
    where: { userId: user.id },
  });

  await db.authSession.create({
    data: {
      tokenHash: hashToken(rawToken),
      userId: user.id,
      expiresAt,
      userAgent: "playwright-smoke",
      ipAddress: "127.0.0.1",
    },
  });

  await page.context().addCookies([
    {
      name: sessionCookieName,
      value: rawToken,
      url: appUrl,
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
      expires: Math.floor(expiresAt.getTime() / 1000),
    },
  ]);
}

test.afterAll(async () => {
  await db.$disconnect();
});

test.describe("Jammers smoke", () => {
  test("public pages render and nearest gig opens", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("link", { name: /About Us|О нас/i })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Open next gig board|Открыть борд ближайшего гига/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Read the FAQ|Открыть FAQ/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Released setlists|Опубликованные сетлисты/i })).toBeVisible();

    await page.getByRole("button", { name: /Open next gig board|Открыть борд ближайшего гига/i }).click();
    await expect(page).toHaveURL(/\/events\/[a-z0-9]+/i);
    await expect(page.locator("main")).toContainText(/FAQ|Gig|Гиг|сет/i);

    await page.goto("/faq");
    await expect(page.getByRole("heading", { name: /How The Jammers works|Как всё устроено у The Jammers/i })).toBeVisible();

    await page.goto("/about");
    await expect(page.getByRole("heading", { name: /About Us|О нас/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /People who keep the scene moving|Люди, которые двигают сцену дальше/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Reach the team|Связаться с командой/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Partners who amplify the night|Партнёры, которые усиливают вечер/i })).toBeVisible();
    await expect(page.locator("a[href*='replace_me']")).toHaveCount(0);

    await page.goto("/profile");
    await expect(
      page.getByRole("heading", {
        name: /Sign in to join songs and manage invites|Войди, чтобы вписываться в песни/i,
      }),
    ).toBeVisible();
  });

  test("user can sign in locally and join then release a seat", async ({ page }) => {
    await signInLocally(page, "anna_drums");

    await page.goto("/events/spring-jam-night");
    const joinButton = page
      .getByRole("button", { name: /Join|Вписаться|Request spot|Запросить место/i })
      .first();
    await expect(joinButton).toBeVisible({ timeout: 15_000 });
    await joinButton.click();

    await expect(
      page.getByRole("status").filter({ hasText: /You're in|Ты в лайнапе/i }),
    ).toBeVisible({ timeout: 15_000 });

    const releaseButton = page.getByRole("button", { name: /Release .*|Освободить /i }).first();
    await expect(releaseButton).toBeVisible();
    await releaseButton.click();

    await expect(
      page.getByRole("status").filter({ hasText: /Seat released|Место освобождено/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Join|Вписаться|Request spot|Запросить место/i }).first(),
    ).toBeVisible();
  });

  test("admin can sign in locally and open the admin cockpit", async ({ page }) => {
    await signInLocally(page, "kinteus");

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: /Open only the tool you need/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Create gig/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Open event admin/i }).first()).toBeVisible();
  });
});
