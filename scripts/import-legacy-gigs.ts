import {
  EventStatus,
  SetlistSection,
  TrackSeatStatus,
  UserRole,
  type Prisma,
} from "@prisma/client";
import XLSX from "xlsx";

import { db } from "@/lib/db";
import { slugify } from "@/lib/utils";

type RoleConfig = {
  slotKey: string;
  slotLabel: string;
  instrumentSlug: string | null;
  allowOptionalByDefault: boolean;
};

type ParticipantColumn = {
  index: number;
  header: string;
  slotKey: string;
  slotLabel: string;
  instrumentSlug: string | null;
};

const WORKBOOK_PATH =
  process.argv[2] ?? "/Users/maksimnaumov/Downloads/The Jammers Gigs.xlsx";

const roleConfigs: Array<{ matcher: RegExp; config: RoleConfig }> = [
  {
    matcher: /vocal/i,
    config: {
      slotKey: "vocals",
      slotLabel: "Vocal",
      instrumentSlug: "vocals",
      allowOptionalByDefault: true,
    },
  },
  {
    matcher: /guitar|ultimage guitar/i,
    config: {
      slotKey: "guitar",
      slotLabel: "Guitar",
      instrumentSlug: "guitar",
      allowOptionalByDefault: true,
    },
  },
  {
    matcher: /bass/i,
    config: {
      slotKey: "bass",
      slotLabel: "Bass",
      instrumentSlug: "bass",
      allowOptionalByDefault: false,
    },
  },
  {
    matcher: /drum/i,
    config: {
      slotKey: "drums",
      slotLabel: "Drums",
      instrumentSlug: "drums",
      allowOptionalByDefault: false,
    },
  },
  {
    matcher: /keyboard|keys|piano/i,
    config: {
      slotKey: "keys",
      slotLabel: "Keys",
      instrumentSlug: "keys",
      allowOptionalByDefault: true,
    },
  },
  {
    matcher: /additional|other|tool/i,
    config: {
      slotKey: "extras",
      slotLabel: "Additional Tool",
      instrumentSlug: null,
      allowOptionalByDefault: true,
    },
  },
];

const metadataMatchers = [
  /band/i,
  /song/i,
  /comment/i,
  /^status/i,
  /playback/i,
  /tone/i,
  /originator/i,
  /who proposed/i,
  /youtube/i,
];

const OPTIONAL_PLACEHOLDER_USERNAMES = new Set(["optional"]);
const UNAVAILABLE_PLACEHOLDER_USERNAMES = new Set(["n"]);
const EXCLUDED_IMPORT_USERNAMES = new Set(["loremipsum9900", "loremipsum99999"]);
const USERNAME_CANONICAL_MAP = new Map<string, string>([
  ["mkokarev", "m_kokarev"],
  ["vkaraganov", "v_karaganov"],
  ["alexome_", "alexome_e"],
  ["artem_ivanov", "artyom_ivanov"],
  ["daniil_givel_se", "daniil_gilev_se"],
  ["rockat86", "rockat777"],
  ["meroag81", "meroaguk"],
  ["nikita", "nikitka028"],
]);

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cleanSongTitle(value: string) {
  return cleanText(value).replace(/(\d+)\.0$/, "$1");
}

function isSetlistSheet(name: string) {
  return /set\s*lis?t/i.test(name);
}

function getBaseSheetFingerprint(name: string) {
  return cleanText(
    name
      .replace(/\[?\s*set\s*lis?t\s*\]?/gi, "")
      .replace(/\s{2,}/g, " ")
      .toLowerCase(),
  );
}

function parseDateFromSheetName(name: string) {
  const match = name.match(/(\d{2})\.(\d{2})\.(\d{4}|\d{2})/);
  if (!match) {
    throw new Error(`Could not parse date from sheet name: ${name}`);
  }
  const [, dd, mm, yyRaw] = match;
  const year = yyRaw.length === 2 ? 2000 + Number(yyRaw) : Number(yyRaw);
  return new Date(year, Number(mm) - 1, Number(dd), 20, 0, 0);
}

