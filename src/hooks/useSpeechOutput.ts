import { useEffect, useRef } from "react";
import { useGameStore } from "@/state/gameStore";
import { useSettingsStore } from "@/state/settingsStore";
import { useSpeechStore } from "@/state/speechStore";
import { CLIP_IDS } from "@/services/speech/phrase";
import { IS_IOS } from "@/services/speech/recognition";
import { utteranceForEvent } from "@/services/speech/utteranceForEvent";
import { playClipSequence, preloadClips } from "@/services/audio/clipPlayer";

let audioCtx: AudioContext | null = null;
function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new Ctor();
  }
  return audioCtx;
}

/** Unlocks audio playback on iOS — call this from a real user gesture (the New Game tap). */
export function unlockAudioOutput(): void {
  const ctx = getAudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  // Also unblocks speechSynthesis on some iOS versions.
  const unlockEl = new Audio();
  unlockEl.muted = true;
  unlockEl.play().catch(() => {}).finally(() => unlockEl.pause());
  preloadClips(ctx, CLIP_IDS);
}

const CLIP_GAP_MS = 90;
const IOS_INPUT_OUTPUT_HANDOFF_MS = 240;

async function waitForInputOutputHandoff(): Promise<void> {
  if (!IS_IOS) return;
  const listeningEndedAt = useSpeechStore.getState().listeningEndedAt;
  if (!listeningEndedAt) return;
  const remaining = IOS_INPUT_OUTPUT_HANDOFF_MS - (Date.now() - listeningEndedAt);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
}

// If speechSynthesis never fires onstart (common on iOS, where an utterance
// can silently go nowhere), give up after this long rather than hang the
// queue forever.
const SPEECH_START_TIMEOUT_MS = 2000;
// Absolute cap regardless of onstart, in case onend/onerror never fire either.
const SPEECH_ABSOLUTE_TIMEOUT_MS = 8000;

/** Speaks text and resolves when it has actually finished, so the queue can't overlap it. */
function speakText(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      resolve();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    let settled = false;
    let startTimer: ReturnType<typeof setTimeout> | null = null;

    const clearTimers = () => {
      if (startTimer) clearTimeout(startTimer);
      clearTimeout(absoluteTimer);
    };
    const settle = () => {
      if (settled) return;
      settled = true;
      clearTimers();
      resolve();
    };

    const absoluteTimer = setTimeout(() => {
      console.log(`[speech] speakText absolute timeout, cancelling: "${text}"`);
      window.speechSynthesis.cancel();
      settle();
    }, SPEECH_ABSOLUTE_TIMEOUT_MS);

    startTimer = setTimeout(() => {
      console.log(`[speech] speakText never fired onstart, cancelling: "${text}"`);
      window.speechSynthesis.cancel();
      settle();
    }, SPEECH_START_TIMEOUT_MS);

    utterance.onstart = () => {
      if (startTimer) clearTimeout(startTimer);
      startTimer = null;
    };
    utterance.onend = settle;
    utterance.onerror = settle;
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
// mutes the microphone.
// ---------------------------------------------------------------------------

type Utterance = {
  clips: string[] | null;
  text: string;
  /**
   * Whether the echo filter should remember this text. True for sentence
   * phrases (rejections, "didn't catch that", game end); false for move
   * announcements, which are too move-shaped to match against safely — their
   * echoes are caught by the grace window instead. See services/speech/echo.ts.
   */
  remember: boolean;
};

let queue: Utterance[] = [];
let draining = false;

// Loop breaker: if the last thing we said was "sorry, I did not catch that",
// don't say it again for the very next failure — the screen message still
// shows. Without this, one echo slipping through the filters can chain the
// clip into an endless self-conversation. Persisted across events here (not
// in the pure decision function) because it's sequencing state, not part of
// any single event's inputs.
let spokeNotUnderstoodLast = false;

/** Drops anything queued but not yet spoken — used when a game starts or ends. */
export function resetSpeechQueue(): void {
  queue = [];
  spokeNotUnderstoodLast = false;
  window.speechSynthesis?.cancel();
}

function enqueueSpeech(utterance: Utterance): void {
  queue.push(utterance);
  if (!draining) void drainQueue();
}

async function drainQueue(): Promise<void> {
  draining = true;
  useSpeechStore.getState().setSpeaking(true);
  try {
    let next = queue.shift();
    while (next) {
      if (next.remember) useSpeechStore.getState().rememberSpokenText(next.text);
      // The app deliberately generates no confirmation tones.
      // No throw here — from a bad clip fetch to a browser speechSynthesis
      // quirk — may skip this `finally` and leave isSpeaking stuck true.
      try {
        await waitForInputOutputHandoff();
        if (next.clips?.length) {
          try {
            await playClipSequence(getAudioContext(), next.clips, CLIP_GAP_MS);
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
    // replayed then — flipping Alpha/NATO used to repeat the last move aloud.
    if (audioEvent === lastHandledRef.current) return;
    lastHandledRef.current = audioEvent;
    if (!audioEvent) {
      resetSpeechQueue();
      return;
    }

    const decision = utteranceForEvent(audioEvent, speechMode, fileNaming, spokeNotUnderstoodLast);
    spokeNotUnderstoodLast = decision.spokeNotUnderstoodLast;
    if (decision.utterance) enqueueSpeech(decision.utterance);
  }, [audioEvent, speechMode, fileNaming]);
}
