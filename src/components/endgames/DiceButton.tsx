import { Dice5 } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface DiceButtonProps {
  ariaLabel: string;
  disabled?: boolean;
  onClick(): void;
}

/** Square random-position control for an endgames header's right slot (SPEC_buttons_results.md). */
export function DiceButton({ ariaLabel, disabled, onClick }: DiceButtonProps) {
  return (
    <Button variant="secondary" size="dice" aria-label={ariaLabel} disabled={disabled} onClick={onClick}>
      <Dice5 className="h-[26px] w-[26px]" />
    </Button>
  );
}
