import { beforeEach, expect, it, vi } from "vitest";
const jar = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => jar }));
import { createLoginState, verifyLoginState, clearLoginState } from "@/lib/auth/login-state";
beforeEach(() => vi.clearAllMocks());
it("creates an unpredictable httpOnly state cookie and validates an exact match", async () => {
  const state = await createLoginState();
  expect(state).toMatch(/^[a-f0-9]{64}$/);
  expect(jar.set).toHaveBeenCalledWith("jammers_login_state", state, expect.objectContaining({ httpOnly: true, sameSite: "lax", maxAge: 600 }));
  jar.get.mockReturnValue({ value: state });
  await expect(verifyLoginState(state)).resolves.toBeUndefined();
  await expect(verifyLoginState("b".repeat(64))).rejects.toThrow();
  await clearLoginState();
  expect(jar.set).toHaveBeenLastCalledWith("jammers_login_state", "", expect.objectContaining({ maxAge: 0 }));
});
it("rejects missing state and cookies", async () => {
  jar.get.mockReturnValue(undefined);
  await expect(verifyLoginState("a".repeat(64))).rejects.toThrow();
  await expect(verifyLoginState(null)).rejects.toThrow();
});
