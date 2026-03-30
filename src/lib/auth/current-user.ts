import { cache } from "react";

import { getSessionUser } from "@/lib/auth/session";

export const getCurrentUser = cache(async () => getSessionUser());
