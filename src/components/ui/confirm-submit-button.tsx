"use client";

import type { MouseEvent } from "react";

import { SubmitButton } from "@/components/ui/submit-button";
import type { ButtonProps } from "@/components/ui/button";

export function ConfirmSubmitButton({
  confirmMessage,
  onClick,
  ...props
}: ButtonProps & {
  confirmMessage: string;
  pendingLabel?: string;
}) {
  return (
    <SubmitButton
      {...props}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
          return;
        }

        onClick?.(event);
      }}
    />
  );
}
