import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[2rem] border border-ink/10 bg-white/90 p-6 shadow-card backdrop-blur",
        className,
      )}
      {...props}
    />
  );
}
