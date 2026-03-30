import { cn } from "@/lib/utils";

export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-moss/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-moss",
        className,
      )}
      {...props}
    />
  );
}
