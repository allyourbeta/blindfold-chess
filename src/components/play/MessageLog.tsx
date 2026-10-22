import { useEffect, useRef } from "react";
import { useGameStore, type MessageType } from "@/state/gameStore";
import { cn } from "@/lib/cn";

const TYPE_CLASSES: Record<MessageType, string> = {
  system: "text-text-secondary",
  player: "font-mono text-text-success",
  engine: "font-mono text-text-accent",
  error: "rounded bg-bg-error-soft text-text-error",
  thinking: "italic text-text-accent",
};

/** Within this of the bottom still counts as "at the bottom" -- see onScroll below. */
const AT_BOTTOM_THRESHOLD = 24;

export function MessageLog() {
  const messages = useGameStore((s) => s.messages);
  const logRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  useEffect(() => {
    const el = logRef.current;
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  function onScroll() {
    const el = logRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < AT_BOTTOM_THRESHOLD;
  }

  return (
    <div
      ref={logRef}
      data-testid="message-log"
      onScroll={onScroll}
      className="mb-2 flex min-h-0 flex-1 flex-col overflow-y-auto py-1"
    >
      <div className="mt-auto">
        {messages.map((m) => (
          <div key={m.id} className={cn("whitespace-pre-line px-3 py-1.5 text-base", TYPE_CLASSES[m.type])}>
            {m.text}
          </div>
        ))}
      </div>
    </div>
  );
}
