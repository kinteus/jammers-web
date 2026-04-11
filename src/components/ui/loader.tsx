import { LoaderCircle } from "lucide-react";

import { cn } from "@/lib/utils";

export function Loader({
  className,
  label,
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm text-white/72", className)}>
      <LoaderCircle className="h-4 w-4 animate-spin text-gold" />
      {label ? <span>{label}</span> : null}
    </span>
  );
}
