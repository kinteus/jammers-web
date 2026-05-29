export function normalizeTelegramUsername(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim().replace(/^@+/, "");
  if (!trimmed) {
    return null;
  }

  return trimmed.toLowerCase();
}

// Telegram public usernames: 5–32 chars, letters/digits/underscores, must start
// with a letter. We accept the historical lenient set (case-insensitive).
const TELEGRAM_USERNAME_PATTERN = /^[a-z][a-z0-9_]{4,31}$/;

export function isValidTelegramUsername(value: string | null | undefined) {
  const normalized = normalizeTelegramUsername(value);
  if (!normalized) {
    return false;
  }
  return TELEGRAM_USERNAME_PATTERN.test(normalized);
}
