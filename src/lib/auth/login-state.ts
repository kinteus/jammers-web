import crypto from "node:crypto";
import { cookies } from "next/headers";

export const LOGIN_STATE_COOKIE = "jammers_login_state";

export async function createLoginState() {
  const state = crypto.randomBytes(32).toString("hex");
  (await cookies()).set(LOGIN_STATE_COOKIE, state, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", path: "/api/auth/telegram", maxAge: 600,
  });
  return state;
}

export async function verifyLoginState(state: unknown) {
  const expected = (await cookies()).get(LOGIN_STATE_COOKIE)?.value;
  if (typeof state !== "string" || !/^[a-f0-9]{64}$/.test(state) || !expected ||
      expected.length !== state.length ||
      !crypto.timingSafeEqual(Buffer.from(state), Buffer.from(expected))) {
    throw new Error("Invalid login state.");
  }
}

export async function clearLoginState() {
  (await cookies()).set(LOGIN_STATE_COOKIE, "", { path: "/api/auth/telegram", maxAge: 0 });
}
