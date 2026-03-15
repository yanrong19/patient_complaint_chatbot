"use client";

import { useEffect, useRef, useState } from "react";

interface VoiceButtonProps {
  onTranscript: (text: string) => void;
  onInterimTranscript: (text: string) => void;
  onRecordingStart: () => void;
  onRecordingStop: (latencyMs: number) => void;
  disabled: boolean;
  recognitionLang: "en-US" | "zh-CN";
  onLanguageChange: (lang: "en-US" | "zh-CN") => void;
}

export default function VoiceButton({
  onTranscript,
  onInterimTranscript,
  onRecordingStart,
  onRecordingStop,
  disabled,
  recognitionLang,
  onLanguageChange,
}: VoiceButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [hasWebSpeech, setHasWebSpeech] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (w.webkitSpeechRecognition || w.SpeechRecognition) {
      setHasWebSpeech(true);
    }
  }, []);

  // ── Primary: Web Speech API (Chrome/Edge) ──────────────────────────────
  const startWebSpeech = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.webkitSpeechRecognition || w.SpeechRecognition;
    if (!SR) return false;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new SR() as any;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = recognitionLang;
    recognition.maxAlternatives = 1;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text: string = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += text;
        } else {
          interim += text;
        }
      }
      if (interim) onInterimTranscript(interim);
      if (final) {
        onInterimTranscript(""); // clear interim
        onTranscript(final);
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
      onRecordingStop(Date.now() - startTimeRef.current);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (e: any) => {
      setIsRecording(false);
      onRecordingStop(0);
      if (e.error !== "no-speech" && e.error !== "aborted") {
        setError(`Mic error: ${e.error}`);
        setTimeout(() => setError(null), 3000);
      }
    };

    recognitionRef.current = recognition;
    startTimeRef.current = Date.now();
    recognition.start();
    setIsRecording(true);
    setError(null);
    onRecordingStart();
    return true;
  };

  // ── Fallback: Azure STT via /api/stt ──────────────────────────────────
  const startAzureSTT = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Pick a supported mimeType
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/ogg";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const arrayBuffer = await blob.arrayBuffer();

        try {
          const res = await fetch(`/api/stt?lang=${recognitionLang}`, {
            method: "POST",
            headers: { "Content-Type": mimeType },
            body: arrayBuffer,
          });
          const data = (await res.json()) as {
            transcript?: string;
            latency_ms?: number;
            error?: string;
          };
          if (data.transcript) {
            onTranscript(data.transcript);
            onRecordingStop(data.latency_ms ?? 0);
          } else {
            setError("Could not transcribe audio. Please try again.");
            setTimeout(() => setError(null), 3000);
            onRecordingStop(0);
          }
        } catch {
          setError("STT request failed. Please type instead.");
          setTimeout(() => setError(null), 4000);
          onRecordingStop(0);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      startTimeRef.current = Date.now();
      mediaRecorder.start();
      setIsRecording(true);
      setError(null);
      onRecordingStart();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Microphone access denied";
      setError(msg);
      setTimeout(() => setError(null), 4000);
    }
  };

  const handleClick = () => {
    if (isRecording) {
      // Stop whichever recorder is active
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } else {
      // Web Speech API first (real-time, no server roundtrip); Azure STT fallback
      if (hasWebSpeech) {
        startWebSpeech();
      } else {
        startAzureSTT();
      }
    }
  };

  const isZh = recognitionLang === "zh-CN";

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={handleClick}
        disabled={disabled}
        className={`relative flex items-center justify-center w-12 h-12 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-400 ${
          disabled
            ? "opacity-40 cursor-not-allowed bg-slate-700"
            : isRecording
            ? "bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/50"
            : "bg-cyan-600 hover:bg-cyan-500 shadow-md shadow-cyan-600/30"
        }`}
        title={isRecording ? "Stop recording" : `Voice input (${isZh ? "Chinese" : "English"})`}
      >
        {isRecording && (
          <>
            <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-40" />
            <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-20" />
          </>
        )}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-5 h-5 z-10 text-white"
        >
          <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
          <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" />
        </svg>
      </button>

      {/* Language toggle */}
      <button
        onClick={() => !isRecording && onLanguageChange(isZh ? "en-US" : "zh-CN")}
        disabled={isRecording || disabled}
        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded transition-all ${
          isZh
            ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
            : "bg-slate-700 text-slate-400 hover:bg-slate-600"
        } disabled:opacity-40 disabled:cursor-not-allowed`}
        title={isZh ? "Switch to English" : "切换到中文"}
      >
        {isZh ? "中文" : "EN"}
      </button>

      {error && (
        <span className="text-[10px] text-red-400 text-center max-w-[120px] leading-tight">
          {error}
        </span>
      )}
    </div>
  );
}
