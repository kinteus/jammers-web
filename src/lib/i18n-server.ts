import { cache } from "react";

import { cookies } from "next/headers";

import { normalizeLocale } from "@/lib/i18n";

export const getLocale = cache(async function getLocale() {
  const cookieStore = await cookies();
  return normalizeLocale(cookieStore.get("jammers-locale")?.value);
});
