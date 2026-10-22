/**
 * Haptic feedback, as a small owned module rather than a dependency -- see
 * SPEC_rename_haptics.md. No on/off setting: the phone's own System Haptics
 * switch governs it, and a laptop with neither mechanism simply feels
 * nothing.
 *
 * Two mechanisms:
 *  - Android/Chrome: `navigator.vibrate()`.
 *  - iOS Safari (since 17.4): toggling a hidden `<input type="checkbox"
 *    switch>` fires the system haptic -- there is no vibration API there.
 *    The input is created once and reused, appended to `document.body`,
 *    `aria-hidden` and off-screen so it never shows up to a sighted user or
 *    a screen reader.
 *
 * Both calls are no-ops when `document` is missing (unit tests run in
 * jsdom without a body in some setups) and never throw.
 */

let switchLabel: HTMLLabelElement | null = null;

function getSwitchLabel(): HTMLLabelElement | null {
  if (typeof document === "undefined") return null;
  if (switchLabel) return switchLabel;

  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  input.tabIndex = -1;
  input.setAttribute("aria-hidden", "true");
  input.style.position = "fixed";
  input.style.left = "-9999px";
  input.style.width = "1px";
  input.style.height = "1px";

  const label = document.createElement("label");
  label.setAttribute("aria-hidden", "true");
  label.style.position = "fixed";
  label.style.left = "-9999px";
  label.appendChild(input);
  document.body.appendChild(label);

  switchLabel = label;
  return label;
}

function canVibrate(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

export function hapticTap(): void {
  try {
    if (canVibrate()) {
      navigator.vibrate(10);
      return;
    }
    getSwitchLabel()?.click();
  } catch {
    // Never throw -- a missing or misbehaving haptic path must not break the tap it rides along with.
  }
}

const ERROR_TAP_GAP_MS = 80;

export function hapticError(): void {
  try {
    if (canVibrate()) {
      navigator.vibrate([30, 60, 30, 60, 30]);
      return;
    }
    hapticTap();
    setTimeout(hapticTap, ERROR_TAP_GAP_MS);
    setTimeout(hapticTap, ERROR_TAP_GAP_MS * 2);
  } catch {
    // Never throw.
  }
}
