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

export function buildProfileSignInHref({
  pathname,
  search,
  hash,
  returnToOverride,
}: {
  pathname: string | null | undefined;
  search?: string;
  hash?: string;
  returnToOverride?: string | null;
}) {
  const fallbackPath = pathname || "/profile";
  const searchParams = new URLSearchParams((search ?? "").replace(/^\?/, ""));
  const existingReturnTo = fallbackPath === "/profile" ? searchParams.get("returnTo") : null;
  const query = searchParams.toString();
  const currentPath = `${fallbackPath}${query ? `?${query}` : ""}${hash ?? ""}`;
  const returnTo = getSafeReturnTo(
    returnToOverride ?? existingReturnTo ?? currentPath,
    fallbackPath,
  );

  return `/profile?returnTo=${encodeURIComponent(returnTo)}#telegram-login`;
}
