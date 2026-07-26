import { getOutputNode } from "./master";

/**
 * Plays word clips through a shared, already-unlocked AudioContext instead of
 * per-element `<audio>.play()` calls, which iOS blocks outside a user
 * gesture. See docs/SPEC_ios_audio_ui.md Part A for the failure this fixes.
 */

const buffers = new Map<string, AudioBuffer>();
const inFlight = new Map<string, Promise<AudioBuffer>>();

const LOAD_TIMEOUT_MS = 3000;
const WATCHDOG_SLACK_MS = 1500;
const SCHEDULE_LEAD_SECONDS = 0.035;
const EDGE_FADE_SECONDS = 0.012;

async function loadClip(ctx: AudioContext, id: string): Promise<AudioBuffer> {
  const cached = buffers.get(id);
  if (cached) return cached;
  let pending = inFlight.get(id);
  if (!pending) {
    pending = fetch(`/audio/${id}.wav`)
      .then((res) => {
        if (!res.ok) throw new Error(`clip "${id}" failed to load (${res.status})`);
        return res.arrayBuffer();
      })
      .then((data) => ctx.decodeAudioData(data))
      .then((buffer) => {
        buffers.set(id, buffer);
        inFlight.delete(id);
        return buffer;
      })
      .catch((err) => {
        inFlight.delete(id);
        throw err;
      });
    inFlight.set(id, pending);
  }
  return pending;
}

/** Kicks off loading every clip id. Never rejects — failures are discovered later, at play time. */
export function preloadClips(ctx: AudioContext, ids: readonly string[]): void {
  for (const id of ids) {
    void loadClip(ctx, id).catch(() => {});
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * Schedules a complete phrase on the AudioContext clock. Every clip gets a
 * short gain ramp at both edges, which removes tiny discontinuities that can
 * sound like clicks or static on an iPhone speaker. Scheduling the whole
 * phrase in advance also avoids timer jitter between words.
 */
export async function playClipSequence(
  ctx: AudioContext,
  ids: readonly string[],
  gapMs: number,
): Promise<void> {
  if (!ids.length) return;

  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      // The caller will still try playback; if iOS blocks it, the watchdog
      // releases the queue and the next utterance can continue.
    }
  }

  const loaded = await withTimeout(
    Promise.all(ids.map((id) => loadClip(ctx, id))),
    LOAD_TIMEOUT_MS,
    "speech clips did not load in time",
  );

  const output = getOutputNode(ctx);
  const gapSeconds = Math.max(0, gapMs) / 1000;
  const sources: Array<{ source: AudioBufferSourceNode; gain: GainNode }> = [];
  let cursor = ctx.currentTime + SCHEDULE_LEAD_SECONDS;

  for (const buffer of loaded) {
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    const startAt = cursor;
    const endAt = startAt + buffer.duration;
    const fadeSeconds = Math.min(EDGE_FADE_SECONDS, buffer.duration / 4);

    source.buffer = buffer;
    source.connect(gain);
    gain.connect(output);

    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(1, startAt + fadeSeconds);
    gain.gain.setValueAtTime(1, Math.max(startAt + fadeSeconds, endAt - fadeSeconds));
    gain.gain.linearRampToValueAtTime(0, endAt);

    source.start(startAt);
    sources.push({ source, gain });
    cursor = endAt + gapSeconds;
  }

  const finalEndAt = cursor - gapSeconds;
  return new Promise((resolve) => {
    let settled = false;
    let remaining = sources.length;
    const settle = () => {
      if (settled) return;
      settled = true;
      clearTimeout(watchdog);
      for (const { source, gain } of sources) {
        source.onended = null;
        source.disconnect();
        gain.disconnect();
      }
      resolve();
    };

    const watchdog = setTimeout(
      settle,
      Math.max(0, finalEndAt - ctx.currentTime) * 1000 + WATCHDOG_SLACK_MS,
    );

    for (const { source } of sources) {
      source.onended = () => {
        remaining -= 1;
        if (remaining === 0) settle();
      };
    }
  });
}
