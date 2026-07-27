import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

// Every size stays >= 44px tall — the app's minimum touch target throughout.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium " +
    "transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 " +
    "focus-visible:ring-[var(--color-ring-focus)] focus-visible:ring-offset-2 " +
    "disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-bg-primary text-text-on-primary hover:bg-bg-primary-hover shadow-sm",
        // Shaded, not white-on-white — but NEUTRAL. The amber tint clashed
        // with the amber accent; quiet warm grey keeps buttons visible while
        // the accent stays reserved for the mic and primary actions.
        secondary:
          "bg-bg-surface-alt text-text-primary border border-border-emphasis hover:bg-bg-muted",
        destructive: "bg-bg-danger text-text-on-dark hover:bg-bg-danger-hover",
        ghost: "text-text-secondary hover:bg-bg-surface-alt hover:text-text-primary",
      },
      size: {
        default: "h-11 px-4",
        sm: "h-11 px-3 text-xs shortscape:h-9",
        icon: "h-11 w-11 shrink-0",
        // The move keypad's two key sizes — piece keys read as the primary
        // control, file/rank keys pack eight to a row on a phone width.
        keypadPiece: "h-20 px-1 shortscape:h-16",
        keypadKey: "h-20 px-1 text-2xl shortscape:h-16",
      },
      active: {
        true: "bg-bg-primary text-text-on-primary border-transparent",
        false: "",
      },
    },
    defaultVariants: { variant: "primary", size: "default", active: false },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, active, ...props }, ref) => (
    <button className={cn(buttonVariants({ variant, size, active, className }))} ref={ref} {...props} />
  ),
);
Button.displayName = "Button";
