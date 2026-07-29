/**
 * What to tell someone about installing this app.
 *
 * The two platforms are not symmetrical. Chrome and Edge hand the page a
 * `beforeinstallprompt` event, so a single button can do the whole job. iOS
 * allows no programmatic install at all — Safari's Share sheet is the only
 * route, so the best the app can do is name the two taps.
 *
 * Kept pure and separate from the React that uses it so both branches can be
 * tested without a browser.
 */
export type InstallAdvice =
  | { kind: "installed" }
  | { kind: "prompt" }
  | { kind: "ios-manual" }
  | { kind: "unavailable" };

export interface InstallEnvironment {
  /** The app is already running from the home screen / app window. */
  standalone: boolean;
  /** A `beforeinstallprompt` event has been captured and can still be used. */
  hasPrompt: boolean;
  /** An Apple touch device, where the Share sheet is the only route. */
  isAppleTouch: boolean;
}

export function installAdvice(env: InstallEnvironment): InstallAdvice {
  // Never invite someone to install the thing they're already using.
  if (env.standalone) return { kind: "installed" };
  if (env.hasPrompt) return { kind: "prompt" };
  if (env.isAppleTouch) return { kind: "ios-manual" };
  return { kind: "unavailable" };
}

/** Reads the environment from the browser. Not pure — see installAdvice for the decision. */
export function readInstallEnvironment(hasPrompt: boolean): InstallEnvironment {
  const nav = navigator as Navigator & { standalone?: boolean };
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches === true || nav.standalone === true;

  // iPadOS reports itself as a Mac, so touch capability is part of the test.
  const ua = navigator.userAgent;
  const isAppleTouch =
    /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);

  return { standalone, hasPrompt, isAppleTouch };
}
