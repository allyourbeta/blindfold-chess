import { useState, type FormEvent } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useGameStore } from "@/state/gameStore";

/** The mic sits in this row, not the header: it's an input method, not an action. */
export function MoveInput({ mic }: { mic?: React.ReactNode }) {
  const [value, setValue] = useState("");
  const submitMoveText = useGameStore((s) => s.submitMoveText);
  const gameOverFlag = useGameStore((s) => s.gameOverFlag);
  const isThinking = useGameStore((s) => s.isThinking);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = value;
    setValue("");
    submitMoveText(text);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        autoComplete="off"
        disabled={gameOverFlag}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={isThinking ? "Engine thinking..." : "Your move... (Space to peek)"}
        aria-label="Your move"
        className="min-h-11 flex-1 rounded-xl border border-border-default bg-bg-surface px-4 text-base text-text-primary placeholder:text-text-muted focus:border-border-active focus:outline-none disabled:opacity-60"
      />
      {mic}
      <Button type="submit" size="icon" aria-label="Submit move" disabled={gameOverFlag}>
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
}
