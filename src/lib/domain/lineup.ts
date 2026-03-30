import type { EventLineupSlot } from "@prisma/client";

import { DEFAULT_LINEUP } from "@/lib/constants";

export function getDefaultLineupInput() {
  return DEFAULT_LINEUP.map((slot) => ({ ...slot }));
}

export function seatLabelForSlot(slot: Pick<EventLineupSlot, "label" | "seatCount">, index: number) {
  if (slot.seatCount === 1) {
    return slot.label;
  }

  return `${slot.label} ${index}`;
}
