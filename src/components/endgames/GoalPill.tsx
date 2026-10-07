import { cn } from "@/lib/cn";

export function GoalPill({ goal }: { goal: "win" | "draw" }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold",
        goal === "win" ? "bg-bg-primary-soft text-text-accent" : "bg-bg-muted text-text-secondary",
      )}
    >
      {goal === "win" ? "Win" : "Draw"}
    </span>
  );
}
