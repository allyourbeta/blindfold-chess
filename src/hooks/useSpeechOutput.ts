import { useEffect, useRef } from "react";
import { useGameStore } from "@/state/gameStore";
import { useSettingsStore } from "@/state/settingsStore";
import { useSpeechStore } from "@/state/speechStore";
import { CLIP_IDS } from "@/services/speech/phrase";
import { IS_IOS } from "@/services/platform";
import { utteranceForEvent, type SpokenUtterance } from "@/services/speech/utteranceForEvent";
import { playClipSequence, preloadClips } from "@/services/audio/clipPlayer";

let audioCtx: AudioContext | null = null;

const PLAYBACK_MIN_SAMPLE_RATE = 44100;

function createContext(): AudioContext {
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  return new Ctor();
}

function getAudioContext(): AudioContext {
  if (!audioCtx) audioCtx = createContext();
  return audioCtx;
}

/**
 * An AudioContext created (or left running) while iOS had the microphone
 * route open can be pinned to a low voice-processing sample rate. Playing
 * 22 kHz speech clips through that pinned context sounds like static.
 * After the route is back to normal, a context reporting a voice rate is
 * discarded and rebuilt on the clean route. Decoded clip buffers survive —
 * they are cached independently of any context.
 */
function getPlaybackContext(): AudioContext {
  const ctx = getAudioContext();
  if (ctx.sampleRate >= PLAYBACK_MIN_SAMPLE_RATE) return ctx;
  console.log(`[audio] discarding AudioContext pinned at ${ctx.sampleRate} Hz`);
  void ctx.close().catch(() => {});
  audioCtx = createContext();
  return audioCtx;
}

/** Unlocks audio playback on iOS — call this from a real user gesture (the New Game tap). */
export function unlockAudioOutput(): void {
  // Tessa clips are the voice everywhere; native speechSynthesis is only a fallback.
  if (IS_IOS) window.speechSynthesis?.resume();

  const ctx = getAudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  preloadClips(ctx, CLIP_IDS);
}

const CLIP_GAP_MS = 90;

// If speechSynthesis never fires onstart (common on iOS, where an utterance
// can silently go nowhere), give up after this long rather than hang the
// queue forever.
const SPEECH_START_TIMEOUT_MS = 2000;
// Absolute cap regardless of onstart, in case onend/onerror never fire either.
const SPEECH_ABSOLUTE_TIMEOUT_MS = 8000;

/** Speaks text and resolves when it has actually finished, so the queue can't overlap it. */
function speakText(text: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      resolve(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.9;

    let settled = false;
    let started = false;
    let startTimer: ReturnType<typeof setTimeout> | null = null;

    const clearTimers = () => {
      if (startTimer) clearTimeout(startTimer);
      clearTimeout(absoluteTimer);
    };
    const settle = (didStart: boolean) => {
      if (settled) return;
      settled = true;
      clearTimers();
      resolve(didStart);
    };

    const absoluteTimer = setTimeout(() => {
      console.log(`[speech] speakText absolute timeout, cancelling: "${text}"`);
      window.speechSynthesis.cancel();
      settle(started);
    }, SPEECH_ABSOLUTE_TIMEOUT_MS);

    startTimer = setTimeout(() => {
      console.log(`[speech] speakText never fired onstart, cancelling: "${text}"`);
      window.speechSynthesis.cancel();
      settle(false);
    }, SPEECH_START_TIMEOUT_MS);

    utterance.onstart = () => {
      started = true;
      if (startTimer) clearTimeout(startTimer);
      startTimer = null;
    };
    utterance.onend = () => settle(started);
    utterance.onerror = () => settle(started);
    window.speechSynthesis.speak(utterance);
  });
}

// ---------------------------------------------------------------------------
// Speech queue
//
// Every spoken thing goes through this one queue and plays strictly one at a
// time. Without it a player-move readback and the engine's reply — which can
// arrive well under a second later — start playing on top of each other.
// Serialising here also keeps the "speaking" flag honest, which is what
// the keypad watches to go inert.
// ---------------------------------------------------------------------------

let queue: SpokenUtterance[] = [];
let draining = false;

/** Drops anything queued but not yet spoken — used when a game starts or ends. */
export function resetSpeechQueue(): void {
  queue = [];
  window.speechSynthesis?.cancel();
}

function enqueueSpeech(utterance: SpokenUtterance): void {
  queue.push(utterance);
  if (!draining) void drainQueue();
}

async function drainQueue(): Promise<void> {
  draining = true;
  useSpeechStore.getState().setSpeaking(true);
  try {
    let next = queue.shift();
    while (next) {
      // The app deliberately generates no confirmation tones.
      // No throw here — from a bad clip fetch to a browser speechSynthesis
      // quirk — may skip this `finally` and leave isSpeaking stuck true.
      try {
        if (next.clips?.length) {
          try {
            await playClipSequence(getPlaybackContext(), next.clips, CLIP_GAP_MS);
          } catch {
            await speakText(next.text);
          }
        } else if (next.text) {
          await speakText(next.text);
        }
      } catch {
        // Give up on this utterance and move on to the next.
      }
      next = queue.shift();
    }
  } finally {
    draining = false;
    useSpeechStore.getState().setSpeaking(false);
  }
}

/** Reacts to gameStore audio events and queues spoken feedback when enabled. */
export function useSpeechOutput() {
  const audioEvent = useGameStore((s) => s.audioEvent);
  const speechMode = useSettingsStore((s) => s.speechMode);
  const fileNaming = useSettingsStore((s) => s.fileNaming);
  const lastHandledRef = useRef<typeof audioEvent>(null);

  useEffect(() => {
    // This effect also re-runs when speechMode/fileNaming change (they decide
    // HOW a future event will sound). An already-handled event must not be
    // replayed then — flipping the speech setting used to repeat the last
    // move aloud.
    if (audioEvent === lastHandledRef.current) return;
    lastHandledRef.current = audioEvent;
    if (!audioEvent) {
      resetSpeechQueue();
      return;
    }

    const utterance = utteranceForEvent(audioEvent, speechMode, fileNaming);
    if (utterance) enqueueSpeech(utterance);
  }, [audioEvent, speechMode, fileNaming]);
}
