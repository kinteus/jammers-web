function parseTimezoneOffsetMinutes(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseAdminLocalDateTimeInput(
  value: string,
  label: string,
  timezoneOffsetMinutes: string | number | null | undefined,
) {
  const offsetMinutes = parseTimezoneOffsetMinutes(timezoneOffsetMinutes);

  if (offsetMinutes === null || value.endsWith("Z") || /[+-]\d\d:\d\d$/.test(value)) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new Error(`${label} is invalid.`);
    }
    return date;
  }

  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (!match) {
    throw new Error(`${label} is invalid.`);
  }

  const [, year, month, day, hour, minute, second = "0"] = match;
  const utcMs =
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    ) +
    offsetMinutes * 60_000;
  const date = new Date(utcMs);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} is invalid.`);
  }

  return date;
}

export function formatDateTimeLocalInput(value: Date | string) {
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}
