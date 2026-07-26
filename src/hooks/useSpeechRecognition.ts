import { useCallback, useEffect, useRef } from "react";
import { useGameStore } from "@/state/gameStore";
import { useSpeechStore } from "@/state/speechStore";
import { matchBestAlternative } from "@/services/speech/match";
import { isOwnEcho } from "@/services/speech/echo";

// After this many real (non "no-speech") errors in a row, continuous mode is
// assumed broken and we degrade to tap-to-speak (one session per mic tap).
const MAX_CONSECUTIVE_ERRORS = 3;

// Transcripts of audio captured while the app was speaking can arrive AFTER
// the speaking flag has cleared: recognition.stop() releases the mic slowly,
// and the transcription of what it already captured lands a second or so
// later. Anything arriving this soon after we stopped talking is treated as
// our own voice. A real reply can't arrive this fast — the recognizer waits
// out the utterance plus a silence gap before delivering it.
const ECHO_GRACE_MS = 1200;

// Safari on iOS doesn't reliably fire `onend` after a tap session's work is
// done, so a tap session is never allowed to outlive this long regardless.
const TAP_SESSION_MAX_MS = 12000;
// When the user taps to cancel a listening session, `stop()` should retire it
// via `onend` — but if Safari ignores the call, this fallback does it anyway.
const TAP_STOP_FALLBACK_MS = 800;

// iPadOS reports itself as MacIntel; the touch-point check catches it.
const IS_IOS =
  /iP(hone|od|ad)/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

