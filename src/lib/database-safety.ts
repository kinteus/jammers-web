export function isLocalProductionTunnelDatabaseUrl(databaseUrl: string | null | undefined) {
  if (!databaseUrl) {
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl.replace(/^postgresql:\/\//, "http://"));
  } catch {
    return false;
  }

  const databaseName = parsed.pathname.split("/").filter(Boolean).at(-1)?.toLowerCase() ?? "";
  const isLoopbackHost = ["127.0.0.1", "localhost", "::1"].includes(parsed.hostname);
  const isKnownTunnelPort = parsed.port === "55432";

  return isLoopbackHost && isKnownTunnelPort && databaseName === "prod";
}
