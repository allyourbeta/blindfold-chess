import { cn } from "@/lib/cn";
import { PieceGlyph } from "./PieceGlyph";

interface SquareProps {
  piece: string | null;
  light: boolean;
  highlighted?: boolean;
  interactive?: boolean;
  onClick?(): void;
  square?: string;
}

export function Square({ piece, light, highlighted, interactive, onClick, square }: SquareProps) {
  return (
    <div
      onClick={interactive ? onClick : undefined}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive && square ? `square ${square}` : undefined}
      data-square={square}
      onKeyDown={interactive ? (e) => (e.key === "Enter" || e.key === " ") && onClick?.() : undefined}
      className={cn(
        "flex aspect-square w-[12.5%] items-center justify-center transition-colors",
        interactive && "cursor-pointer active:brightness-95",
        light
          ? highlighted
            ? "bg-sq-hl-light"
            : "bg-sq-light"
          : highlighted
            ? "bg-sq-hl-dark"
            : "bg-sq-dark",
      )}
    >
      {piece && <PieceGlyph piece={piece} />}
    </div>
  );
}
