/**
 * @vitest-environment jsdom
 */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import RootError from "@/app/error";

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("React", React);
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("RootError", () => {
  it("shows an error id and reports it to the server", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const host = document.createElement("div");
    const root = createRoot(host);
    document.body.appendChild(host);

    const error = Object.assign(new Error("Something broke"), {
      digest: "NEXT_DIGEST_123",
    });

    await act(async () => {
      root.render(<RootError error={error} reset={vi.fn()} />);
    });

    expect(host.textContent).toContain("Error ID");
    expect(host.textContent).toContain("err_NEXT_DIGEST_123");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/client-error",
      expect.objectContaining({
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: expect.stringContaining('"errorId":"err_NEXT_DIGEST_123"'),
      }),
    );
  });
});
