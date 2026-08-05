import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

// Every size stays >= 44px tall — the app's minimum touch target throughout.
const buttonVariants = cva(
  // NO font size here. Tailwind emits the text-* utilities in alphabetical
  // order, so a `text-sm` in this base string SILENTLY BEATS text-base,
  // text-lg, text-2xl, text-3xl and text-4xl added by a size variant or a
  // className — equal specificity, and .text-sm is simply written later.
  // (text-xl and text-xs happen to sort after it and win, which is what
  // made the bug so hard to see: some overrides worked.) Every size
  // variant below therefore declares its own font size, and nothing else
  // in this file sets one.
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium " +
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
        default: "h-11 px-4 text-sm",
        // `sm` is a narrower button, not a smaller typeface: it used to drop
        // to text-xs (12px), which made Resign/More and the setup buttons the
        // smallest interactive text in the app for no reason.
        sm: "h-11 px-3 text-sm shortscape:h-9",
        // The move chooser (Nbd2 / Nfd2, promotion pieces) is the one place
        // you must READ a button before tapping it, and it appears mid-move
        // with no board to fall back on. It gets its own size rather than a
        // class-append override — `cn` is plain clsx with no tailwind-merge,
        // so appending a second text-* class leaves both in the markup and
        // lets CSS source order decide the winner.
        chooser: "h-11 px-4 text-lg shortscape:h-9 shortscape:text-base",
        icon: "h-11 w-11 shrink-0 text-sm",
        // The move keypad's two key sizes — piece keys read as the primary
        // control, file/rank keys pack eight to a row on a phone width.
        keypadPiece: "h-20 px-1 text-sm shortscape:h-16",
        keypadKey: "h-20 px-1 text-2xl shortscape:h-16",
        // The castle/backspace row — short, rarely tapped, but still has to
        // be read. Its own size rather than `default` plus a className.
        keypadRow: "h-9 px-2 text-base",
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
