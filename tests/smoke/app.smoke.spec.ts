import crypto from "node:crypto";

import {
  EventStatus,
  PrismaClient,
  SetlistSection,
  TrackSeatStatus,
} from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

const db = new PrismaClient();
const sessionSecret = process.env.SESSION_SECRET ?? "local-development-session-secret";
const sessionCookieName = process.env.SESSION_COOKIE_NAME ?? "jammers_session";
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3003";
const smokeRunId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

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

function smokeSlug(label: string) {
  return `smoke-${label}-${smokeRunId}`.replace(/[^a-z0-9-]/g, "-").slice(0, 80);
}

async function getSmokeUser(username: string) {
  return db.user.findUniqueOrThrow({
    where: { telegramUsername: username },
    select: { id: true },
  });
}

async function createSmokeSong(title: string) {
  const artist = await db.artist.upsert({
    where: { slug: smokeSlug(`artist-${title}`) },
    update: {},
    create: {
      slug: smokeSlug(`artist-${title}`),
      name: `Smoke Artist ${title}`,
    },
  });

  return db.song.create({
    data: {
      artistId: artist.id,
      slug: smokeSlug(`song-${title}`),
      title,
      durationSeconds: 180,
    },
  });
}

async function createSmokeEvent({
  slug,
  title,
  status = EventStatus.OPEN,
}: {
  slug: string;
  title: string;
  status?: EventStatus;
}) {
  const instrument = await db.instrument.findFirst({
    where: { slug: "bass" },
    select: { id: true },
  });
  const event = await db.event.create({
    data: {
      slug,
      title,
      description: "Smoke test board",
      venueName: "Smoke Loft",
      startsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      registrationOpensAt: new Date(Date.now() - 60 * 60 * 1000),
      registrationClosesAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status,
      maxSetDurationMinutes: 24,
      maxTracksPerUser: 3,
    },
  });
  const slot = await db.eventLineupSlot.create({
    data: {
      eventId: event.id,
      instrumentId: instrument?.id,
      key: "bass",
      label: "Bass",
      seatCount: 1,
      allowOptional: true,
      displayOrder: 1,
    },
  });

  return { event, slot };
}

async function createSmokeTrack({
  eventId,
  slotId,
  songTitle,
  proposerUsername,
  claimedByUsername,
}: {
  eventId: string;
  slotId: string;
  songTitle: string;
  proposerUsername: string;
  claimedByUsername?: string;
}) {
  const proposer = await getSmokeUser(proposerUsername);
  const song = await createSmokeSong(songTitle);
  const track = await db.track.create({
    data: {
      eventId,
      songId: song.id,
      proposedById: proposer.id,
    },
  });
  const claimedBy = claimedByUsername ? await getSmokeUser(claimedByUsername) : null;
  await db.trackSeat.create({
    data: {
      trackId: track.id,
      lineupSlotId: slotId,
      label: "Bass",
      seatIndex: 1,
      status: claimedBy ? TrackSeatStatus.CLAIMED : TrackSeatStatus.OPEN,
      userId: claimedBy?.id,
      claimedAt: claimedBy ? new Date() : null,
    },
  });
  await db.setlistItem.create({
    data: {
      eventId,
      trackId: track.id,
      section: SetlistSection.BACKLOG,
      orderIndex: 1,
      editedById: proposer.id,
    },
  });

  return { song, track };
}

test.afterAll(async () => {
  await db.$disconnect();
});

