import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";

/** Shared screenhead for every Endgame Lab view -- matches SetupScreen's header pattern. */
export function EndgamesHeader({
  title,
  subtitle,
  backLabel,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  /** "Menu" on the lab home (it goes to the menu); "Back" on every inner lab screen. */
  backLabel: "Menu" | "Back";
  onBack(): void;
  /** An optional control at the header's right edge, e.g. the position screen's favorite star. */
  right?: ReactNode;
}) {
  return (
    <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-border-default pb-1.5">
      <button
        onClick={onBack}
        aria-label="Back"
        className="raised flex h-11 items-center justify-self-start gap-1 rounded-full px-3 text-sm font-bold text-text-primary"
      >
        <ChevronLeft className="h-4 w-4" />
        {backLabel}
      </button>
      <div className="min-w-0">
        <h1 className="text-center text-xl font-extrabold whitespace-nowrap text-text-accent max-[380px]:text-lg">
          {title}
        </h1>
        {subtitle && (
          <p className="mx-auto max-w-[60vw] truncate text-center text-sm text-text-secondary">{subtitle}</p>
        )}
      </div>
      <div className="justify-self-end">{right}</div>
    </header>
  );
}
