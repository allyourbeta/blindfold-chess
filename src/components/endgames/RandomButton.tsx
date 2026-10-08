import { Shuffle } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface RandomButtonProps {
  ariaLabel: string;
  disabled?: boolean;
  onClick(): void;
}

/** Square random-position control for an endgames header's right slot (SPEC_buttons_results.md, SPEC_random_leave.md). */
export function RandomButton({ ariaLabel, disabled, onClick }: RandomButtonProps) {
  return (
    <Button variant="secondary" size="random" aria-label={ariaLabel} disabled={disabled} onClick={onClick}>
      <Shuffle className="h-6 w-6" />
      <span>Random</span>
    </Button>
  );
}
