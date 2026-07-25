import { cn } from "@/lib/cn";

interface ToggleProps {
  checked: boolean;
  onChange(checked: boolean): void;
  label: string;
  id?: string;
}

export function Toggle({ checked, onChange, label, id }: ToggleProps) {
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-text-primary">
      <span className="relative inline-flex h-7 w-12 shrink-0 items-center">
        <input
          id={id}
          type="checkbox"
          role="switch"
          aria-checked={checked}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span
          className={cn(
            "absolute inset-0 rounded-full transition-colors",
            checked ? "bg-bg-primary" : "bg-bg-muted",
            "peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-ring-focus)] peer-focus-visible:ring-offset-2",
          )}
        />
        <span
          className={cn(
            "relative inline-block h-5 w-5 translate-x-1 rounded-full bg-bg-surface shadow transition-transform",
            checked && "translate-x-6",
          )}
        />
      </span>
      {label}
    </label>
  );
}
