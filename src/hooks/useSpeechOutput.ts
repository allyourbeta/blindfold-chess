import { useEffect, useRef } from "react";
import { useGameStore, type MoveSource } from "@/state/gameStore";
import { useSettingsStore } from "@/state/settingsStore";
import type { SpeechMode } from "@/api/localStore";
import { useSpeechStore } from "@/state/speechStore";
import { movePhraseClips, gameEndPhraseClips, rejectionPhraseClips, CLIP_IDS } from "@/services/speech/phrase";
import { PIECE_WORDS } from "@/services/chess/san";
import { playMoveTone, playCaptureTone, playErrorTone } from "@/services/audio/sfx";
import { preloadClips, playClip } from "@/services/audio/clipPlayer";

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

async function playClipSequence(ids: string[]): Promise<void> {
  const ctx = getAudioContext();
  for (const id of ids) {
    await playClip(ctx, id);
    await new Promise((r) => setTimeout(r, CLIP_GAP_MS));
  }
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
  /**
   * Confirmation tone played FIRST, inside the queue, so a beep for a new
   * event can never land on top of words still being spoken. Firing tones
   * immediately (the old way) overlapped them with queued speech on the one
   * shared output, which on a phone speaker distorted into static.
   */
  tone: "move" | "capture" | "error" | null;
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

/** Drops anything queued but not yet spoken — used when a game starts or ends. */
export function resetSpeechQueue(): void {
  queue = [];
  spokeNotUnderstoodLast = false;
  window.speechSynthesis?.cancel();
}

// Loop breaker: if the last thing we said was "sorry, I did not catch that",
// don't say it again for the very next failure — the screen message still
// shows. Without this, one echo slipping through the filters can chain the
// clip into an endless self-conversation.
let spokeNotUnderstoodLast = false;

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
      if (next.tone) {
        const ctx = getAudioContext();
        if (next.tone === "move") playMoveTone(ctx);
        else if (next.tone === "capture") playCaptureTone(ctx);
        else playErrorTone(ctx);
        // Let the tone ring before words start.
        await new Promise((r) => setTimeout(r, 140));
      }
      // No throw here — from a bad clip fetch to a browser speechSynthesis
      // quirk — may skip this `finally` and leave isSpeaking stuck true.
      try {
        if (next.clips?.length) {
          try {
            await playClipSequence(next.clips);
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

/**
 * In "both" mode your own move is read back only when you spoke it — a typed
 * move needs no confirmation, since you already know what you typed.
 */
function shouldSpeakMove(
  by: "player" | "engine",
  source: MoveSource | null,
  mode: SpeechMode,
): boolean {
  if (mode === "silent") return false;
  if (by === "engine") return true;
  return mode === "both" && source?.kind === "voice";
}

/** Reacts to gameStore's audioEvent: confirmation tones always, spoken moves when voice output is enabled. */
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

    if (audioEvent.kind === "move") {
      spokeNotUnderstoodLast = false;
      const tone = audioEvent.move.isCapture() ? ("capture" as const) : ("move" as const);
      if (shouldSpeakMove(audioEvent.by, audioEvent.source, speechMode)) {
        const clips = movePhraseClips(audioEvent.move, fileNaming);
        enqueueSpeech({ tone, clips, text: clips.join(" "), remember: false });
      } else {
        enqueueSpeech({ tone, clips: null, text: "", remember: false });
      }
    } else if (audioEvent.kind === "illegal-move") {
      // A rejected voice move always speaks, even in Silent mode: if you're
      // playing by voice you may not be watching the screen, and silence is
      // indistinguishable from the move having been accepted. Typed rejections
      // stay quiet — the message log has it and you're already looking.
      if (audioEvent.source.kind === "voice") {
        enqueueSpeech({ tone: "error", clips: null, text: audioEvent.spoken, remember: true });
      } else {
        enqueueSpeech({ tone: "error", clips: null, text: "", remember: false });
      }
      spokeNotUnderstoodLast = false;
    } else if (audioEvent.kind === "rejected-move") {
      // Always spoken, even in Silent mode — see the illegal-move note above.
      if (audioEvent.source.kind === "voice") {
        const clips = rejectionPhraseClips(
          PIECE_WORDS[audioEvent.piece],
          audioEvent.to,
          audioEvent.reason,
          fileNaming,
        );
        enqueueSpeech({ tone: "error", clips, text: clips.join(" "), remember: true });
      } else {
        enqueueSpeech({ tone: "error", clips: null, text: "", remember: false });
      }
      spokeNotUnderstoodLast = false;
    } else if (audioEvent.kind === "not-understood") {
      if (spokeNotUnderstoodLast) {
        // Loop breaker: keep the beep, drop the repeated sentence.
        enqueueSpeech({ tone: "error", clips: null, text: "", remember: false });
      } else {
        enqueueSpeech({ tone: "error", clips: ["not-understood"], text: "Sorry, I did not catch that.", remember: true });
        spokeNotUnderstoodLast = true;
      }
    } else if (audioEvent.kind === "game-end") {
      if (speechMode !== "silent") {
        const clips = gameEndPhraseClips(audioEvent.reason);
        enqueueSpeech({ tone: null, clips, text: clips.join(" "), remember: true });
      }
    }
  }, [audioEvent, speechMode, fileNaming]);
}
