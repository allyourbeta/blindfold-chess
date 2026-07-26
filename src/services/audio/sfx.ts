import { getOutputNode } from "./master";

/**
 * Confirmation tones generated with the Web Audio API — no audio files.
 * Each function takes an AudioContext rather than reaching for `window`
 * itself, so this stays a plain function with no browser globals baked in;
 * the caller owns creating/unlocking the context.
 */

export function playMoveTone(ctx: AudioContext): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(getOutputNode(ctx));
  osc.type = "sine";
  osc.frequency.value = 600;
  gain.gain.value = 0.12;
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.12);
}

export function playCaptureTone(ctx: AudioContext): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(getOutputNode(ctx));
  osc.type = "sine";
  osc.frequency.value = 440;
  gain.gain.value = 0.15;
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.18);
}

export function playErrorTone(ctx: AudioContext): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(getOutputNode(ctx));
  osc.type = "square";
  osc.frequency.setValueAtTime(300, ctx.currentTime);
  osc.frequency.setValueAtTime(200, ctx.currentTime + 0.1);
  gain.gain.value = 0.08;
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.25);
}
