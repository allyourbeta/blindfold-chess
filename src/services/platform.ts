/** Platform detection used outside the (now-removed) speech-recognition path. */

const nav = typeof navigator === "undefined" ? null : navigator;

export const IS_IOS =
  !!nav && (/iP(hone|od|ad)/.test(nav.userAgent) || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1));
