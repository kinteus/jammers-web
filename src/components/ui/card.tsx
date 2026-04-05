import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "panel-linear relative overflow-hidden p-6 text-sand transition duration-200 hover:-translate-y-0.5 hover:border-white/16 hover:shadow-card",
        className,
      )}
      {...props}
    />
  );
}
