import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-data uppercase tracking-[0.18em]",
  {
    variants: {
      variant: {
        default: "border border-line text-fg/60",
        signal: "bg-signal/15 text-signal border border-signal/30",
        gold: "bg-gold/10 text-gold border border-gold/30",
        live: "bg-signal text-fg",
        ghost: "text-fg/40",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
