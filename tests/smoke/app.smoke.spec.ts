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
    const nextGigSection = page.locator("section").filter({
      has: page.getByRole("heading", { name: /Next gig|Следующий гиг/i }),
    });
    await expect(nextGigSection).toHaveCount(1);
    await expect(nextGigSection.getByText(/^Date$/)).toHaveCount(0);
    await expect(nextGigSection.getByText(/^Time$/)).toHaveCount(0);
    await expect(nextGigSection.getByText(/^Дата$/)).toHaveCount(0);
    await expect(nextGigSection.getByText(/^Время$/)).toHaveCount(0);
    await expect(nextGigSection.getByText(/^(Place|Location|Место)$/)).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Read the FAQ|Открыть FAQ/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Setlists|Сетлисты/i }).first()).toHaveAttribute(
      "href",
      "/archive",
    );

    await nextGigLink.click();
    await expect(page).toHaveURL(/\/events\/[a-z0-9-]+/i);
    await expect(page.locator("main")).toContainText(/FAQ|Gig|Гиг|сет/i);
    await expect(page.locator("main a[href*='youtube.com/results']").first()).toBeVisible();

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

    const releaseButton = page.getByRole("button", { name: /Release .*|Освободить /i }).first();
    await expect(releaseButton).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("@anna_drums").first()).toBeVisible();
    await releaseButton.click();

    await expect(
      page.getByRole("button", { name: /Join|Вписаться|Request spot|Запросить место/i }).first(),
    ).toBeVisible({ timeout: 15_000 });
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
      await expect(firstPage.getByRole("button", { name: /Release Bass|Освободить Bass/i })).toBeVisible({
        timeout: 15_000,
      });
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
    await page.getByRole("button", { name: /I’m in|I'm in|Я играю/i }).click();
    await page.getByRole("button", { name: /Publish proposal to board|Опубликовать трек/i }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 15_000 });
    await expect(
      page.locator("main a[href*='youtube.com/results']").filter({ hasText: songTitle }).first(),
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: /Edit track|Редактировать трек/i }).first().click();
    const editDialog = page.getByRole("dialog").filter({ hasText: songTitle });
    await expect(editDialog).toBeVisible();
    const updatedComment = `Smoke updated comment ${smokeRunId}`;
    await editDialog.locator('textarea[name="comment"]').fill(updatedComment);
    await editDialog.getByRole("button", { name: /Save changes|Сохранить изменения/i }).click();

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

  test("production sign-in never exposes development impersonation", async ({ page }) => {
    await page.goto("/about");
    await page.getByRole("button", { name: /Sign in|Войти/i }).first().click();
    await expect(page).toHaveURL(/\/profile\?returnTo=/i);
    await expect(page.getByRole("button", { name: /Continue locally|Продолжить локально/i })).toHaveCount(0);
    await expect(page.locator('input[name="devUserId"]')).toHaveCount(0);
  });

  test("board search preserves fast typing and combines with the musician filter", async ({ page }) => {
    const { event, slot } = await createSmokeEvent({ slug: smokeSlug("filters"), title: "Smoke filters" });
    const { song } = await createSmokeTrack({ eventId: event.id, slotId: slot.id, songTitle: "FilterTarget", proposerUsername: "kinteus", claimedByUsername: "anna_drums" });
    await createSmokeTrack({ eventId: event.id, slotId: slot.id, songTitle: "Other song", proposerUsername: "kinteus" });
    const anna = await getSmokeUser("anna_drums");
    await page.goto(`/events/${event.id}`);
    const search = page.getByRole("textbox", { name: /Search songs|Искать песни/ });
    // Keep the first RSC response in flight while the user continues typing.
    await page.route(`**/events/${event.id}?**`, async (route) => {
      if (new URL(route.request().url()).searchParams.get("q") === "Filter") {
        await new Promise((resolve) => setTimeout(resolve, 700));
      }
      await route.continue();
    });
    const firstSearchRequest = page.waitForRequest((request) => new URL(request.url()).searchParams.get("q") === "Filter");
    await search.fill("Filter");
    await firstSearchRequest;
    await search.pressSequentially("Target", { delay: 10 });
    await expect(search).toHaveValue(song.title);
    await expect(page).toHaveURL(/q=FilterTarget/);
    await expect(search).toHaveValue(song.title);
    const participant = page.getByRole("combobox", { name: /Filter by musician|Фильтр по музыканту/ });
    await participant.selectOption(anna.id);
    await expect(page).toHaveURL(new RegExp(`participant=${anna.id}`));
    await expect(page.locator("main a[href*='youtube.com/results']").filter({ hasText: song.title }).first()).toBeVisible();
    await search.fill("");
    await expect(page).toHaveURL(new RegExp(`/events/${event.id}\\?participant=${anna.id}$`));
    await expect(page.locator("main a[href*='youtube.com/results']").filter({ hasText: "Other song" })).toHaveCount(0);
    await page.getByRole("button", { name: /^(Clear|Сбросить)$/ }).click();
    await expect(search).toHaveValue("");
    await expect(participant).toHaveValue("");
    await expect(page.locator("main a[href*='youtube.com/results']").filter({ hasText: "Other song" }).first()).toBeVisible();
  });

  test("invitations show no directory until a musician is searched", async ({ page }) => {
    const { event, slot } = await createSmokeEvent({ slug: smokeSlug("invite-search"), title: "Smoke invite search" });
    await createSmokeTrack({ eventId: event.id, slotId: slot.id, songTitle: "Invite search", proposerUsername: "kinteus" });
    await signInLocally(page, "kinteus");
    await page.goto(`/events/${event.id}`);
    await page.getByRole("button", { name: /Invite player to Bass|Позвать музыканта на Bass/ }).first().click();
    const input = page.getByRole("textbox", { name: /Search registered musicians|Поиск зарегистрированных музыкантов/ });
    const invite = input.locator("xpath=ancestor::form");
    await expect(invite.getByRole("button", { name: /@anna_drums/ })).toHaveCount(0);
    await input.fill("anna");
    await expect(invite.getByRole("button", { name: /@anna_drums/ })).toBeVisible();
    await input.fill("");
    await expect(invite.getByRole("button", { name: /@anna_drums/ })).toHaveCount(0);
  });

  test("admin can sign in locally and open the admin cockpit", async ({ page }) => {
    await signInLocally(page, "kinteus");

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: /Open only the tool you need/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Create gig/i })).toBeVisible();
    const eventAdminLink = page.getByRole("link", { name: /Open event admin/i }).first();
    await expect(eventAdminLink).toBeVisible();
    const eventAdminHref = await eventAdminLink.getAttribute("href");
    await eventAdminLink.click();
    await expect(page).toHaveURL(new RegExp(`${eventAdminHref}$`));
    await expect(page.getByText("Loading gig admin…", { exact: true })).toHaveCount(0);
    await expect(page.locator("form input[name='eventId']").first()).toBeAttached();
  });

  test("admin manages each song from a single searchable row", async ({ page }) => {
    const { event, slot } = await createSmokeEvent({ slug: smokeSlug("unified-songs"), title: "Unified Songs" });
    const { track } = await createSmokeTrack({ eventId: event.id, slotId: slot.id,
      songTitle: `Unified Song ${smokeRunId}`, proposerUsername: "anna_drums" });
    const song = await createSmokeSong(`Unselected Song ${smokeRunId}`);
    const unselected = await db.track.create({ data: { eventId: event.id, songId: song.id, proposedById: track.proposedById } });
    await signInLocally(page, "kinteus");
    await page.goto(`/admin/events/${event.id}`);
    await page.getByRole("link", { name: /Manage songs/ }).click();
    await expect(page.getByText("Track administration", { exact: true })).toHaveCount(0);
    const row = page.locator(`[data-song-row="${track.id}"]`);
    await expect(row).toHaveCount(1);
    await row.locator("summary").click();
    await expect(row.getByLabel("Replacement song")).toBeVisible();
    await expect(row.getByRole("button", { name: "Replace song", exact: true })).toBeVisible();
    await expect(row.getByRole("button", { name: "Delete track", exact: true })).toBeVisible();
    await expect(row.getByLabel("Track notes")).toBeVisible();
    await expect(row.getByRole("button", { name: "Save track settings", exact: true })).toBeVisible();
    await expect(row.getByLabel("Search registered musicians")).toBeVisible();
    await expect(row.getByRole("button", { name: "Needs full required line-up", exact: true })).toBeDisabled();
    await row.getByLabel("Track notes").fill("Edited in the unified list");
    await row.getByRole("button", { name: "Save track settings", exact: true }).click();
    await expect.poll(async () => (await db.track.findUniqueOrThrow({ where: { id: track.id } })).comment).toBe("Edited in the unified list");
    await page.getByLabel("Find a song or musician").fill("Unselected Song");
    await expect(row).toBeHidden();
    const unselectedRow = page.locator(`[data-song-row="${unselected.id}"]`);
    await expect(unselectedRow).toHaveCount(1);
    await expect(unselectedRow).toBeVisible();
    await unselectedRow.locator("summary").click();
    await expect(unselectedRow.getByLabel("Track notes")).toBeVisible();
    await page.getByLabel("Find a song or musician").fill("");
    await expect(row).toBeVisible();
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
    await expect(page.getByText(/Drums: unassigned .* 1 song|Барабаны: не назначен .* 1 трек/i)).toBeVisible();
    await expect
      .poll(async () => {
        const fresh = await db.event.findUniqueOrThrow({
          where: { id: event.id },
          select: {
            setlistItems: {
              select: { section: true },
            },
            status: true,
          },
        });
        return {
          mainSetItems: fresh.setlistItems.filter((item) => item.section === SetlistSection.MAIN).length,
          status: fresh.status,
        };
      })
      .toEqual({
        mainSetItems: 1,
        status: EventStatus.OPEN,
      });
  });
});
