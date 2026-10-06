import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrandLogo({
  className,
  priority = false,
  sizes = "240px",
  variant = "dark",
}: {
  className?: string;
  priority?: boolean;
  /** Rendered width. Without it Next requests 1920/3840px images for a ~230px logo, which
   * are slow to generate on a cold server and made the header logo appear late. */
  sizes?: string;
  variant?: "light" | "dark";
}) {
  return (
    <Image
      alt="The Jammers"
      // Fixed aspect ratio reserves the logo's space before the image arrives.
      className={cn(
        "h-auto w-full object-contain",
        variant === "dark" ? "aspect-[1540/316]" : "aspect-[700/180]",
        className,
      )}
      height={variant === "dark" ? 316 : 180}
      priority={priority}
      sizes={sizes}
      src={variant === "dark" ? "/brand/the-jammers-logo-wordmark.png" : "/brand/the-jammers-logo.png"}
      width={variant === "dark" ? 1540 : 700}
    />
  );
}
