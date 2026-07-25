import { useState, type FormEvent } from "react";
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
      {/* No send button: Enter (or the keyboard's Go key) submits the
          single-input form, and the freed corner makes the mic a real
          thumb target instead of a precision tap. */}
      <button type="submit" hidden aria-hidden tabIndex={-1} />
    </form>
  );
}