function normalizeEventTitle(name: string) {
  return cleanText(
    name
      .replace(/\[?\s*set\s*lis?t\s*\]?/gi, "")
      .replace(/\s{2,}/g, " "),
  );
}

function findHeaderRow(rows: unknown[][]) {
  return rows.findIndex((row) => {
    const lowered = row.map((cell) => cleanText(cell).toLowerCase());
    return lowered.some((cell) => cell.includes("band")) && lowered.some((cell) => cell.includes("song"));
  });
}

function looksLikeTelegramHandle(value: string) {
  const normalized = cleanText(value);
  if (!/^@?[a-z0-9_]{3,}$/i.test(normalized)) {
    return false;
  }

  return normalized.startsWith("@") || normalized.includes("_") || /\d/.test(normalized);
}

function isTechnicalSheetRow(row: unknown[]) {
  const first = cleanText(row[0]);
  const second = cleanText(row[1]);
  const loweredPair = `${first} ${second}`.toLowerCase();

  if (!first && !second) {
    return false;
  }

  if (
    loweredPair === "raw filtered" ||
    loweredPair.includes("raw filtered") ||
    loweredPair.includes("filtered raw")
  ) {
    return true;
  }

  if (looksLikeTelegramHandle(first) && (!second || looksLikeTelegramHandle(second))) {
    return true;
  }

  return false;
}

function getSetlistRows(rows: unknown[][], headerRowIndex: number) {
  const collected: unknown[][] = [];
  let blankStreak = 0;

  for (const row of rows.slice(headerRowIndex + 1)) {
    const band = cleanText(row[0]);
    const song = cleanText(row[1]);

    if (!band && !song) {
      blankStreak += 1;
      if (collected.length > 0 && blankStreak >= 2) {
        break;
      }
      continue;
    }

    if (collected.length > 0 && isTechnicalSheetRow(row)) {
      break;
    }

    blankStreak = 0;

    if (!band || !song) {
      if (collected.length > 0) {
        break;
      }
      continue;
    }

    collected.push(row);
  }

  return collected;
}

function isReadyStatus(value: unknown) {
  return /\bready\b/i.test(cleanText(value));
}

function getParticipantColumns(header: string[]) {
  return header.flatMap((rawHeader, index): ParticipantColumn[] => {
    const headerText = cleanText(rawHeader);
    if (!headerText) {
      return [];
    }
    if (metadataMatchers.some((matcher) => matcher.test(headerText))) {
      return [];
    }
    const matched = roleConfigs.find(({ matcher }) => matcher.test(headerText));
    if (!matched) {
      return [];
    }
    return [
      {
        index,
        header: headerText,
        slotKey: matched.config.slotKey,
        slotLabel: matched.config.slotLabel,
        instrumentSlug: matched.config.instrumentSlug,
      },
    ];
  });
}

function normalizeUsernameToken(value: string) {
  return value.replace(/^@+/, "").replace(/\s+/g, "").trim().toLowerCase();
}

function canonicalizeUsername(username: string | null) {
  if (!username) {
    return null;
  }

  const normalized = normalizeUsernameToken(username);
  if (EXCLUDED_IMPORT_USERNAMES.has(normalized)) {
    return null;
  }

  return USERNAME_CANONICAL_MAP.get(normalized) ?? normalized;
}

function isValidTelegramUsername(username: string | null) {
  if (!username) {
    return false;
  }

  return /^[a-z][a-z0-9_]{4,}$/i.test(username);
}

function resolvePlaceholderUsername(username: string | null) {
  if (!username) {
    return null;
  }

  if (OPTIONAL_PLACEHOLDER_USERNAMES.has(username)) {
    return {
      username: null,
      status: TrackSeatStatus.OPEN,
      isOptional: true,
    };
  }

  if (UNAVAILABLE_PLACEHOLDER_USERNAMES.has(username)) {
    return {
      username: null,
      status: TrackSeatStatus.UNAVAILABLE,
      isOptional: false,
    };
  }

  return null;
}

