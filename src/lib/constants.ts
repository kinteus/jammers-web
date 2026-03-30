export const DEFAULT_LINEUP = [
  { key: "drums", label: "Drums", seatCount: 1, displayOrder: 1 },
  { key: "guitar", label: "Guitar", seatCount: 2, displayOrder: 2 },
  { key: "bass", label: "Bass", seatCount: 1, displayOrder: 3 },
  { key: "vocals", label: "Vocals", seatCount: 3, displayOrder: 4 },
  { key: "keys", label: "Keys", seatCount: 1, displayOrder: 5 },
] as const;

export const ADMIN_LOCK_SCOPE = "setlist-curation";
