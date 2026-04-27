import { afterEach, describe, expect, it, vi } from "vitest";

import { buildProfileSignInHref, getSafeReturnTo } from "@/lib/return-to";

const redirectMock = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
);
const revalidatePathMock = vi.hoisted(() => vi.fn());
const revalidateTagMock = vi.hoisted(() => vi.fn());
const createSessionMock = vi.hoisted(() => vi.fn());
const envMock = vi.hoisted(() => ({
  ENABLE_DEV_AUTH: true,
  LIVE_PRODUCTION_TUNNEL: false,
}));
const dbMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
  revalidateTag: revalidateTagMock,
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("@/lib/auth/session", () => ({
  createSession: createSessionMock,
  deleteSession: vi.fn(),
  getSessionUser: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("@/lib/env", () => ({
  env: envMock,
}));

afterEach(() => {
  envMock.ENABLE_DEV_AUTH = true;
  envMock.LIVE_PRODUCTION_TUNNEL = false;
  vi.clearAllMocks();
});

describe("getSafeReturnTo", () => {
  it("keeps relative app paths and strips auth noise", () => {
    expect(getSafeReturnTo("/events/spring-jam-night?authError=retry&view=mine")).toBe(
      "/events/spring-jam-night?view=mine",
    );
    expect(getSafeReturnTo("/about")).toBe("/about");
  });

  it("falls back for unsafe or empty targets", () => {
    expect(getSafeReturnTo("https://evil.example")).toBe("/profile");
    expect(getSafeReturnTo("//evil.example")).toBe("/profile");
    expect(getSafeReturnTo("")).toBe("/profile");
  });
});

describe("buildProfileSignInHref", () => {
  it("preserves an existing returnTo value on the profile sign-in page", () => {
    expect(
      buildProfileSignInHref({
        pathname: "/profile",
        search: "authError=retry&returnTo=%2Fabout%23team",
      }),
    ).toBe("/profile?returnTo=%2Fabout%23team#telegram-login");
  });

  it("preserves hashes for anchored public pages", () => {
    expect(
      buildProfileSignInHref({
        pathname: "/events/spring-jam-night",
        search: "view=open",
        hash: "#track-board",
      }),
    ).toBe(
      "/profile?returnTo=%2Fevents%2Fspring-jam-night%3Fview%3Dopen%23track-board#telegram-login",
    );
  });
});

describe("devSignInAction", () => {
  it(
    "redirects successful local sign-in back to a sanitized return target",
    async () => {
      dbMock.user.upsert.mockResolvedValue({
        id: "user-1",
      });

      const { devSignInAction } = await import("@/server/actions");
      const formData = new FormData();
      formData.set("telegramUsername", "anna_drums");
      formData.set("role", "ADMIN");
      formData.set("returnTo", "/about?authError=retry&view=full#team");

      await expect(devSignInAction(formData)).rejects.toThrow(
        "NEXT_REDIRECT:/about?view=full#team",
      );

      expect(createSessionMock).toHaveBeenCalledWith("user-1");
    },
    10_000,
  );

  it(
    "preserves a sanitized return target when local tunnel sign-in cannot find a user",
    async () => {
      envMock.LIVE_PRODUCTION_TUNNEL = true;
      dbMock.user.findUnique.mockResolvedValue(null);

      const { devSignInAction } = await import("@/server/actions");
      const formData = new FormData();
      formData.set("telegramUsername", "missing_user");
      formData.set("returnTo", "/events/spring-jam-night?authError=retry&view=mine#track-board");

      await expect(devSignInAction(formData)).rejects.toThrow(
        "NEXT_REDIRECT:/profile?authError=dev-user-not-found&returnTo=%2Fevents%2Fspring-jam-night%3Fview%3Dmine%23track-board",
      );

      expect(createSessionMock).not.toHaveBeenCalled();
    },
    10_000,
  );
});
