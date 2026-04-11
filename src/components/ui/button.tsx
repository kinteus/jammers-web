import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-sm border text-sm font-semibold uppercase tracking-[0.12em] transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 will-change-transform hover:-translate-y-0.5 active:translate-y-0.5 active:scale-[0.985] active:shadow-none aria-[busy=true]:cursor-wait",
  {
    variants: {
      variant: {
        primary: "border-red bg-red text-white shadow-card hover:border-red/90 hover:bg-red/90 hover:shadow-glow",
        secondary: "border-white/14 bg-stage text-sand hover:border-gold/28 hover:text-white",
        accent: "border-blue bg-blue text-white shadow-card hover:border-blue/90 hover:bg-blue/90 hover:shadow-glow",
        ghost: "border-transparent bg-transparent text-white/78 hover:border-white/10 hover:bg-white/8 hover:text-white",
      },
      size: {
        sm: "h-8 px-3.5 text-[11px]",
        md: "h-10 px-4 text-[11px]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
