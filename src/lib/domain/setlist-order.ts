type SetlistOrderItem = {
  orderIndex: number;
};

export function getNextSetlistOrderIndex(items: SetlistOrderItem[]) {
  if (items.length === 0) {
    return 1;
  }

  return Math.max(...items.map((item) => item.orderIndex)) + 1;
}
