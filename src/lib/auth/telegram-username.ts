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
