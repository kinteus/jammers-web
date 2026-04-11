export const DEFAULT_MAX_SET_TRACK_COUNT = 24;

const LEGACY_MINUTES_THRESHOLD = 60;
const LEGACY_MINUTES_PER_TRACK = 5;

// Older events stored a duration budget in minutes in the same database field.
// New gigs use direct track counts, so we normalize legacy values on read.
export function getEffectiveMaxSetTrackCount(value: number | null | undefined) {
  if (!Number.isFinite(value) || !value || value <= 0) {
    return DEFAULT_MAX_SET_TRACK_COUNT;
  }

  if (value > LEGACY_MINUTES_THRESHOLD) {
    return Math.max(1, Math.round(value / LEGACY_MINUTES_PER_TRACK));
  }

  return Math.max(1, Math.round(value));
}
