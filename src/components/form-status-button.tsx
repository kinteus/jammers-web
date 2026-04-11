"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";

import { cn } from "@/lib/utils";

import { Loader } from "@/components/ui/loader";

type FormStatusButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingClassName?: string;
  pendingLabel?: string;
  pendingVariant?: "icon" | "inline";
};

export function FormStatusButton({
  children,
  className,
  disabled,
  pendingClassName,
  pendingLabel = "Working...",
  pendingVariant = "inline",
  ...props
}: FormStatusButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      aria-busy={pending}
      className={cn(className, pending && pendingClassName)}
      disabled={pending || disabled}
      {...props}
    >
      {pending ? (
        pendingVariant === "icon" ? (
          <Loader className="text-current" />
        ) : (
          <>
            <Loader className="text-current" />
            <span>{pendingLabel}</span>
          </>
        )
      ) : (
        children
      )}
    </button>
  );
}
