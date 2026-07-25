import { useCallback, useEffect, useRef } from "react";
import { useGameStore } from "@/state/gameStore";
import { useSpeechStore } from "@/state/speechStore";
import { matchBestAlternative } from "@/services/speech/match";

// After this many real (non "no-speech") errors in a row, continuous mode
// is assumed broken — this is how iOS Safari's unreliable continuous
// recognition typically shows up — and we degrade to push-to-talk.
const MAX_CONSECUTIVE_ERRORS = 3;

function getRecognitionCtor(): (new () => SpeechRecognition) | null {
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

/**
 * Owns the SpeechRecognition instance: continuous listening with
 * restart-on-end, push-to-talk degrade, and half-duplex (mic off while the
 * app is speaking — no timing-cooldown hack). See gameStore.submitVoiceMatch
 * for what happens to a recognized result.
 */
export function useSpeechRecognition() {
  const mode = useSpeechStore((s) => s.mode);
  const isListening = useSpeechStore((s) => s.isListening);
  const isSpeaking = useSpeechStore((s) => s.isSpeaking);
  const setMode = useSpeechStore((s) => s.setMode);
  const setListening = useSpeechStore((s) => s.setListening);
  const submitVoiceMatch = useGameStore((s) => s.submitVoiceMatch);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const shouldListenRef = useRef(false);
  const modeRef = useRef(mode);
  const isSpeakingRef = useRef(isSpeaking);
  const errorCountRef = useRef(0);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    const supported = !!getRecognitionCtor();
    console.log("[speech] feature-detect: supported =", supported);
    setMode(supported ? "continuous" : "unsupported");
  }, [setMode]);

  const handleResult = useCallback(
    (event: SpeechRecognitionEvent) => {
      if (isSpeakingRef.current) return; // half-duplex: don't hear our own voice output
      const last = event.results[event.results.length - 1];
      if (!last.isFinal) return;
      const alternatives: string[] = [];
      for (let i = 0; i < last.length; i++) {
        const t = last[i]?.transcript?.trim();
        if (t) alternatives.push(t);
      }
      if (!alternatives.length) return;
      console.log("[speech] alternatives heard:", alternatives);
      const match = matchBestAlternative(useGameStore.getState().chess, alternatives);
      console.log("[speech] resolved to:", match);
      submitVoiceMatch(match);
    },
    [submitVoiceMatch],
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
    recognition.onresult = handleResult;
    recognition.onerror = (e) => {
      if (e.error === "no-speech") return; // normal, not a real failure
      errorCountRef.current += 1;
      console.log(`[speech] recognition error "${e.error}" (${errorCountRef.current} consecutive)`);
      if (errorCountRef.current >= MAX_CONSECUTIVE_ERRORS && modeRef.current === "continuous") {
        console.log("[speech] degrading to push-to-talk after repeated failures");
        setMode("push-to-talk");
        shouldListenRef.current = false;
        setListening(false);
      }
    };
    recognition.onend = () => {
      console.log(
        "[speech] recognition ended; shouldListen =",
        shouldListenRef.current,
        "mode =",
        modeRef.current,
        "isSpeaking =",
        isSpeakingRef.current,
      );
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

  // Half-duplex: stop listening the instant we start speaking, resume once we stop.
  useEffect(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (isSpeaking) {
      console.log("[speech] half-duplex: stopping recognition while speaking");
      try {
        recognition.stop();
      } catch {
        // not running
      }
    } else if (shouldListenRef.current && modeRef.current === "continuous") {
      console.log("[speech] half-duplex: resuming recognition after speaking");
      try {
        recognition.start();
      } catch {
        // already running
      }
    }
  }, [isSpeaking]);

  const toggleListening = useCallback(() => {
    if (mode !== "continuous") return;
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
  }, [mode, isListening, ensureRecognition, setListening]);

  const startPushToTalk = useCallback(() => {
    if (mode !== "push-to-talk") return;
    const recognition = ensureRecognition();
    if (!recognition) return;
    shouldListenRef.current = true;
    try {
      recognition.start();
      setListening(true);
    } catch {
      // ignore — press-and-hold retriggers are harmless
    }
  }, [mode, ensureRecognition, setListening]);

  const stopPushToTalk = useCallback(() => {
    if (mode !== "push-to-talk") return;
    shouldListenRef.current = false;
    recognitionRef.current?.stop();
    setListening(false);
  }, [mode]);

  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      recognitionRef.current?.stop();
    };
  }, []);

  return { mode, isListening, toggleListening, startPushToTalk, stopPushToTalk };
}
