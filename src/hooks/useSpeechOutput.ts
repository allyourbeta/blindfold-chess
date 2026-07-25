import { useEffect } from "react";
import { useGameStore, type MoveSource } from "@/state/gameStore";
import { useSettingsStore } from "@/state/settingsStore";
import type { SpeechMode } from "@/api/localStore";
import { useSpeechStore } from "@/state/speechStore";
import { movePhraseClips, gameEndPhraseClips, rejectionPhraseClips } from "@/services/speech/phrase";
import { PIECE_WORDS } from "@/services/chess/san";
import { playMoveTone, playCaptureTone, playErrorTone } from "@/services/audio/sfx";

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
  const unlockEl = new Audio();
  unlockEl.muted = true;
  unlockEl.play().catch(() => {}).finally(() => unlockEl.pause());
}

const clipCache = new Map<string, HTMLAudioElement>();
function getClipElement(id: string): HTMLAudioElement {
  let el = clipCache.get(id);
  if (!el) {
    el = new Audio(`/audio/${id}.wav`);
    el.preload = "auto";
    clipCache.set(id, el);
  }
  return el;
}

function playOneClip(id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const el = getClipElement(id);
    el.currentTime = 0;
    const cleanup = () => {
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("error", onError);
    };
    const onEnded = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(`clip "${id}" failed to play`));
    };
    el.addEventListener("ended", onEnded);
    el.addEventListener("error", onError);
    el.play().catch(onError);
  });
}

const CLIP_GAP_MS = 90;

async function playClipSequence(ids: string[]): Promise<void> {
  for (const id of ids) {
    await playOneClip(id);
    await new Promise((r) => setTimeout(r, CLIP_GAP_MS));
  }
}

/** Speaks text and resolves when it has actually finished, so the queue can't overlap it. */
function speakText(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      resolve();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

// ---------------------------------------------------------------------------
// Speech queue
//
// Every spoken thing goes through this one queue and plays strictly one at a
// time. Without it a player-move readback and the engine's reply — which can
// arrive well under a second later — start playing on top of each other, and
// they fight over the same cached <audio> elements. Serialising here also
// keeps the "speaking" flag honest, which is what mutes the microphone.
// ---------------------------------------------------------------------------

type Utterance = { clips: string[] | null; text: string };

let queue: Utterance[] = [];
let draining = false;

/** Drops anything queued but not yet spoken — used when a game starts or ends. */
export function resetSpeechQueue(): void {
  queue = [];
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
      if (next.clips?.length) {
        try {
          await playClipSequence(next.clips);
        } catch {
          await speakText(next.text);
        }
      } else if (next.text) {
        await speakText(next.text);
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

  useEffect(() => {
    if (!audioEvent) {
      resetSpeechQueue();
      return;
    }
    const ctx = getAudioContext();

    if (audioEvent.kind === "move") {
      if (audioEvent.move.isCapture()) playCaptureTone(ctx);
      else playMoveTone(ctx);
      if (shouldSpeakMove(audioEvent.by, audioEvent.source, speechMode)) {
        const clips = movePhraseClips(audioEvent.move, fileNaming);
        enqueueSpeech({ clips, text: clips.join(" ") });
      }
    } else if (audioEvent.kind === "illegal-move") {
      playErrorTone(ctx);
      // A rejected voice move always speaks, even in Silent mode: if you're
      // playing by voice you may not be watching the screen, and silence is
      // indistinguishable from the move having been accepted. Typed rejections
      // stay quiet — the message log has it and you're already looking.
      if (audioEvent.source.kind === "voice") {
        enqueueSpeech({ clips: null, text: audioEvent.spoken });
      }
    } else if (audioEvent.kind === "rejected-move") {
      playErrorTone(ctx);
      // Always spoken, even in Silent mode — see the illegal-move note above.
      if (audioEvent.source.kind === "voice") {
        const clips = rejectionPhraseClips(
          PIECE_WORDS[audioEvent.piece],
          audioEvent.to,
          audioEvent.reason,
          fileNaming,
        );
        enqueueSpeech({ clips, text: clips.join(" ") });
      }
    } else if (audioEvent.kind === "game-end") {
      if (speechMode !== "silent") {
        const clips = gameEndPhraseClips(audioEvent.reason);
        enqueueSpeech({ clips, text: clips.join(" ") });
      }
    }
  }, [audioEvent, speechMode, fileNaming]);
}
