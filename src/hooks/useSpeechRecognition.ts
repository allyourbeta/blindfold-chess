import { useCallback, useEffect, useRef } from "react";
import { useGameStore } from "@/state/gameStore";
import { useSpeechStore } from "@/state/speechStore";
import { matchBestAlternative } from "@/services/speech/match";
import { isOwnEcho } from "@/services/speech/echo";
import {
  getRecognitionCtor,
  IS_IOS,
  latestRecognitionAlternatives,
  tapRecognitionErrorMessage,
} from "@/services/speech/recognition";

const MAX_CONSECUTIVE_ERRORS = 3;
const ECHO_GRACE_MS = 1200;
const TAP_SESSION_MAX_MS = 12000;
const TAP_STOP_FALLBACK_MS = 800;

/**
 * Owns speech input in continuous desktop mode and one-session-per-tap iOS
 * mode. Tap mode intentionally accepts interim results: Safari sometimes ends
 * a one-shot session without ever promoting its last transcript to `isFinal`.
 */
export function useSpeechRecognition() {
  const mode = useSpeechStore((s) => s.mode);
  const isListening = useSpeechStore((s) => s.isListening);
  const isSpeaking = useSpeechStore((s) => s.isSpeaking);
  const inputError = useSpeechStore((s) => s.inputError);
  const setMode = useSpeechStore((s) => s.setMode);
  const setListening = useSpeechStore((s) => s.setListening);
  const setInputError = useSpeechStore((s) => s.setInputError);
  const submitVoiceMatch = useGameStore((s) => s.submitVoiceMatch);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const tapSessionRef = useRef<SpeechRecognition | null>(null);
  const shouldListenRef = useRef(false);
  const modeRef = useRef(mode);
  const isSpeakingRef = useRef(isSpeaking);
  const errorCountRef = useRef(0);
  const tapCapTimersRef = useRef(new Map<SpeechRecognition, ReturnType<typeof setTimeout>>());
  const cancelledTapSessionsRef = useRef(new WeakSet<SpeechRecognition>());

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

  const submitAlternatives = useCallback(
    (alternatives: string[], explicitTap: boolean) => {
      const speech = useSpeechStore.getState();
      if (speech.isSpeaking) return false;

      // A tap is an explicit handoff from output to input, so its transcript
      // must not be rejected merely because the player answered quickly.
      if (!explicitTap) {
        const sinceSpoke = Date.now() - speech.speakingEndedAt;
        if (sinceSpoke < ECHO_GRACE_MS) {
          console.log(`[speech] dropped result ${sinceSpoke}ms after speaking — own voice`);
          return false;
        }
        if (alternatives.some((text) => isOwnEcho(text, speech.recentSpokenTexts))) {
          console.log("[speech] dropped own echo:", alternatives);
          return false;
        }
      }

      console.log("[speech] alternatives heard:", alternatives);
      setInputError(null);
      const match = matchBestAlternative(useGameStore.getState().chess, alternatives);
      console.log("[speech] resolved to:", match);
      submitVoiceMatch(match);
      return true;
    },
    [setInputError, submitVoiceMatch],
  );

  const handleContinuousResult = useCallback(
    (event: SpeechRecognitionEvent) => {
      const result = latestRecognitionAlternatives(event);
      if (!result?.isFinal) return;
      submitAlternatives(result.alternatives, false);
    },
    [submitAlternatives],
  );

  const ensureRecognition = useCallback((): SpeechRecognition | null => {
    if (recognitionRef.current) return recognitionRef.current;
    const Ctor = getRecognitionCtor();
    if (!Ctor) return null;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 5;
    recognition.lang = "en-US";
    recognition.onresult = handleContinuousResult;
    recognition.onerror = (event) => {
      if (event.error === "no-speech") return;
      errorCountRef.current += 1;
      console.log(`[speech] recognition error "${event.error}" (${errorCountRef.current} consecutive)`);
      if (errorCountRef.current >= MAX_CONSECUTIVE_ERRORS && modeRef.current === "continuous") {
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
          // already running
        }
      }
    };
    recognitionRef.current = recognition;
    return recognition;
  }, [handleContinuousResult, setListening, setMode]);

  useEffect(() => {
    if (isSpeaking) {
      try {
        recognitionRef.current?.stop();
        const tapSession = tapSessionRef.current;
        if (tapSession) {
          cancelledTapSessionsRef.current.add(tapSession);
          tapSession.abort();
        }
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

  const retireTapSession = useCallback(
    (recognition: SpeechRecognition, stopRecognition = true) => {
      const capTimer = tapCapTimersRef.current.get(recognition);
      if (capTimer) {
        clearTimeout(capTimer);
        tapCapTimersRef.current.delete(recognition);
      }
      if (tapSessionRef.current === recognition) {
        tapSessionRef.current = null;
        setListening(false);
      }
      if (stopRecognition) {
        try {
          recognition.abort();
        } catch {
          try {
            recognition.stop();
          } catch {
            // already stopped, or never started
          }
        }
      }
    },
    [setListening],
  );

  const startTapSession = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    const recognition = new Ctor();
    let latestAlternatives: string[] = [];
    let submitted = false;

    const submitLatest = () => {
      if (submitted || !latestAlternatives.length) return false;
      submitted = submitAlternatives(latestAlternatives, true);
      return submitted;
    };

    recognition.continuous = false;
    // iOS may provide only an interim result before ending. Keep it so onend
    // can submit the best transcript rather than silently throwing it away.
    recognition.interimResults = true;
    recognition.maxAlternatives = 5;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      if (cancelledTapSessionsRef.current.has(recognition)) return;
      const result = latestRecognitionAlternatives(event);
      if (!result) return;
      latestAlternatives = result.alternatives;
      if (result.isFinal) {
        // Do not submit while iOS still owns the microphone audio session.
        // Normal submission happens from onend, after listening is retired.
        // This fallback handles browsers that return a final result but never
        // deliver onend.
        setTimeout(() => {
          if (tapSessionRef.current !== recognition) return;
          retireTapSession(recognition);
          submitLatest();
        }, TAP_STOP_FALLBACK_MS);
      }
    };
    recognition.onerror = (event) => {
      // abort() during normal retirement or cancellation can fire late.
      if (tapSessionRef.current !== recognition || cancelledTapSessionsRef.current.has(recognition)) return;
      console.log(`[speech] tap session error "${event.error}"`);
      setInputError(tapRecognitionErrorMessage(event.error));
      retireTapSession(recognition, false);
    };
    recognition.onend = () => {
      const cancelled = cancelledTapSessionsRef.current.has(recognition);
      // Mark microphone capture as ended before submitting the move. The audio
      // output queue uses that timestamp to avoid the crackly iOS transition
      // from recognition capture to speaker playback.
      retireTapSession(recognition, false);
      if (!cancelled) submitLatest();
      if (!submitted && !cancelled) {
        setInputError(tapRecognitionErrorMessage("ended-without-result"));
      }
    };

    tapSessionRef.current = recognition;
    setInputError(null);
    tapCapTimersRef.current.set(
      recognition,
      setTimeout(() => {
        console.log("[speech] tap session hit its absolute cap, retiring");
        retireTapSession(recognition);
        submitLatest();
        if (!submitted) {
          setInputError(tapRecognitionErrorMessage("timeout"));
        }
      }, TAP_SESSION_MAX_MS),
    );
    try {
      recognition.start();
      setListening(true);
    } catch (error) {
      console.log("[speech] tap session failed to start", error);
      setInputError(tapRecognitionErrorMessage("start-failed"));
      retireTapSession(recognition, false);
    }
  }, [retireTapSession, setInputError, setListening, submitAlternatives]);

  const toggleListening = useCallback(() => {
    if (modeRef.current === "tap") {
      if (isSpeakingRef.current) return;
      const current = tapSessionRef.current;
      if (current) {
        cancelledTapSessionsRef.current.add(current);
        retireTapSession(current);
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
      // start() throws if already started
    }
  }, [ensureRecognition, isListening, retireTapSession, setListening, startTapSession]);

  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      recognitionRef.current?.stop();
      const tapSession = tapSessionRef.current;
      if (tapSession) {
        cancelledTapSessionsRef.current.add(tapSession);
        tapSession.abort();
      }
    };
  }, []);

  return { mode, isListening, isSpeaking, inputError, toggleListening };
}
