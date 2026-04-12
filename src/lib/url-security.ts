const DEFAULT_ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

export function normalizeExternalUrl(
  value: string | null | undefined,
  options?: {
    allowedHosts?: string[];
    allowedProtocols?: string[];
  },
) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const allowedProtocols = new Set(options?.allowedProtocols ?? DEFAULT_ALLOWED_PROTOCOLS);
  if (!allowedProtocols.has(url.protocol)) {
    return null;
  }

  const allowedHosts = options?.allowedHosts;
  if (
    allowedHosts &&
    allowedHosts.length > 0 &&
    !allowedHosts.some(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
    )
  ) {
    return null;
  }

  return url.toString();
}

export function normalizeVenueMapUrl(value: string | null | undefined) {
  return normalizeExternalUrl(value);
}

export function normalizeAppleMusicUrl(value: string | null | undefined) {
  return normalizeExternalUrl(value, {
    allowedHosts: ["itunes.apple.com", "music.apple.com", "geo.music.apple.com"],
    allowedProtocols: ["https:"],
  });
}
