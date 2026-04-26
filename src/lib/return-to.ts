const AUTH_NOISE_PARAMS = new Set(["auth", "authError"]);

export function getSafeReturnTo(
  value: string | null | undefined,
  fallback = "/profile",
) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  const url = new URL(value, "https://thejammers.local");
  for (const key of AUTH_NOISE_PARAMS) {
    url.searchParams.delete(key);
  }

  const query = url.searchParams.toString();
  return `${url.pathname}${query ? `?${query}` : ""}${url.hash}`;
}
