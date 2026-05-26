/**
 * @vitest-environment jsdom
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("React", React);
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ConfirmSubmitButton", () => {
  it("opens a browser modal confirmation before submitting", () => {
    const submit = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault());
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(
      <form onSubmit={submit}>
        <ConfirmSubmitButton confirmMessage="Run selection and close the board?" type="submit">
          Run selection
        </ConfirmSubmitButton>
      </form>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Run selection" }));

    expect(confirmSpy).toHaveBeenCalledWith("Run selection and close the board?");
    expect(submit).not.toHaveBeenCalled();
  });

  it("submits after the modal confirmation is accepted", () => {
    const submit = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault());
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <form onSubmit={submit}>
        <ConfirmSubmitButton confirmMessage="Run selection and close the board?" type="submit">
          Run selection
        </ConfirmSubmitButton>
      </form>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Run selection" }));

    expect(submit).toHaveBeenCalledTimes(1);
  });
});
