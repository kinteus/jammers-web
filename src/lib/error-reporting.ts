const ERROR_ID_PREFIX = "err";

function sanitizeErrorIdPart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 72);
}

export function getPublicErrorId(error: { digest?: string } | null | undefined) {
  if (error?.digest) {
    return `${ERROR_ID_PREFIX}_${sanitizeErrorIdPart(error.digest)}`;
  }

  const randomPart =
    globalThis.crypto && "randomUUID" in globalThis.crypto
      ? globalThis.crypto.randomUUID().slice(0, 12)
      : Math.random().toString(36).slice(2, 14);

  return `${ERROR_ID_PREFIX}_${Date.now().toString(36)}_${sanitizeErrorIdPart(randomPart)}`;
}
