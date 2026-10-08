import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

/** Shared screenhead for every endgames view -- matches SetupScreen's header pattern. */
export function EndgamesHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle: string;
  onBack(): void;
  /** An optional control at the header's right edge, e.g. the position screen's favorite star. */
  right?: ReactNode;
}) {
  return (
    <header className="flex items-center gap-3 border-b border-border-default pb-4 pt-2">
      <button
        onClick={onBack}
        aria-label="Back"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-bg-surface-alt"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="text-lg font-semibold text-text-accent">{title}</h1>
        <p className="text-sm text-text-secondary">{subtitle}</p>
      </div>
      {right}
    </header>
  );
}
