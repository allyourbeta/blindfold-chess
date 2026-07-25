import { cn } from "@/lib/cn";

interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange(value: T): void;
  "aria-label": string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  "aria-label": ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex gap-2">
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              "min-h-11 flex-1 rounded-xl border px-3 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring-focus)] focus-visible:ring-offset-2",
              selected
                ? "border-transparent bg-bg-primary text-text-on-primary"
                : "border-border-default bg-bg-surface text-text-primary hover:bg-bg-surface-alt",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
