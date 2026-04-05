export type ClosedOptionalSeatRequestMeta = {
  kind: "closed-opt-request";
  requesterId: string;
  requesterLabel: string;
  targetUserId: string;
  targetLabel: string;
  mode: "self" | "friend";
};

export function serializeClosedOptionalSeatRequestMeta(
  meta: ClosedOptionalSeatRequestMeta,
) {
  return JSON.stringify(meta);
}

export function parseClosedOptionalSeatRequestMeta(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<ClosedOptionalSeatRequestMeta>;

    if (
      parsed.kind !== "closed-opt-request" ||
      typeof parsed.requesterId !== "string" ||
      typeof parsed.requesterLabel !== "string" ||
      typeof parsed.targetUserId !== "string" ||
      typeof parsed.targetLabel !== "string" ||
      (parsed.mode !== "self" && parsed.mode !== "friend")
    ) {
      return null;
    }

    return parsed as ClosedOptionalSeatRequestMeta;
  } catch {
    return null;
  }
}
