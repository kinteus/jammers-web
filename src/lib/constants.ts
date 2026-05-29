// `defaultOptionalSeats` lists the 1-based seat indexes within a slot that should be marked
// optional by default when a song is proposed. The proposer can still override each seat.
export const DEFAULT_LINEUP = [
  { key: "vocals", label: "Vocals", seatCount: 3, allowOptional: true, defaultOptionalSeats: [2, 3], displayOrder: 1 },
  { key: "guitar", label: "Guitar", seatCount: 2, allowOptional: true, defaultOptionalSeats: [2], displayOrder: 2 },
  { key: "bass", label: "Bass", seatCount: 1, allowOptional: true, defaultOptionalSeats: [], displayOrder: 3 },
  { key: "drums", label: "Drums", seatCount: 1, allowOptional: true, defaultOptionalSeats: [], displayOrder: 4 },
  { key: "keys", label: "Keys", seatCount: 1, allowOptional: true, defaultOptionalSeats: [1], displayOrder: 5 },
  { key: "extra", label: "Extra", seatCount: 1, allowOptional: true, defaultOptionalSeats: [1], displayOrder: 6 },
] as const;

export const ADMIN_LOCK_SCOPE = "setlist-curation";
