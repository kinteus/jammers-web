import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import {
  EventStatus,
  SetlistSection,
  TrackSeatStatus,
  UserRole,
  type Prisma,
} from "@prisma/client";
import XLSX from "xlsx";

import { db } from "@/lib/db";
import {
  isJamsSnapshotSheet,
  parseJamsSnapshotSheet,
  type ParsedJamsSnapshotEvent,
  type ParsedJamsSnapshotTrack,
} from "@/lib/legacy-jams-snapshot";
import { buildSongUpsertArgs } from "@/lib/song-identity";
import { slugify } from "@/lib/utils";

type Mode = "analyze" | "dry-run" | "apply" | "finalize";

type SongIdentity = {
  itunesTrackId: string | null;
  artistName: string;
  trackTitle: string;
  durationSeconds: number | null;
};

type ItunesSongResult = {
  wrapperType?: string;
  kind?: string;
  trackId?: number;
  trackName?: string;
  artistName?: string;
  trackTimeMillis?: number;
};

const DEFAULT_WORKBOOK_PATH = "/Users/maksimnaumov/Downloads/Jams_db_snapshot.xlsx";
const CACHE_PATH = path.join(process.cwd(), ".tmp", "jams-itunes-cache.json");
const ITUNES_DELAY_MS = Number(process.env.JAMS_ITUNES_DELAY_MS ?? 1200);
const importerUsername = "legacy_import";
const optionalBySlot = new Map([
  ["vocals", true],
  ["guitar", true],
  ["keys", true],
  ["bass", false],
  ["drums", false],
]);
const execFileAsync = promisify(execFile);

function parseArgs() {
  const mode = (process.argv[2] ?? "analyze") as Mode;
  if (!["analyze", "dry-run", "apply", "finalize"].includes(mode)) {
    throw new Error("Usage: npm run import:jams-snapshot -- analyze|dry-run|apply|finalize [workbook.xlsx]");
  }

  return {
    mode,
    workbookPath: process.argv[3] ?? DEFAULT_WORKBOOK_PATH,
  };
}

function loadWorkbookEvents(workbookPath: string) {
  const workbook = XLSX.readFile(workbookPath);
  const onlySheet = process.env.JAMS_ONLY_SHEET;
  return workbook.SheetNames.filter(isJamsSnapshotSheet)
    .filter((sheetName) => !onlySheet || sheetName === onlySheet)
    .map((sheetName) => {
      const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
        header: 1,
        defval: "",
        raw: false,
      });
      return parseJamsSnapshotSheet(sheetName, rows);
    })
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9а-яё]+/gi, " ")
    .trim();
}

function songKey(track: Pick<ParsedJamsSnapshotTrack, "artistName" | "songTitle">) {
  return `${track.artistName.toLocaleLowerCase()}::${track.songTitle.toLocaleLowerCase()}`;
}

function loadItunesCache() {
  if (!existsSync(CACHE_PATH)) {
    return new Map<string, SongIdentity | null>();
  }

  return new Map<string, SongIdentity | null>(JSON.parse(readFileSync(CACHE_PATH, "utf8")));
}

