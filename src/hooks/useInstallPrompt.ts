import { useEffect, useState } from "react";
import { installAdvice, readInstallEnvironment, type InstallAdvice } from "@/services/pwa/installState";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Captures the browser's install offer, if there is one, and reports which
 * advice the page should give. The event fires once and early, so it has to
 * be caught on mount rather than when the sheet opens.
 */
export function useInstallPrompt(): { advice: InstallAdvice; install(): Promise<void> } {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    function onBeforeInstall(event: Event) {
      event.preventDefault(); // keep the browser's own banner out of the way
      setPrompt(event as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setPrompt(null);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const env = readInstallEnvironment(prompt !== null);
  const advice = installed ? ({ kind: "installed" } as const) : installAdvice(env);

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
  }

  return { advice, install };
}
