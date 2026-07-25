import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface ModalProps {
  open: boolean;
  onClose?(): void;
  children: ReactNode;
  className?: string;
}

export function Modal({ open, onClose, children, className }: ModalProps) {
  useEffect(() => {
    if (!open || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "w-full max-w-sm rounded-2xl border border-border-default bg-bg-surface p-6 shadow-lg",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
