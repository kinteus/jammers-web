/**
 * @vitest-environment jsdom
 */
import React, { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AnimatedNumber } from "@/components/animated-number";

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("React", React);
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("AnimatedNumber", () => {
  it("server-renders the final value instead of 0", () => {
    const html = renderToStaticMarkup(<AnimatedNumber value={1234} />);
    expect(html).toContain("1,234");
    expect(html).not.toMatch(/>0</);
  });

  it("keeps the final value available to screen readers during the animation", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<AnimatedNumber value={906} />);
    });

    expect(host.querySelector(".sr-only")?.textContent).toBe("906");
    expect(host.querySelector("[data-animated-number]")?.getAttribute("aria-hidden")).toBe("true");
    act(() => root.unmount());
  });

  it("skips the animation when the user prefers reduced motion", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<AnimatedNumber value={42} />);
    });

    expect(host.querySelector("[data-animated-number]")?.textContent).toBe("42");
    act(() => root.unmount());
  });
});
