"use client";

import { useEffect, useState } from "react";

export function AdminTimezoneOffsetField() {
  const [offset, setOffset] = useState<number | null>(null);

  useEffect(() => {
    setOffset(new Date().getTimezoneOffset());
  }, []);

  return (
    <input
      name="adminTimezoneOffsetMinutes"
      type="hidden"
      value={offset === null ? "" : String(offset)}
    />
  );
}
