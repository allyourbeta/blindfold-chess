import { cn } from "@/lib/cn";
import { PieceGlyph } from "./PieceGlyph";

interface SquareProps {
  piece: string | null;
  light: boolean;
  highlighted?: boolean;
  interactive?: boolean;
  onClick?(): void;
  square?: string;
  /** Rank digit shown top-left — set on the left-most column only. */
  rankLabel?: string;
  /** File letter shown bottom-right — set on the bottom row only. */
  fileLabel?: string;
}

export function Square({
  piece,
  light,
  highlighted,
  interactive,
  onClick,
  square,
  rankLabel,
  fileLabel,
}: SquareProps) {
  // Opposite of the square's own colour, same convention Lichess uses --
  // it reads on both a light and a dark square without needing its own
  // background chip.
  const labelColor = light ? "text-sq-dark" : "text-sq-light";

  return (
    <div
      onClick={interactive ? onClick : undefined}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive && square ? `square ${square}` : undefined}
      data-square={square}
      onKeyDown={interactive ? (e) => (e.key === "Enter" || e.key === " ") && onClick?.() : undefined}
      className={cn(
        "relative flex aspect-square w-[12.5%] items-center justify-center transition-colors",
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
      {rankLabel && (
        <span className={cn("absolute left-[2px] top-0 font-mono text-[11px] font-bold leading-none", labelColor)}>
          {rankLabel}
        </span>
      )}
      {fileLabel && (
        <span
          className={cn("absolute bottom-0 right-[2px] font-mono text-[11px] font-bold leading-none", labelColor)}
        >
          {fileLabel}
        </span>
      )}
      {piece && <PieceGlyph piece={piece} />}
    </div>
  );
}
