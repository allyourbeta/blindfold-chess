/**
 * Plays word clips through a shared, already-unlocked AudioContext instead of
 * per-element `<audio>.play()` calls, which iOS blocks outside a user
 * gesture. See docs/SPEC_ios_audio_ui.md Part A for the failure this fixes.
 */

const buffers = new Map<string, AudioBuffer>();
const inFlight = new Map<string, Promise<AudioBuffer>>();

const LOAD_TIMEOUT_MS = 3000;
const WATCHDOG_SLACK_MS = 1500;

async function loadClip(ctx: AudioContext, id: string): Promise<AudioBuffer> {
  const cached = buffers.get(id);
  if (cached) return cached;
  let pending = inFlight.get(id);
  if (!pending) {
    pending = fetch(`/audio/${id}.wav`)
      .then((res) => res.arrayBuffer())
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
 * Plays one clip and resolves when it's done — either `onended` fires, or a
 * watchdog (buffer duration + slack) times out first, whichever comes first.
 * Throws only when the buffer itself can't be obtained in time; the caller
 * falls back to `speakText`.
 */
export async function playClip(ctx: AudioContext, id: string): Promise<void> {
  const buffer = await withTimeout(loadClip(ctx, id), LOAD_TIMEOUT_MS, `clip "${id}" did not load in time`);

  return new Promise((resolve) => {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    let settled = false;
    const watchdog = setTimeout(() => {
      if (settled) return;
      settled = true;
      console.log(`[audio] clip "${id}" watchdog fired before onended`);
      resolve();
    }, buffer.duration * 1000 + WATCHDOG_SLACK_MS);

    source.onended = () => {
      if (settled) return;
      settled = true;
      clearTimeout(watchdog);
      resolve();
    };

    source.start();
  });
}