function getRecognitionCtor(): (new () => SpeechRecognition) | null {
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

/**
 * Owns speech input in two modes.
 *
 * Continuous (desktop): one long-lived recognizer, restart-on-end,
 * half-duplex (mic off while the app speaks).
 *
 * Tap (iOS, or after continuous keeps failing): a brand-new recognizer per
 * mic tap that listens for one move and goes idle. iOS Safari doesn't honor
 * continuous mode, refuses restarts that aren't tied to a user gesture, and
 * lets recognizer instances go stale after audio playback — a fresh
 * instance per tap sidesteps all three.
 *
 * All results pass three echo guards so the app never plays against itself:
 * dropped while speaking, dropped inside the post-speech grace window, and
 * dropped when the transcript matches a sentence the app itself just said.
 */
export function useSpeechRecognition() {
  const mode = useSpeechStore((s) => s.mode);
  const isListening = useSpeechStore((s) => s.isListening);
  const isSpeaking = useSpeechStore((s) => s.isSpeaking);
  const setMode = useSpeechStore((s) => s.setMode);
  const setListening = useSpeechStore((s) => s.setListening);
  const submitVoiceMatch = useGameStore((s) => s.submitVoiceMatch);

  const recognitionRef = useRef<SpeechRecognition | null>(null); // continuous mode
  const tapSessionRef = useRef<SpeechRecognition | null>(null); // tap mode
  const shouldListenRef = useRef(false);
  const modeRef = useRef(mode);
  const isSpeakingRef = useRef(isSpeaking);
  const errorCountRef = useRef(0);
  // Absolute session cap per tap instance — never trust onend alone, Safari
  // does not reliably fire it.
  const tapCapTimersRef = useRef(new Map<SpeechRecognition, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    const supported = !!getRecognitionCtor();
    console.log("[speech] feature-detect: supported =", supported, "iOS =", IS_IOS);
    setMode(supported ? (IS_IOS ? "tap" : "continuous") : "unsupported");
  }, [setMode]);

  const handleResult = useCallback(
    (event: SpeechRecognitionEvent) => {
      const speech = useSpeechStore.getState();
      if (speech.isSpeaking) return; // half-duplex: don't hear our own voice output
      const sinceSpoke = Date.now() - speech.speakingEndedAt;
      if (sinceSpoke < ECHO_GRACE_MS) {
        console.log(`[speech] dropped result ${sinceSpoke}ms after speaking — own voice`);
        return;
      }
      const last = event.results[event.results.length - 1];
      if (!last.isFinal) return;
      const alternatives: string[] = [];
      for (let i = 0; i < last.length; i++) {
        const t = last[i]?.transcript?.trim();
        if (t) alternatives.push(t);
      }
      if (!alternatives.length) return;
      if (alternatives.some((t) => isOwnEcho(t, speech.recentSpokenTexts))) {
        console.log("[speech] dropped own echo:", alternatives);
        return;
      }
      console.log("[speech] alternatives heard:", alternatives);
      const match = matchBestAlternative(useGameStore.getState().chess, alternatives);
      console.log("[speech] resolved to:", match);
      submitVoiceMatch(match);
    },
    [submitVoiceMatch],
  );

  // ----- continuous mode ----------------------------------------------------

  const ensureRecognition = useCallback((): SpeechRecognition | null => {
    if (recognitionRef.current) return recognitionRef.current;
    const Ctor = getRecognitionCtor();
    if (!Ctor) return null;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 5;
    recognition.lang = "en-US";
    recognition.onresult = handleResult;
    recognition.onerror = (e) => {
      if (e.error === "no-speech") return; // normal, not a real failure
      errorCountRef.current += 1;
      console.log(`[speech] recognition error "${e.error}" (${errorCountRef.current} consecutive)`);
      if (errorCountRef.current >= MAX_CONSECUTIVE_ERRORS && modeRef.current === "continuous") {
        console.log("[speech] degrading to tap-to-speak after repeated failures");
        setMode("tap");
        shouldListenRef.current = false;
        setListening(false);
      }
    };
    recognition.onend = () => {
      if (shouldListenRef.current && modeRef.current === "continuous" && !isSpeakingRef.current) {
        try {
          recognition.start();
        } catch {
          // already running — ignore
        }
      }
    };
    recognitionRef.current = recognition;
    return recognition;
  }, [handleResult, setMode, setListening]);

  // Half-duplex: stop listening the instant we start speaking, resume once we
  // stop. Tap sessions are simply cancelled — the player taps again.
  useEffect(() => {
    if (isSpeaking) {
      try {
        recognitionRef.current?.stop();
        tapSessionRef.current?.stop();
      } catch {
        // not running
      }
    } else if (shouldListenRef.current && modeRef.current === "continuous") {
      try {
        recognitionRef.current?.start();
      } catch {
        // already running
      }
    }
  }, [isSpeaking]);

  // ----- tap mode -----------------------------------------------------------

  // Idempotent: safe to call more than once for the same session (onend,
  // onerror, the session cap, and a manual cancel can all race to retire the
  // same instance). Never trust onend alone — Safari does not reliably fire
  // it, so this is also invoked directly wherever we know the session is done.
  const retireTapSession = useCallback(
    (recognition: SpeechRecognition) => {
      const capTimer = tapCapTimersRef.current.get(recognition);
      if (capTimer) {
        clearTimeout(capTimer);
        tapCapTimersRef.current.delete(recognition);
      }
      if (tapSessionRef.current === recognition) {
        tapSessionRef.current = null;
        // Only the *current* session may flip the button to idle. A stale
        // session's late onend (Safari) must not lie about a newer session
        // that is actively listening.
        setListening(false);
      }
      try {
        recognition.stop();
      } catch {
        // already stopped, or never started
      }
    },
    [setListening],
  );

  const startTapSession = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    // A fresh instance every tap, never reused: iOS recognizers go stale
    // after stopping and after audio playback switches the audio session.
    const recognition = new Ctor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 5;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      handleResult(event);
      const last = event.results[event.results.length - 1];
      if (last?.isFinal) retireTapSession(recognition);
    };
    recognition.onerror = (e) => {
      console.log(`[speech] tap session error "${e.error}"`);
      retireTapSession(recognition);
    };
    recognition.onend = () => retireTapSession(recognition);

    tapSessionRef.current = recognition;
    tapCapTimersRef.current.set(
      recognition,
      setTimeout(() => {
        console.log("[speech] tap session hit its absolute cap, retiring");
        retireTapSession(recognition);
      }, TAP_SESSION_MAX_MS),
    );
    try {
      recognition.start();
      setListening(true);
    } catch (err) {
      console.log("[speech] tap session failed to start", err);
      retireTapSession(recognition);
    }
  }, [handleResult, retireTapSession, setListening]);

  // ----- shared control -----------------------------------------------------

  const toggleListening = useCallback(() => {
    if (modeRef.current === "tap") {
      if (isSpeakingRef.current) return; // button is disabled too; belt and suspenders
      const current = tapSessionRef.current;
      if (current) {
        retireTapSession(current);
        // retireTapSession is idempotent — this is only a backstop for the
        // case where Safari ignores the stop() call above and the session
        // (and its own onend/cap timers) linger regardless.
        setTimeout(() => retireTapSession(current), TAP_STOP_FALLBACK_MS);
      } else {
        startTapSession();
      }
      return;
    }
    if (modeRef.current !== "continuous") return;
    if (isListening) {
      shouldListenRef.current = false;
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const recognition = ensureRecognition();
    if (!recognition) return;
    errorCountRef.current = 0;
    shouldListenRef.current = true;
    try {
      recognition.start();
      setListening(true);
    } catch {
      // start() throws if already started — state is already correct
    }
  }, [isListening, ensureRecognition, setListening, startTapSession, retireTapSession]);

  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      recognitionRef.current?.stop();
      tapSessionRef.current?.stop();
    };
  }, []);

  return { mode, isListening, isSpeaking, toggleListening };
}
