"use client";

import Link, { useLinkStatus } from "next/link";

import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";

function LinkLabel({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useLinkStatus();

  return (
    <span aria-busy={pending} aria-live="polite" className="inline-flex items-center gap-2">
      {pending ? <Loader /> : null}
      {pending ? pendingLabel : label}
    </span>
  );
}

export function AdminEventLink({ href, label, pendingLabel }: {
  href: string;
  label: string;
  pendingLabel: string;
}) {
  return (
    <Button asChild size="sm" variant="secondary">
      <Link href={href}>
        <LinkLabel label={label} pendingLabel={pendingLabel} />
      </Link>
    </Button>
  );
}
