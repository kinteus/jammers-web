const DEFAULT_ADMIN_TIME_ZONE = "Europe/Nicosia";

function parseTimezoneOffsetMinutes(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDateTimeParts(value: string, label: string) {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (!match) {
    throw new Error(`${label} is invalid.`);
  }

  const [, year, month, day, hour, minute, second = "0"] = match;
  return {
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    month: Number(month),
    second: Number(second),
    year: Number(year),
  };
}

function getTimeZoneParts(value: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    year: "numeric",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return {
    day: parts.day ?? "01",
    hour: parts.hour ?? "00",
    minute: parts.minute ?? "00",
    month: parts.month ?? "01",
    second: parts.second ?? "00",
    year: parts.year ?? "1970",
  };
}

function parseDateTimeInTimeZone(value: string, label: string, timeZone: string) {
  const parts = parseDateTimeParts(value, label);
  const localAsUtcMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  const timeZoneParts = getTimeZoneParts(new Date(localAsUtcMs), timeZone);
  const timeZoneAsUtcMs = Date.UTC(
    Number(timeZoneParts.year),
    Number(timeZoneParts.month) - 1,
    Number(timeZoneParts.day),
    Number(timeZoneParts.hour),
    Number(timeZoneParts.minute),
    Number(timeZoneParts.second),
  );
  const timeZoneOffsetMs = timeZoneAsUtcMs - localAsUtcMs;

  return new Date(localAsUtcMs - timeZoneOffsetMs);
}

export function parseAdminLocalDateTimeInput(
  value: string,
  label: string,
  timezoneOffsetMinutes: string | number | null | undefined,
) {
  const offsetMinutes = parseTimezoneOffsetMinutes(timezoneOffsetMinutes);

  if (value.endsWith("Z") || /[+-]\d\d:\d\d$/.test(value)) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new Error(`${label} is invalid.`);
    }
    return date;
  }

  if (offsetMinutes === null) {
    const date = parseDateTimeInTimeZone(value, label, DEFAULT_ADMIN_TIME_ZONE);
    if (Number.isNaN(date.getTime())) {
      throw new Error(`${label} is invalid.`);
    }
    return date;
  }

  const { year, month, day, hour, minute, second } = parseDateTimeParts(value, label);
  const utcMs =
    Date.UTC(
      year,
      month - 1,
      day,
      hour,
      minute,
      second,
    ) +
    offsetMinutes * 60_000;
  const date = new Date(utcMs);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} is invalid.`);
  }

  return date;
}

export function formatDateTimeLocalInput(
  value: Date | string,
  timeZone = DEFAULT_ADMIN_TIME_ZONE,
) {
  const date = new Date(value);
  const parts = getTimeZoneParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
