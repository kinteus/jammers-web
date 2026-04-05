import { cookies } from "next/headers";

import { normalizeLocale } from "@/lib/i18n";

export async function getLocale() {
  const cookieStore = await cookies();
  return normalizeLocale(cookieStore.get("jammers-locale")?.value);
}