function parseSeatCell(value: unknown) {
  const raw = cleanText(value);
  const lowered = raw.toLowerCase();
  const hasOptionalMarker = /\bopt(?:ional)?\b/i.test(raw);
  const hasUnavailableMarker =
    lowered === "" ||
    lowered === "n/a" ||
    lowered === "na" ||
    lowered === "n\\a" ||
    lowered === "none";

  const usernameMatch =
    raw.match(/@([a-z0-9_]+)/i) ??
    raw.match(/\b(?:opt(?:ional)?\s+)?([a-z0-9_]+)\b/i);

  const username = usernameMatch ? normalizeUsernameToken(usernameMatch[1]) : null;
  const placeholder = resolvePlaceholderUsername(username);

  if (placeholder) {
    return placeholder;
  }

  const canonicalUsername = canonicalizeUsername(username);

  if (username && !canonicalUsername) {
    return {
      status: hasOptionalMarker ? TrackSeatStatus.OPEN : TrackSeatStatus.UNAVAILABLE,
      isOptional: hasOptionalMarker,
      username: null,
    };
  }

  if (canonicalUsername && !isValidTelegramUsername(canonicalUsername)) {
    return {
      status: hasOptionalMarker ? TrackSeatStatus.OPEN : TrackSeatStatus.UNAVAILABLE,
      isOptional: hasOptionalMarker,
      username: null,
    };
  }

  if (canonicalUsername) {
    return {
      status: TrackSeatStatus.CLAIMED,
      isOptional: hasOptionalMarker,
      username: canonicalUsername,
    };
  }

  if (hasUnavailableMarker) {
    return {
      status: TrackSeatStatus.UNAVAILABLE,
      isOptional: false,
      username: null,
    };
  }

  if (hasOptionalMarker) {
    return {
      status: TrackSeatStatus.OPEN,
      isOptional: true,
      username: null,
    };
  }

  return {
    status: TrackSeatStatus.UNAVAILABLE,
    isOptional: false,
    username: null,
  };
}

function parseOriginator(value: unknown) {
  const raw = cleanText(value);
  const usernameMatch =
    raw.match(/@([a-z0-9_]+)/i) ?? raw.match(/\b([a-z0-9_]+)\b/i);
  const username = usernameMatch ? normalizeUsernameToken(usernameMatch[1]) : null;
  if (resolvePlaceholderUsername(username)) {
    return null;
  }
  const canonicalUsername = canonicalizeUsername(username);
  return isValidTelegramUsername(canonicalUsername) ? canonicalUsername : null;
}

function getOriginatorUsername(row: unknown[], header: string[]) {
  const originatorIndex = header.findIndex((cell) => /originator/i.test(cell));
  const whoProposedIndex = header.findIndex((cell) => /who proposed/i.test(cell));

  const candidates = [originatorIndex, whoProposedIndex]
    .filter((index) => index >= 0)
    .map((index) => parseOriginator(row[index]))
    .filter(Boolean);

  return candidates[0] ?? null;
}

function parsePlaybackRequired(value: unknown) {
  const lowered = cleanText(value).toLowerCase();
  return lowered === "да" || lowered === "yes" || lowered === "y";
}