async function saveItunesCache(cache: Map<string, SongIdentity | null>) {
  await mkdir(path.dirname(CACHE_PATH), { recursive: true });
  writeFileSync(CACHE_PATH, JSON.stringify([...cache.entries()], null, 2));
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

class ItunesRetryableError extends Error {}

function isSongResult(entry: ItunesSongResult) {
  return (
    entry.wrapperType === "track" &&
    entry.kind === "song" &&
    typeof entry.trackId === "number" &&
    typeof entry.trackName === "string" &&
    typeof entry.artistName === "string"
  );
}

function rankItunesResult(
  entry: Required<Pick<ItunesSongResult, "trackId" | "trackName" | "artistName">> &
    ItunesSongResult,
  track: ParsedJamsSnapshotTrack,
) {
  const expectedArtist = normalizeSearchText(track.artistName);
  const expectedTitle = normalizeSearchText(track.songTitle);
  const foundArtist = normalizeSearchText(entry.artistName);
  const foundTitle = normalizeSearchText(entry.trackName);
  let score = 0;

  if (foundTitle === expectedTitle) {
    score += 100;
  } else if (foundTitle.includes(expectedTitle) || expectedTitle.includes(foundTitle)) {
    score += 45;
  }

  if (foundArtist === expectedArtist) {
    score += 60;
  } else if (foundArtist.includes(expectedArtist) || expectedArtist.includes(foundArtist)) {
    score += 25;
  }

  return score;
}

async function fetchItunesIdentity(track: ParsedJamsSnapshotTrack) {
  const url = new URL("https://itunes.apple.com/search");
  url.searchParams.set("term", `${track.artistName} ${track.songTitle}`.toLocaleLowerCase());
  url.searchParams.set("media", "music");
  url.searchParams.set("entity", "song");
  url.searchParams.set("country", "US");
  url.searchParams.set("limit", "10");

  let payload: { results?: ItunesSongResult[] };
  try {
    const { stdout } = await execFileAsync("curl", [
      "-sL",
      "--max-time",
      "20",
      url.toString(),
    ]);
    payload = JSON.parse(stdout) as { results?: ItunesSongResult[] };
  } catch (error) {
    throw new ItunesRetryableError(
      `iTunes curl lookup failed for ${track.artistName} - ${track.songTitle}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  const ranked = (payload.results ?? [])
    .filter(isSongResult)
    .map((entry) => ({
      entry,
      score: rankItunesResult(
        entry as Required<Pick<ItunesSongResult, "trackId" | "trackName" | "artistName">> &
          ItunesSongResult,
        track,
      ),
    }))
    .filter(({ score }) => score >= 100)
    .sort((a, b) => b.score - a.score);
  const best = ranked[0]?.entry;
  if (!best?.trackId || !best.trackName || !best.artistName) {
    return null;
  }

  return {
    itunesTrackId: String(best.trackId),
    artistName: best.artistName,
    trackTitle: best.trackName,
    durationSeconds: best.trackTimeMillis ? Math.round(best.trackTimeMillis / 1000) : null,
  };
}

async function fetchItunesIdentityWithRetry(track: ParsedJamsSnapshotTrack) {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return await fetchItunesIdentity(track);
    } catch (error) {
      lastError = error;
      if (!(error instanceof ItunesRetryableError)) {
        throw error;
      }
      const backoffMs = attempt * 5000;
      console.warn(`${error.message}; retrying in ${backoffMs}ms`);
      await sleep(backoffMs);
    }
  }

  console.warn(
    `${lastError instanceof Error ? lastError.message : String(lastError)}; leaving unmatched after retries.`,
  );
  return null;
}

async function resolveItunesIdentities(events: ParsedJamsSnapshotEvent[], mode: Mode) {
  const cache = loadItunesCache();
  const skipMissingLookups = process.env.JAMS_SKIP_ITUNES === "1";
  const uniqueTracks = new Map<string, ParsedJamsSnapshotTrack>();

  for (const event of events) {
    for (const track of event.tracks) {
      uniqueTracks.set(songKey(track), track);
    }
  }

  if (mode !== "analyze" && !skipMissingLookups) {
    let checked = 0;
    for (const [key, track] of uniqueTracks.entries()) {
      if (!cache.has(key)) {
        await sleep(ITUNES_DELAY_MS);
        cache.set(key, await fetchItunesIdentityWithRetry(track));
        checked += 1;
        await saveItunesCache(cache);
        if (checked % 50 === 0) {
          console.log(`Resolved ${checked} new iTunes lookups...`);
        }
      }
    }
    await saveItunesCache(cache);
  }

  return cache;
}

function getSourceSummary(events: ParsedJamsSnapshotEvent[], identities: Map<string, SongIdentity | null>) {
  const usernames = new Set<string>();
  const originators = new Set<string>();
  let claimedSeats = 0;

  for (const event of events) {
    for (const track of event.tracks) {
      if (track.originatorUsername) {
        originators.add(track.originatorUsername);
      }
      for (const seat of track.seats) {
        if (seat.status === TrackSeatStatus.CLAIMED && seat.username) {
          usernames.add(seat.username);
          claimedSeats += 1;
        }
      }
    }
  }

  const identitiesList = [...identities.values()];
  return {
    events: events.length,
    tracks: events.reduce((sum, event) => sum + event.tracks.length, 0),
    uniqueSourceSongs: new Set(events.flatMap((event) => event.tracks.map(songKey))).size,
    uniqueUsernames: usernames.size,
    uniqueOriginators: originators.size,
    claimedSeats,
    itunesMatched: identitiesList.filter((identity) => identity?.itunesTrackId).length,
    itunesUnmatched: identitiesList.filter((identity) => identity === null).length,
    itunesCachedEntries: identitiesList.length,
  };
}

function levenshtein(left: string, right: string) {
  const dp = Array.from({ length: left.length + 1 }, (_, i) =>
    Array.from({ length: right.length + 1 }, (__, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );

  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      dp[i][j] =
        left[i - 1] === right[j - 1]
          ? dp[i - 1][j - 1]
          : Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1;
    }
  }

  return dp[left.length][right.length];
}

async function loadDbPlan(events: ParsedJamsSnapshotEvent[]) {
  const existingUsers = await db.user.findMany({
    select: { id: true, telegramUsername: true, fullName: true, role: true },
  });
  const usersByLower = new Map<string, typeof existingUsers>();

  for (const user of existingUsers) {
    if (!user.telegramUsername) {
      continue;
    }
    const key = user.telegramUsername.toLowerCase();
    usersByLower.set(key, [...(usersByLower.get(key) ?? []), user]);
  }

  const sourceUsers = new Set<string>();
  for (const event of events) {
    for (const track of event.tracks) {
      if (track.originatorUsername) {
        sourceUsers.add(track.originatorUsername);
      }
      for (const seat of track.seats) {
        if (seat.username) {
          sourceUsers.add(seat.username);
        }
      }
    }
  }

  const caseCollisions = [...usersByLower.entries()].filter(([, users]) => users.length > 1);
  const usersToCreate = [...sourceUsers].filter((username) => !usersByLower.has(username));
  const suspiciousUserMatches = usersToCreate
    .flatMap((username) =>
      [...usersByLower.keys()]
        .filter((existing) => Math.abs(existing.length - username.length) <= 2)
        .map((existing) => ({ username, existing, distance: levenshtein(username, existing) }))
        .filter((entry) => entry.distance > 0 && entry.distance <= 2),
    )
    .slice(0, 100);

  const existingLegacyEvents = await db.event.findMany({
    where: { slug: { startsWith: "legacy-" } },
    select: { id: true, slug: true, title: true, startsAt: true },
  });
  const sourceDateKeys = new Set(events.map((event) => dateKey(event.startsAt)));
  const orphanLegacyEvents = existingLegacyEvents.filter(
    (event) => !sourceDateKeys.has(dateKey(event.startsAt)),
  );

  return {
    caseCollisions,
    usersToCreate,
    suspiciousUserMatches,
    existingLegacyEvents: existingLegacyEvents.length,
    orphanLegacyEvents,
  };
}

async function ensureImporter(tx: Prisma.TransactionClient) {
  return tx.user.upsert({
    where: { telegramUsername: importerUsername },
    update: { role: UserRole.ADMIN, fullName: "Legacy Import" },
    create: {
      telegramUsername: importerUsername,
      fullName: "Legacy Import",
      role: UserRole.ADMIN,
      bio: "System user for imported historical setlists.",
    },
    select: { id: true, telegramUsername: true },
  });
}

async function ensureUser(
  tx: Prisma.TransactionClient,
  username: string,
  cache: Map<string, { id: string; telegramUsername: string | null }>,
) {
  const cached = cache.get(username);
  if (cached) {
    return cached;
  }

  const user = await tx.user.upsert({
    where: { telegramUsername: username },
    update: {},
    create: {
      telegramUsername: username,
      fullName: username,
      role: UserRole.USER,
    },
    select: { id: true, telegramUsername: true },
  });
  cache.set(username, user);
  return user;
}

async function ensureSong(
  tx: Prisma.TransactionClient,
  track: ParsedJamsSnapshotTrack,
  identity: SongIdentity | null | undefined,
) {
  const artistName = identity?.artistName ?? track.artistName;
  const trackTitle = identity?.trackTitle ?? track.songTitle;
  const durationSeconds = identity?.durationSeconds ?? 0;
  const externalId = identity?.itunesTrackId ?? null;
  const artist = await tx.artist.upsert({
    where: { slug: slugify(artistName) },
    update: { name: artistName },
    create: { slug: slugify(artistName), name: artistName },
  });

  if (externalId) {
    const existingByItunes = await tx.song.findUnique({ where: { itunesTrackId: externalId } });
    if (existingByItunes) {
      return tx.song.update({
        where: { id: existingByItunes.id },
        data: {
          title: trackTitle,
          artistId: artist.id,
          durationSeconds: durationSeconds > 0 ? durationSeconds : existingByItunes.durationSeconds,
        },
      });
    }
  }

  return tx.song.upsert({
    ...buildSongUpsertArgs({
      artistId: artist.id,
      artistName,
      trackTitle,
      durationSeconds,
      externalId,
    }),
  });
}

async function findExistingLegacyEventForDate(tx: Prisma.TransactionClient, event: ParsedJamsSnapshotEvent) {
  const start = new Date(event.startsAt);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return tx.event.findFirst({
    where: {
      slug: { startsWith: "legacy-" },
      startsAt: { gte: start, lt: end },
    },
    select: { id: true },
  });
}

async function importEvent(
  tx: Prisma.TransactionClient,
  event: ParsedJamsSnapshotEvent,
  identities: Map<string, SongIdentity | null>,
  userCache: Map<string, { id: string; telegramUsername: string | null }>,
  instrumentBySlug: Map<string, { id: string }>,
) {
  const importer = await ensureImporter(tx);
  const existing = await findExistingLegacyEventForDate(tx, event);
  const slug = `legacy-${slugify(event.title)}`;
  const dbEvent = existing
    ? await tx.event.update({
        where: { id: existing.id },
        data: {
          slug,
          title: event.title,
          startsAt: event.startsAt,
          status: EventStatus.PUBLISHED,
          description: "Imported from the Jams_db_snapshot.xlsx workbook.",
          stageNotes: `Imported from sheet: ${event.sheetName}`,
        },
      })
    : await tx.event.create({
        data: {
          slug,
          title: event.title,
          startsAt: event.startsAt,
          status: EventStatus.PUBLISHED,
          description: "Imported from the Jams_db_snapshot.xlsx workbook.",
          stageNotes: `Imported from sheet: ${event.sheetName}`,
          allowPlayback: true,
        },
      });

  await tx.setlistItem.deleteMany({ where: { eventId: dbEvent.id } });
  await tx.trackInvite.deleteMany({ where: { track: { eventId: dbEvent.id } } });
  await tx.trackSeat.deleteMany({ where: { track: { eventId: dbEvent.id } } });
  await tx.track.deleteMany({ where: { eventId: dbEvent.id } });
  await tx.eventLineupSlot.deleteMany({ where: { eventId: dbEvent.id } });

  const slotRecords = new Map<string, { id: string; label: string; seatCount: number }>();
  let displayOrder = 1;
  for (const column of event.participantColumns) {
    if (slotRecords.has(column.slotKey)) {
      continue;
    }
    const seatCount = event.participantColumns.filter((item) => item.slotKey === column.slotKey).length;
    const hasOptional = event.tracks.some((track) =>
      track.seats.some((seat) => seat.column.slotKey === column.slotKey && seat.isOptional),
    );
    const instrument = column.instrumentSlug ? instrumentBySlug.get(column.instrumentSlug) : null;
    const slot = await tx.eventLineupSlot.create({
      data: {
        eventId: dbEvent.id,
        key: column.slotKey,
        label: column.slotLabel,
        seatCount,
        allowOptional: (optionalBySlot.get(column.slotKey) ?? true) || hasOptional,
        displayOrder,
        instrumentId: instrument?.id ?? null,
      },
    });
    slotRecords.set(column.slotKey, { id: slot.id, label: slot.label, seatCount });
    displayOrder += 1;
  }

  let orderIndex = 1;
  for (const sourceTrack of event.tracks) {
    const song = await ensureSong(tx, sourceTrack, identities.get(songKey(sourceTrack)));
    const proposer = sourceTrack.originatorUsername
      ? await ensureUser(tx, sourceTrack.originatorUsername, userCache)
      : importer;
    const track = await tx.track.create({
      data: {
        eventId: dbEvent.id,
        songId: song.id,
        proposedById: proposer.id,
        comment: sourceTrack.comment,
        playbackRequired: sourceTrack.playbackRequired,
      },
    });

    const seatPositionBySlot = new Map<string, number>();
    const seatRows: Prisma.TrackSeatCreateManyInput[] = [];
    for (const sourceSeat of sourceTrack.seats) {
      const slot = slotRecords.get(sourceSeat.column.slotKey);
      if (!slot) {
        continue;
      }
      const seatIndex = (seatPositionBySlot.get(sourceSeat.column.slotKey) ?? 0) + 1;
      seatPositionBySlot.set(sourceSeat.column.slotKey, seatIndex);
      const user =
        sourceSeat.status === TrackSeatStatus.CLAIMED && sourceSeat.username
          ? await ensureUser(tx, sourceSeat.username, userCache)
          : null;

      seatRows.push({
        trackId: track.id,
        lineupSlotId: slot.id,
        seatIndex,
        label: slot.seatCount === 1 ? slot.label : `${slot.label} ${seatIndex}`,
        status: sourceSeat.status,
        isOptional: sourceSeat.isOptional,
        userId: user?.id ?? null,
        claimedAt: sourceSeat.status === TrackSeatStatus.CLAIMED ? event.startsAt : null,
      });
    }
    if (seatRows.length > 0) {
      await tx.trackSeat.createMany({ data: seatRows });
    }

    await tx.setlistItem.create({
      data: {
        eventId: dbEvent.id,
        trackId: track.id,
        section: SetlistSection.MAIN,
        orderIndex,
        editedById: proposer.id,
      },
    });
    orderIndex += 1;
  }
}

async function applyImport(events: ParsedJamsSnapshotEvent[], identities: Map<string, SongIdentity | null>) {
  const userCache = new Map<string, { id: string; telegramUsername: string | null }>();
  const instruments = await db.instrument.findMany({ select: { id: true, slug: true } });
  const instrumentBySlug = new Map(instruments.map((instrument) => [instrument.slug, { id: instrument.id }]));
  for (const event of events) {
    console.log(`Applying ${event.sheetName}: ${event.tracks.length} tracks`);
    await db.$transaction(async (tx) => {
      await ensureImporter(tx);
      await importEvent(tx, event, identities, userCache, instrumentBySlug);
    }, { timeout: 180_000 });
    console.log(`Applied ${event.sheetName}`);
  }

  if (process.env.JAMS_ONLY_SHEET) {
    return;
  }

  await db.$transaction(async (tx) => {
    await ensureImporter(tx);
    const sourceDateKeys = new Set(events.map((event) => dateKey(event.startsAt)));
    const legacyEvents = await tx.event.findMany({
      where: { slug: { startsWith: "legacy-" } },
      select: { id: true, startsAt: true },
    });
    const orphanIds = legacyEvents
      .filter((event) => !sourceDateKeys.has(dateKey(event.startsAt)))
      .map((event) => event.id);
    await deleteLegacyEvents(tx, orphanIds);
  }, { timeout: 180_000 });
}

async function deleteLegacyEvents(tx: Prisma.TransactionClient, eventIds: string[]) {
  if (eventIds.length === 0) {
    return;
  }

  await tx.setlistItem.deleteMany({ where: { eventId: { in: eventIds } } });
  await tx.trackInvite.deleteMany({ where: { track: { eventId: { in: eventIds } } } });
  await tx.trackSeat.deleteMany({ where: { track: { eventId: { in: eventIds } } } });
  await tx.track.deleteMany({ where: { eventId: { in: eventIds } } });
  await tx.eventLineupSlot.deleteMany({ where: { eventId: { in: eventIds } } });
  await tx.event.deleteMany({ where: { id: { in: eventIds } } });
}

async function finalizeEventMetadata(events: ParsedJamsSnapshotEvent[]) {
  await db.$transaction(async (tx) => {
    for (const event of events) {
      const existing = await findExistingLegacyEventForDate(tx, event);
      if (!existing) {
        continue;
      }
      await tx.event.update({
        where: { id: existing.id },
        data: {
          slug: `legacy-${slugify(event.title)}`,
          title: event.title,
          startsAt: event.startsAt,
          status: EventStatus.PUBLISHED,
          description: "Imported from the Jams_db_snapshot.xlsx workbook.",
          stageNotes: `Imported from sheet: ${event.sheetName}`,
        },
      });
    }

    const sourceDateKeys = new Set(events.map((event) => dateKey(event.startsAt)));
    const legacyEvents = await tx.event.findMany({
      where: { slug: { startsWith: "legacy-" } },
      select: { id: true, startsAt: true },
    });
    const orphanIds = legacyEvents
      .filter((event) => !sourceDateKeys.has(dateKey(event.startsAt)))
      .map((event) => event.id);
    await deleteLegacyEvents(tx, orphanIds);
  }, { timeout: 180_000 });
}

async function main() {
  const { mode, workbookPath } = parseArgs();
  const events = loadWorkbookEvents(workbookPath);
  const identities = await resolveItunesIdentities(events, mode);
  const sourceSummary = getSourceSummary(events, identities);

  console.log(JSON.stringify({ mode, workbookPath, sourceSummary }, null, 2));

  if (mode === "analyze") {
    return;
  }

  if (mode !== "finalize") {
    const plan = await loadDbPlan(events);
    console.log(
      JSON.stringify(
        {
          dbPlan: {
            existingLegacyEvents: plan.existingLegacyEvents,
            usersToCreate: plan.usersToCreate.length,
            usersToCreateSample: plan.usersToCreate.slice(0, 30),
            caseCollisions: plan.caseCollisions.map(([username, users]) => ({
              username,
              users,
            })),
            suspiciousUserMatches: plan.suspiciousUserMatches.slice(0, 30),
            orphanLegacyEvents: plan.orphanLegacyEvents.map((event) => ({
              date: dateKey(event.startsAt),
              slug: event.slug,
              title: event.title,
            })),
          },
        },
        null,
        2,
      ),
    );

    if (plan.caseCollisions.length > 0) {
      throw new Error("Blocking case-insensitive username collisions found in production.");
    }
  }

  if (mode === "apply") {
    await applyImport(events, identities);
    console.log(`Applied ${events.length} historical gigs from ${workbookPath}.`);
  }

  if (mode === "finalize") {
    await finalizeEventMetadata(events);
    console.log(`Finalized metadata for ${events.length} historical gigs from ${workbookPath}.`);
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
