import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrandLogo({
  className,
  priority = false,
  variant = "dark",
}: {
  className?: string;
  priority?: boolean;
  variant?: "light" | "dark";
}) {
  return (
    <Image
      alt="The Jammers"
      className={cn("h-auto w-full object-contain", className)}
      height={variant === "dark" ? 316 : 180}
      priority={priority}
      src={variant === "dark" ? "/brand/the-jammers-logo-wordmark.png" : "/brand/the-jammers-logo.png"}
      width={variant === "dark" ? 1540 : 700}
    />
  );
}