function buildTrackComment({
  comments,
  playback,
  tone,
  youtube,
}: {
  comments: string;
  playback: string;
  tone: string;
  youtube: string;
}) {
  const parts = [
    cleanText(comments),
    cleanText(tone) ? `Tone: ${cleanText(tone)}` : "",
    cleanText(playback) ? `Playback: ${cleanText(playback)}` : "",
    cleanText(youtube),
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : null;
}

async function main() {
  const workbook = XLSX.readFile(WORKBOOK_PATH);
  const instruments = await db.instrument.findMany();
  const instrumentBySlug = new Map(instruments.map((instrument) => [instrument.slug, instrument]));

  const existingUsers = await db.user.findMany({
    select: {
      id: true,
      telegramUsername: true,
      fullName: true,
      role: true,
    },
  });
  const userByUsername = new Map(
    existingUsers
      .filter((user) => user.telegramUsername)
      .map((user) => [normalizeUsernameToken(user.telegramUsername ?? ""), user]),
  );

  const existingArtists = await db.artist.findMany({
    select: { id: true, slug: true, name: true },
  });
  const artistBySlug = new Map(existingArtists.map((artist) => [artist.slug, artist]));

  const existingSongs = await db.song.findMany({
    select: { id: true, slug: true, title: true, artistId: true },
  });
  const songBySlug = new Map(existingSongs.map((song) => [song.slug, song]));

  async function ensureUser(tx: Prisma.TransactionClient, username: string) {
    const normalized = canonicalizeUsername(username);
    if (!normalized) {
      throw new Error(`Attempted to create excluded user from token: ${username}`);
    }
    const cached = userByUsername.get(normalized);
    if (cached) {
      return cached;
    }

    const created = await tx.user.create({
      data: {
        telegramUsername: normalized,
        fullName: normalized,
        role: normalized === "legacy_import" ? UserRole.ADMIN : UserRole.USER,
      },
      select: {
        id: true,
        telegramUsername: true,
        fullName: true,
        role: true,
      },
    });
    userByUsername.set(normalized, created);
    return created;
  }

  async function ensureArtist(tx: Prisma.TransactionClient, name: string) {
    const normalizedName = cleanText(name);
    const slug = slugify(normalizedName);
    const cached = artistBySlug.get(slug);
    if (cached) {
      return cached;
    }
    const created = await tx.artist.create({
      data: {
        slug,
        name: normalizedName,
      },
      select: {
        id: true,
        slug: true,
        name: true,
      },
    });
    artistBySlug.set(slug, created);
    return created;
  }

  async function ensureSong(tx: Prisma.TransactionClient, artistName: string, songTitle: string) {
    const artist = await ensureArtist(tx, artistName);
    const normalizedTitle = cleanSongTitle(songTitle);
    const slug = slugify(`${artist.name}-${normalizedTitle}`);
    const cached = songBySlug.get(slug);
    if (cached) {
      return cached;
    }
    const created = await tx.song.create({
      data: {
        slug,
        title: normalizedTitle,
        artistId: artist.id,
      },
      select: {
        id: true,
        slug: true,
        title: true,
        artistId: true,
      },
    });
    songBySlug.set(slug, created);
    return created;
  }

  const importer = await db.user.upsert({
    where: { telegramUsername: "legacy_import" },
    update: { role: UserRole.ADMIN, fullName: "Legacy Import" },
    create: {
      telegramUsername: "legacy_import",
      fullName: "Legacy Import",
      role: UserRole.ADMIN,
      bio: "System user for imported historical setlists.",
    },
    select: {
      id: true,
      telegramUsername: true,
      fullName: true,
      role: true,
    },
  });
  userByUsername.set("legacy_import", importer);

  const setlistSheets = workbook.SheetNames.filter(isSetlistSheet);
  const targetSheetByFingerprint = new Map<string, { name: string; priority: number }>();

  for (const name of setlistSheets) {
    const fingerprint = getBaseSheetFingerprint(name);
    const priority = name.includes("[") && name.includes("]") ? 1 : 0;
    const existing = targetSheetByFingerprint.get(fingerprint);

    if (!existing || priority > existing.priority) {
      targetSheetByFingerprint.set(fingerprint, { name, priority });
    }
  }

  const targetSheets = [...targetSheetByFingerprint.values()].map((entry) => entry.name);
  let importedEvents = 0;
  let importedTracks = 0;
  const importedUsers = new Set<string>();

  for (const sheetName of targetSheets) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
      header: 1,
      defval: "",
      raw: false,
    });
    const headerRowIndex = findHeaderRow(rows);
    if (headerRowIndex === -1) {
      continue;
    }

    const header = rows[headerRowIndex].map((cell) => cleanText(cell));
    const participantColumns = getParticipantColumns(header);
    const statusColumnIndex = header.findIndex((cell) => /^status/i.test(cell));
    const roleUsage = new Map<string, { config: ParticipantColumn; count: number; allowOptional: boolean }>();

    const dataRows = getSetlistRows(rows, headerRowIndex).filter((row) =>
      statusColumnIndex === -1 ? true : isReadyStatus(row[statusColumnIndex]),
    );

    for (const column of participantColumns) {
      const existing =
        roleUsage.get(column.slotKey) ??
        {
          config: column,
          count: 0,
          allowOptional: roleConfigs.find((entry) => entry.config.slotKey === column.slotKey)?.config.allowOptionalByDefault ?? true,
        };
      existing.count += 1;
      existing.allowOptional =
        existing.allowOptional ||
        dataRows.some((row) => parseSeatCell(row[column.index]).isOptional);
      roleUsage.set(column.slotKey, existing);
    }

    const eventTitle = normalizeEventTitle(sheetName);
    const eventSlug = `legacy-${slugify(eventTitle)}`;
    const eventStartsAt = parseDateFromSheetName(sheetName);

    await db.$transaction(async (tx) => {
      const event = await tx.event.upsert({
        where: { slug: eventSlug },
        update: {
          title: eventTitle,
          startsAt: eventStartsAt,
          status: EventStatus.PUBLISHED,
          description: "Imported from the legacy The Jammers setlist workbook.",
          stageNotes: `Imported from sheet: ${sheetName}`,
        },
        create: {
          slug: eventSlug,
          title: eventTitle,
          startsAt: eventStartsAt,
          status: EventStatus.PUBLISHED,
          description: "Imported from the legacy The Jammers setlist workbook.",
          stageNotes: `Imported from sheet: ${sheetName}`,
          allowPlayback: true,
        },
      });

      await tx.setlistItem.deleteMany({ where: { eventId: event.id } });
      await tx.trackInvite.deleteMany({ where: { track: { eventId: event.id } } });
      await tx.trackSeat.deleteMany({ where: { track: { eventId: event.id } } });
      await tx.track.deleteMany({ where: { eventId: event.id } });
      await tx.eventLineupSlot.deleteMany({ where: { eventId: event.id } });

      const slotRecords = new Map<string, { id: string; label: string; seatCount: number }>();
      let displayOrder = 1;
      for (const column of participantColumns) {
        if (slotRecords.has(column.slotKey)) {
          continue;
        }
        const usage = roleUsage.get(column.slotKey);
        const instrument = column.instrumentSlug
          ? instrumentBySlug.get(column.instrumentSlug)
          : null;
        const created = await tx.eventLineupSlot.create({
          data: {
            eventId: event.id,
            key: column.slotKey,
            label: column.slotLabel,
            seatCount: usage?.count ?? 1,
            allowOptional: usage?.allowOptional ?? true,
            displayOrder,
            instrumentId: instrument?.id ?? null,
          },
        });
        slotRecords.set(column.slotKey, {
          id: created.id,
          label: created.label,
          seatCount: created.seatCount,
        });
        displayOrder += 1;
      }

      let orderIndex = 1;
      for (const row of dataRows) {
        const artistName = cleanText(row[0]);
        const songTitle = cleanSongTitle(cleanText(row[1]));
        if (!artistName || !songTitle) {
          continue;
        }

        const song = await ensureSong(tx, artistName, songTitle);
        const originatorUsername = getOriginatorUsername(row, header);
        const proposer = originatorUsername
          ? await ensureUser(tx, originatorUsername)
          : importer;
        if (originatorUsername) {
          importedUsers.add(originatorUsername);
        }

        const track = await tx.track.create({
          data: {
            eventId: event.id,
            songId: song.id,
            proposedById: proposer.id,
            playbackRequired: parsePlaybackRequired(
              row[header.findIndex((cell) => /playback/i.test(cell))],
            ),
            comment: buildTrackComment({
              comments: cleanText(row[header.findIndex((cell) => /comment/i.test(cell))]),
              playback: cleanText(row[header.findIndex((cell) => /playback/i.test(cell))]),
              tone: cleanText(row[header.findIndex((cell) => /tone/i.test(cell))]),
              youtube: cleanText(row[header.findIndex((cell) => /youtube/i.test(cell))]),
            }),
          },
        });

        const seatPositionBySlot = new Map<string, number>();
        for (const column of participantColumns) {
          const slot = slotRecords.get(column.slotKey);
          if (!slot) {
            continue;
          }
          const seatIndex = (seatPositionBySlot.get(column.slotKey) ?? 0) + 1;
          seatPositionBySlot.set(column.slotKey, seatIndex);

          const parsedSeat = parseSeatCell(row[column.index]);
          const seatUser =
            parsedSeat.username && parsedSeat.status === TrackSeatStatus.CLAIMED
              ? await ensureUser(tx, parsedSeat.username)
              : null;
          const seatInstrument = column.instrumentSlug
            ? instrumentBySlug.get(column.instrumentSlug)
            : null;

          if (parsedSeat.username) {
            importedUsers.add(parsedSeat.username);
          }

          if (seatUser && seatInstrument) {
            await tx.userInstrument.upsert({
              where: {
                userId_instrumentId: {
                  userId: seatUser.id,
                  instrumentId: seatInstrument.id,
                },
              },
              update: {},
              create: {
                userId: seatUser.id,
                instrumentId: seatInstrument.id,
              },
            });
          }

          await tx.trackSeat.create({
            data: {
              trackId: track.id,
              lineupSlotId: slot.id,
              seatIndex,
              label: slot.seatCount === 1 ? slot.label : `${slot.label} ${seatIndex}`,
              status: parsedSeat.status,
              isOptional: parsedSeat.isOptional,
              userId: seatUser?.id ?? null,
              claimedAt:
                parsedSeat.status === TrackSeatStatus.CLAIMED ? event.startsAt : null,
            },
          });
        }

        await tx.setlistItem.create({
          data: {
            eventId: event.id,
            trackId: track.id,
            section: SetlistSection.MAIN,
            orderIndex,
            editedById: proposer.id,
          },
        });

        orderIndex += 1;
        importedTracks += 1;
      }
    });

    importedEvents += 1;
  }

  console.log(
    `Imported ${importedEvents} historical gigs, ${importedTracks} tracks and ${importedUsers.size} musician profiles from ${WORKBOOK_PATH}`,
  );

  const invalidLegacyUsers = await db.user.findMany({
    where: {
      telegramId: null,
      telegramUsername: {
        not: null,
      },
    },
    select: {
      id: true,
      telegramUsername: true,
    },
  });

  await db.user.deleteMany({
    where: {
      id: {
        in: invalidLegacyUsers
          .filter((user) =>
            user.telegramUsername
              ? !isValidTelegramUsername(user.telegramUsername) ||
                OPTIONAL_PLACEHOLDER_USERNAMES.has(user.telegramUsername) ||
                UNAVAILABLE_PLACEHOLDER_USERNAMES.has(user.telegramUsername)
              : false,
          )
          .map((user) => user.id),
      },
    },
  });

  await db.user.deleteMany({
    where: {
      telegramId: null,
      telegramUsername: {
        in: [...EXCLUDED_IMPORT_USERNAMES, ...USERNAME_CANONICAL_MAP.keys()],
      },
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
