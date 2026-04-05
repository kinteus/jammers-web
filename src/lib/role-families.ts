export type RoleFamilyKey =
  | "rhythm"
  | "guitars"
  | "bass"
  | "vocals"
  | "keys"
  | "extras";

export const roleFamilyOrder: RoleFamilyKey[] = [
  "rhythm",
  "guitars",
  "bass",
  "vocals",
  "keys",
  "extras",
];

export function getRoleFamilyKey(label: string, key = ""): RoleFamilyKey {
  const fingerprint = `${label} ${key}`.toLowerCase();

  if (fingerprint.includes("vocal")) {
    return "vocals";
  }
  if (fingerprint.includes("guitar")) {
    return "guitars";
  }
  if (fingerprint.includes("bass")) {
    return "bass";
  }
  if (fingerprint.includes("drum") || fingerprint.includes("percussion")) {
    return "rhythm";
  }
  if (
    fingerprint.includes("key") ||
    fingerprint.includes("piano") ||
    fingerprint.includes("synth")
  ) {
    return "keys";
  }

  return "extras";
}
