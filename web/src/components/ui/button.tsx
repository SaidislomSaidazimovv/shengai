import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Clinical button.
 *
 * Per the dev handover §10 motion direction ("sharp, not bouncy. No
 * spring animations. Easing should feel forensic, not playful."): no
 * translate, no scale, no glow shadows. Only colour and border shift
 * on hover; focus ring stays for keyboard accessibility.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-stamp uppercase tracking-tighter transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        // Black surface on the light canvas — the workhorse button.
        default: "bg-fg text-bg hover:bg-fg/85",
        // Signal red surface — used in DIAGNOSIS only (v02 §5.2). Force
        // white text since the page fg is now black on a light canvas.
        signal: "bg-signal text-white hover:bg-signal-600",
        // Gold surface — used in GOLDEN VOICE only (v02 §5.2). Force
        // white text for legible contrast on the warm gold.
        gold: "bg-gold text-white hover:bg-gold-600",
        ghost: "text-fg/70 hover:text-fg hover:bg-fg/[0.04]",
        outline:
          "border border-line text-fg hover:border-fg/40 hover:bg-fg/[0.03]",
      },
      size: {
        // Heights tuned for touch: sm bumped from 32 → 36px (the iOS
        // 44px guideline is for primary actions only; 36 is acceptable
        // for secondary controls and matches Material density-3).
        default: "h-10 px-5 text-sm",
        sm: "h-9 px-3 text-xs",
        lg: "h-12 px-7 text-base",
        xl: "h-14 px-9 text-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