test.describe("Jammers smoke", () => {
  test("public pages render and nearest gig opens", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("link", { name: /About Us|О нас/i })).toBeVisible();
    const nextGigLink = page.getByRole("link", {
      name: /Open next gig board|Открыть (сетлист|борд) ближайшего гига/i,
    });
    await expect(nextGigLink).toBeVisible();
    await expect(nextGigLink).toHaveAttribute("href", /\/events\/[a-z0-9-]+/i);
    await expect(page.getByRole("link", { name: /Read the FAQ|Открыть FAQ/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Setlists|Сетлисты/i }).first()).toHaveAttribute(
      "href",
      "/archive",
    );

    await nextGigLink.click();
    await expect(page).toHaveURL(/\/events\/[a-z0-9-]+/i);
    await expect(page.locator("main")).toContainText(/FAQ|Gig|Гиг|сет/i);
    await expect(
      page.locator("main a[href*='youtube.com']").filter({ hasText: /YouTube/i }).first(),
    ).toBeVisible();

    await page.goto("/faq");
    await expect(page.getByRole("heading", { name: /How The Jammers works|Как всё устроено у The Jammers/i })).toBeVisible();

    await page.goto("/about");
    await expect(page.getByRole("heading", { name: /About Us|О нас/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /People moving the scene forward|Люди, которые двигают сцену дальше/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Talk to the team|Написать команде/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Brands that lift the night|Бренды, которые усиливают вечер/i })).toBeVisible();
    await expect(page.locator("a[href*='replace_me']")).toHaveCount(0);

    await page.goto("/archive");
    await expect(page.getByRole("heading", { name: /Setlists|Сетлисты/i })).toBeVisible();

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

  test("board updates reach another signed-in session in realtime", async ({ browser }) => {
    const slug = smokeSlug("realtime");
    const { event, slot } = await createSmokeEvent({
      slug,
      title: "Smoke Realtime Board",
    });
    await createSmokeTrack({
      eventId: event.id,
      slotId: slot.id,
      songTitle: `Realtime Song ${smokeRunId}`,
      proposerUsername: "anna_drums",
    });

    const firstContext = await browser.newContext();
    const secondContext = await browser.newContext();
    const firstPage = await firstContext.newPage();
    const secondPage = await secondContext.newPage();

    try {
      await signInLocally(firstPage, "anna_drums");
      await signInLocally(secondPage, "mike_guitar");
      await firstPage.goto(`/events/${slug}`);
      await secondPage.goto(`/events/${slug}`);

      await firstPage.getByRole("button", { name: /Join Bass|Вписаться на Bass/i }).click();
      await expect(
        firstPage.getByRole("status").filter({ hasText: /You're in|Ты в лайнапе/i }),
      ).toBeVisible({ timeout: 15_000 });
      await expect(secondPage.getByText("@anna_drums").first()).toBeVisible({ timeout: 20_000 });
    } finally {
      await firstContext.close();
      await secondContext.close();
    }
  });

  test("proposer can add a song and edit its public track settings", async ({ page }) => {
    const slug = smokeSlug("proposal");
    const songTitle = `Smoke Proposal Song ${smokeRunId}`;
    const { event } = await createSmokeEvent({
      slug,
      title: "Smoke Proposal Board",
    });
    const song = await createSmokeSong(songTitle);

    await signInLocally(page, "mike_guitar");
    await page.goto(`/events/${slug}`);
    await page.getByRole("button", { name: /Add song|Добавить песню/i }).click();
    await page
      .getByPlaceholder(/Start typing a song title|Начни вводить название песни/i)
      .fill(songTitle);
    await page.getByRole("button", { name: new RegExp(songTitle) }).click();
    await page.getByRole("button", { name: /Publish proposal to board|Опубликовать трек/i }).click();

    await expect(page.getByText(songTitle).first()).toBeVisible({ timeout: 15_000 });

    await page.locator('summary[title="Track settings"]:visible').first().click();
    const settingsPanel = page.locator("details[open]:visible").first();
    const updatedComment = `Smoke updated comment ${smokeRunId}`;
    await settingsPanel.locator('textarea[name="comment"]').fill(updatedComment);
    await settingsPanel.getByRole("button", { name: /Save track settings|Сохранить настройки трека/i }).click();

    await expect(async () => {
      const track = await db.track.findFirstOrThrow({
        where: {
          eventId: event.id,
          songId: song.id,
        },
        select: { comment: true },
      });
      expect(track.comment).toBe(updatedComment);
    }).toPass({ timeout: 15_000 });
  });

  test("header sign-in returns the user to the original about page", async ({ page }) => {
    await page.goto("/about");

    await page.getByRole("button", { name: /Sign in|Войти/i }).first().click();
    await expect(page).toHaveURL(/\/profile\?returnTo=/i);

    await page.getByLabel(/Telegram username|Telegram-ник/i).fill("anna_drums");
    await page.getByRole("button", { name: /Continue locally|Продолжить локально/i }).click();

    await expect(page).toHaveURL(/\/about(?:\?auth=\d+)?$/i);
    await expect(page.getByRole("heading", { name: /About Us|О нас/i })).toBeVisible();
  });

  test("admin can sign in locally and open the admin cockpit", async ({ page }) => {
    await signInLocally(page, "kinteus");

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: /Open only the tool you need/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Create gig/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Open event admin/i }).first()).toBeVisible();
  });

  test("admin confirms before running the selection algorithm", async ({ page }) => {
    const slug = smokeSlug("selection");
    const { event, slot } = await createSmokeEvent({
      slug,
      title: "Smoke Selection Board",
    });
    await createSmokeTrack({
      eventId: event.id,
      slotId: slot.id,
      songTitle: `Selection Song ${smokeRunId}`,
      proposerUsername: "anna_drums",
      claimedByUsername: "anna_drums",
    });
    const admin = await getSmokeUser("kinteus");
    await db.eventEditLock.create({
      data: {
        eventId: event.id,
        userId: admin.id,
        scope: "setlist-curation",
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    await signInLocally(page, "kinteus");
    await page.goto(`/admin/events/${slug}`);

    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toMatch(/Run the selection algorithm|Запустить алгоритм отбора/i);
      await dialog.dismiss();
    });
    await page.getByRole("button", { name: /Run selection algorithm|Запустить алгоритм отбора/i }).click();
    await expect
      .poll(async () => {
        const fresh = await db.event.findUniqueOrThrow({
          where: { id: event.id },
          select: { status: true },
        });
        return fresh.status;
      })
      .toBe(EventStatus.OPEN);

    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toMatch(/Run the selection algorithm|Запустить алгоритм отбора/i);
      await dialog.accept();
    });
    await page.getByRole("button", { name: /Run selection algorithm|Запустить алгоритм отбора/i }).click();
    await expect(page.getByText(/Selection finished|Отбор завершён/i)).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => {
        const fresh = await db.event.findUniqueOrThrow({
          where: { id: event.id },
          select: { status: true },
        });
        return fresh.status;
      })
      .toBe(EventStatus.CLOSED);
  });
});
