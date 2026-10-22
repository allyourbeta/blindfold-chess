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

export function MessageLog() {
  const messages = useGameStore((s) => s.messages);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  return (
    <div ref={logRef} data-testid="message-log" className="mb-2 min-h-0 flex-1 overflow-y-auto py-1">
      {messages.map((m) => (
        <div key={m.id} className={cn("whitespace-pre-line px-3 py-1.5 text-base", TYPE_CLASSES[m.type])}>
          {m.text}
        </div>
      ))}
    </div>
  );
}
