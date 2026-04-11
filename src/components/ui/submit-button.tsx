"use client";

import { useFormStatus } from "react-dom";

import { Loader } from "@/components/ui/loader";
import { Button, type ButtonProps } from "@/components/ui/button";

export function SubmitButton({
  children,
  pendingLabel = "Working...",
  ...props
}: ButtonProps & { pendingLabel?: string }) {
  const { pending } = useFormStatus();

  return (
    <Button aria-busy={pending} disabled={pending || props.disabled} {...props}>
      {pending ? (
        <>
          <Loader className="text-white" />
          <span>{pendingLabel}</span>
        </>
      ) : (
        children
      )}
    </Button>
  );
}
