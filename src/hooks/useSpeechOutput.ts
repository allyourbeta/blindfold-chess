import { useEffect, useRef } from "react";
import { useGameStore } from "@/state/gameStore";
import { useSettingsStore } from "@/state/settingsStore";
import { useSpeechStore } from "@/state/speechStore";
import { CLIP_IDS } from "@/services/speech/phrase";
import { IS_IOS } from "@/services/speech/recognition";
import { utteranceForEvent } from "@/services/speech/utteranceForEvent";
import { playClipSequence, preloadClips } from "@/services/audio/clipPlayer";
import { setAudioSessionType, waitForPlaybackRoute } from "@/services/audio/audioSession";

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
  // Tessa clips are the voice everywhere again. The native-utterance
  // experiment proved the static was not the clips' fault (native speech
  // crackled identically after microphone use), so it is now only a
  // fallback. See services/audio/audioSession.ts for the actual fix.
  if (IS_IOS) window.speechSynthesis?.resume();

  const ctx = getAudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  preloadClips(ctx, CLIP_IDS);
}

const CLIP_GAP_MS = 90;
const ROUTE_RECOVERY_TIMEOUT_MS = 1500;

/**
 * Before speaking on iOS after the microphone has been used, insist on the
 * playback route and WAIT until the hardware actually reports it — a fixed
 * delay guesses; the sample-rate probe verifies. See audioSession.ts.
 */
async function waitForInputOutputHandoff(): Promise<void> {
  if (!IS_IOS) return;
  if (!useSpeechStore.getState().listeningEndedAt) return; // mic never used
  setAudioSessionType("playback");
  await waitForPlaybackRoute(ROUTE_RECOVERY_TIMEOUT_MS);
}

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
