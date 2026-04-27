"use client";

import { useFormStatus } from "react-dom";

import { Loader } from "@/components/ui/loader";
import { Button, type ButtonProps } from "@/components/ui/button";

export function SubmitButton({
  children,
  pendingLabel = "",
  ...props
}: ButtonProps & { pendingLabel?: string }) {
  const { pending } = useFormStatus();

  return (
    <Button aria-busy={pending} disabled={pending || props.disabled} {...props}>
      {pending ? (
        <>
          <Loader className="text-white" />
          {pendingLabel ? <span>{pendingLabel}</span> : null}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
