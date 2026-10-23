import { useCreator } from "@/state/creatorStore";

/**
 * Unlock this device with a password prompt, or -- already unlocked -- offer
 * to lock it again. Shared by `#creator` (App.tsx) and the menu's hidden
 * build-line tap sequence (MenuScreen.tsx).
 */
export function promptCreatorUnlock(): void {
  const creator = useCreator.getState();
  if (creator.password !== null) {
    if (window.confirm("Lock this device?")) creator.lock();
    return;
  }
  const entered = window.prompt("Password:");
  if (entered === null) return;
  void creator.unlock(entered).then((ok) => {
    if (!ok) window.alert("Wrong password");
  });
}
