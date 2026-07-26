/**
 * iOS/Safari audio-session control.
 *
 * Diagnosis this addresses: engine speech is clean until the microphone has
 * been used, then crackles regardless of voice (Tessa clips or native
 * speechSynthesis). Speech recognition puts the OS audio session into a
 * record/voice-processing route; if playback starts while that route is
 * still active, the output goes through the voice path and sounds like
 * static. So playback must not begin until the route has verifiably
 * returned to normal — a fixed delay is not proof.
 *
 * Two mechanisms, both best-effort:
 *  1. `navigator.audioSession.type` (Safari 16.4+) is set to
 *     "play-and-record" before recognition and back to "playback" after.
 *  2. The route is PROBED: a throwaway AudioContext reports the hardware
 *     sample rate of the current route. Voice routes run at 16/24 kHz;
 *     normal playback runs at 44.1/48 kHz. We wait until a fresh context
 *     comes up at a playback rate (or a timeout passes).
 */

type AudioSessionType =
  | "auto"
  | "playback"
  | "transient"
  | "transient-solo"
  | "ambient"
  | "play-and-record";

interface NavigatorAudioSession {
  type: AudioSessionType;
}

function getAudioSession(): NavigatorAudioSession | null {
  const session = (navigator as Navigator & { audioSession?: NavigatorAudioSession }).audioSession;
  return session ?? null;
}

/** Best-effort. Safari < 16.4 has no audioSession; then this is a no-op. */
export function setAudioSessionType(type: AudioSessionType): void {
  const session = getAudioSession();
  if (!session) return;
  try {
    session.type = type;
    console.log(`[audio] audioSession.type = "${type}"`);
  } catch (error) {
    console.log("[audio] failed to set audioSession.type", error);
  }
}

const PLAYBACK_MIN_SAMPLE_RATE = 44100;
const ROUTE_PROBE_INTERVAL_MS = 100;

/**
 * Reads the hardware sample rate of the CURRENT audio route by creating and
 * immediately closing a throwaway AudioContext. Returns 0 when unavailable.
 */
export function probeRouteSampleRate(): number {
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return 0;
  try {
    const probe = new Ctor();
    const rate = probe.sampleRate;
    void probe.close();
    return rate;
  } catch {
    return 0;
  }
}

/**
 * Resolves once the audio route reports a playback-grade sample rate, or
 * after `timeoutMs`. Never rejects. Logs each probe so a phone console (or
 * remote inspector) shows exactly what the route did after the microphone.
 */
export async function waitForPlaybackRoute(timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const rate = probeRouteSampleRate();
    if (rate === 0) return false; // can't probe — don't stall playback
    if (rate >= PLAYBACK_MIN_SAMPLE_RATE) {
      console.log(`[audio] route ok at ${rate} Hz`);
      return true;
    }
    if (Date.now() >= deadline) {
      console.log(`[audio] route still ${rate} Hz after ${timeoutMs}ms — playing anyway`);
      return false;
    }
    console.log(`[audio] route at ${rate} Hz — waiting`);
    await new Promise((resolve) => setTimeout(resolve, ROUTE_PROBE_INTERVAL_MS));
  }
}
