import { TrackSeatStatus } from "@prisma/client";

type ParticipantColumn = {
  index: number;
  header: string;
  slotKey: string;
  slotLabel: string;
  instrumentSlug: string | null;
};

export type ParsedJamsSnapshotSeat = ReturnType<typeof parseLegacySeatCell> & {
  column: ParticipantColumn;
};

export type ParsedJamsSnapshotTrack = {
  artistName: string;
  songTitle: string;
  originatorUsername: string | null;
  comment: string | null;
  playbackRequired: boolean;
  seats: ParsedJamsSnapshotSeat[];
};

export type ParsedJamsSnapshotEvent = {
  sheetName: string;
  title: string;
  startsAt: Date;
  tracks: ParsedJamsSnapshotTrack[];
  participantColumns: ParticipantColumn[];
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const roleConfigs: Array<{
  matcher: RegExp;
  slotKey: string;
  slotLabel: string;
  instrumentSlug: string | null;
}> = [
  { matcher: /vocal/i, slotKey: "vocals", slotLabel: "Vocal", instrumentSlug: "vocals" },
  { matcher: /guitar/i, slotKey: "guitar", slotLabel: "Guitar", instrumentSlug: "guitar" },
  { matcher: /bass/i, slotKey: "bass", slotLabel: "Bass", instrumentSlug: "bass" },
  { matcher: /drum/i, slotKey: "drums", slotLabel: "Drums", instrumentSlug: "drums" },
  { matcher: /keyboard|keys|piano/i, slotKey: "keys", slotLabel: "Keys", instrumentSlug: "keys" },
];

const unavailableTokens = new Set(["", "n", "na", "n/a", "n\\a", "none", "nan"]);
const excludedUsernames = new Set(["loremipsum9900", "loremipsum99999"]);
const usernameCanonicalMap = new Map<string, string>([
  ["mkokarev", "m_kokarev"],
  ["vkaraganov", "v_karaganov"],
  ["alexome_", "alexome_e"],
  ["artem_ivanov", "artyom_ivanov"],
  ["daniil_givel_se", "daniil_gilev_se"],
  ["rockat86", "rockat777"],
  ["meroag81", "meroaguk"],
  ["nikita", "nikitka028"],
  ["sexysax5", "sexy5sax"],
  ["vanyagaymerass", "vanyagaymer"],
]);

export function cleanLegacyCell(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function parseSnapshotSheetDate(sheetName: string) {
  const match = sheetName.match(/^(\d{4})\.(\d{2})\.(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid jams snapshot sheet name: ${sheetName}`);
  }

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), 20, 0, 0);
}

export function formatHistoricalGigTitle(date: Date) {
  return `Гиг The Jammers ${date.getDate()} of ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

export function isJamsSnapshotSheet(name: string) {
  return /^\d{4}\.\d{2}\.\d{2}$/.test(name);
}

export function detectJamsSnapshotColumns(headers: string[]) {
  const additionalToolIndex = headers.findIndex((header) => /additional tool 1/i.test(header));
  const participantBoundary = additionalToolIndex >= 0 ? additionalToolIndex : headers.length;
  const participantColumns: ParticipantColumn[] = [];

  for (let index = 0; index < participantBoundary; index += 1) {
    const header = cleanLegacyCell(headers[index]);
    const config = roleConfigs.find((role) => role.matcher.test(header));
    if (!config) {
      continue;
    }

    participantColumns.push({
      index,
      header,
      slotKey: config.slotKey,
      slotLabel: config.slotLabel,
      instrumentSlug: config.instrumentSlug,
    });
  }

  return {
    artistColumnIndex: 0,
    songColumnIndex: 1,
    participantColumns,
    originatorColumnIndex: headers.findIndex((header) => /originator/i.test(header)),
    commentColumnIndex: headers.findIndex((header) => /comments/i.test(header)),
    playbackColumnIndex: headers.findIndex((header) => /playback/i.test(header)),
    toneColumnIndex: headers.findIndex((header) => /^tone$/i.test(header)),
    youtubeColumnIndex: headers.findIndex((header) => /youtube/i.test(header)),
  };
}

export function normalizeLegacyUsernameToken(value: string | null | undefined) {
  const normalized = cleanLegacyCell(value).replace(/^@+/, "").replace(/\s+/g, "").toLowerCase();
  if (excludedUsernames.has(normalized)) {
    return null;
  }
  return usernameCanonicalMap.get(normalized) ?? (normalized || null);
}

export function parseLegacySeatCell(value: unknown) {
  const raw = cleanLegacyCell(value);
  const lowered = raw.toLowerCase();
  const isOptional = /\bopt(?:ional)?\b/i.test(raw);
  const usernameMatch =
    raw.match(/@([a-z0-9_]+)/i) ?? raw.match(/\b([a-z][a-z0-9_]{2,})\b/i);
  const username = normalizeLegacyUsernameToken(usernameMatch?.[1]);

  if (username === "optional") {
    return { status: TrackSeatStatus.OPEN, isOptional: true, username: null };
  }

  if (!username && (isOptional || lowered === "optional")) {
    return { status: TrackSeatStatus.OPEN, isOptional: true, username: null };
  }

  if (!username || unavailableTokens.has(username) || unavailableTokens.has(lowered)) {
    return { status: TrackSeatStatus.UNAVAILABLE, isOptional: false, username: null };
  }

  if (!/^[a-z][a-z0-9_]{4,}$/i.test(username)) {
    return {
      status: isOptional ? TrackSeatStatus.OPEN : TrackSeatStatus.UNAVAILABLE,
      isOptional,
      username: null,
    };
  }

  return { status: TrackSeatStatus.CLAIMED, isOptional, username };
}

function parseOriginator(value: unknown) {
  const raw = cleanLegacyCell(value);
  const usernameMatch =
    raw.match(/@([a-z0-9_]+)/i) ?? raw.match(/\b([a-z][a-z0-9_]{2,})\b/i);
  const username = normalizeLegacyUsernameToken(usernameMatch?.[1]);
  if (!username || username === "optional" || unavailableTokens.has(username)) {
    return null;
  }
  return /^[a-z][a-z0-9_]{4,}$/i.test(username) ? username : null;
}

function cellAt(row: unknown[], index: number) {
  return index >= 0 ? row[index] : "";
}

function buildTrackComment({
  comments,
  tone,
  youtube,
}: {
  comments: unknown;
  tone: unknown;
  youtube: unknown;
}) {
  const parts = [
    cleanLegacyCell(comments),
    cleanLegacyCell(tone) ? `Tone: ${cleanLegacyCell(tone)}` : "",
    cleanLegacyCell(youtube),
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : null;
}

export function parseJamsSnapshotSheet(sheetName: string, rows: unknown[][]) {
  const startsAt = parseSnapshotSheetDate(sheetName);
  const headers = (rows[0] ?? []).map((cell) => cleanLegacyCell(cell));
  const columns = detectJamsSnapshotColumns(headers);
  const tracks: ParsedJamsSnapshotTrack[] = [];

  for (const row of rows.slice(1)) {
    const artistName = cleanLegacyCell(cellAt(row, columns.artistColumnIndex));
    const songTitle = cleanLegacyCell(cellAt(row, columns.songColumnIndex));
    if (!artistName || !songTitle) {
      continue;
    }

    tracks.push({
      artistName,
      songTitle,
      originatorUsername: parseOriginator(cellAt(row, columns.originatorColumnIndex)),
      comment: buildTrackComment({
        comments: cellAt(row, columns.commentColumnIndex),
        tone: cellAt(row, columns.toneColumnIndex),
        youtube: cellAt(row, columns.youtubeColumnIndex),
      }),
      playbackRequired: /^(yes|y|да)$/i.test(cleanLegacyCell(cellAt(row, columns.playbackColumnIndex))),
      seats: columns.participantColumns.map((column) => ({
        ...parseLegacySeatCell(row[column.index]),
        column,
      })),
    });
  }

  return {
    sheetName,
    title: formatHistoricalGigTitle(startsAt),
    startsAt,
    tracks,
    participantColumns: columns.participantColumns,
  };
}
