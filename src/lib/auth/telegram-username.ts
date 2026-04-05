export function normalizeTelegramUsername(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace(/^@/, "").toLowerCase();
  return normalized.length > 0 ? normalized : null;
}
