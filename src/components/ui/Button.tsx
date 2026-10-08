import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

// Every size stays >= 44px tall — the app's minimum touch target throughout.
const buttonVariants = cva(
  // NO font size, rounding or whitespace handling here. Tailwind emits
  // utilities for a given CSS property in alphabetical order, so e.g. a
  // `text-sm` in this base string SILENTLY BEATS text-base, text-lg,
  // text-2xl, text-3xl and text-4xl added by a size variant or a className —
  // equal specificity, and .text-sm is simply written later. (text-xl and
  // text-xs happen to sort after it and win, which is what made the bug so
  // hard to see: some overrides worked.) The same trap applies to
  // rounded-xl vs rounded-2xl and whitespace-nowrap vs the wrap big/dice
  // need, so every size variant below declares its own font size, rounding
  // and whitespace handling, and nothing else in this file sets any of them.
  "inline-flex items-center justify-center gap-2 font-medium " +
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
        default: "h-11 whitespace-nowrap rounded-xl px-4 text-sm",
        // `sm` is a narrower button, not a smaller typeface: it used to drop
        // to text-xs (12px), which made Resign/More and the setup buttons the
        // smallest interactive text in the app for no reason.
        sm: "h-11 whitespace-nowrap rounded-xl px-3 text-sm shortscape:h-9",
        // The move chooser (Nbd2 / Nfd2, promotion pieces) is the one place
        // you must READ a button before tapping it, and it appears mid-move
        // with no board to fall back on. It gets its own size rather than a
        // class-append override — `cn` is plain clsx with no tailwind-merge,
        // so appending a second text-* class leaves both in the markup and
        // lets CSS source order decide the winner.
        chooser: "h-11 whitespace-nowrap rounded-xl px-4 text-lg shortscape:h-9 shortscape:text-base",
        icon: "h-11 w-11 shrink-0 whitespace-nowrap rounded-xl text-sm",
        // The move keypad's two key sizes — piece keys read as the primary
        // control, file/rank keys pack eight to a row on a phone width.
        keypadPiece: "h-20 whitespace-nowrap rounded-xl px-1 text-sm shortscape:h-16",
        keypadKey: "h-20 whitespace-nowrap rounded-xl px-1 text-2xl shortscape:h-16",
        // The castle/backspace row — short, rarely tapped, but still has to
        // be read. Its own size rather than `default` plus a className.
        keypadRow: "h-9 whitespace-nowrap rounded-xl px-2 text-base",
        // The endgames position screen's side-by-side pair
        // (SPEC_buttons_results.md): tall enough for a two-line label, so no
        // whitespace-nowrap -- the browser default (normal) lets it wrap.
        big: "h-16 rounded-2xl px-2.5 text-center text-sm font-bold leading-tight",
        // The square random-position button (SPEC_buttons_results.md) -- icon only.
        dice: "h-14 w-14 shrink-0 rounded-2xl p-0",
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
