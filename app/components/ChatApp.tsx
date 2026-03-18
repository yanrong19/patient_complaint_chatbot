"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Message, WorkbenchStep, PerformanceMetrics, SSEEvent, AgentNodeType, Complaint } from "../types";
import DialogPanel from "./DialogPanel";
import WorkbenchPanel from "./WorkbenchPanel";
import { useSession, signOut } from "next-auth/react";

function generateId(): string {
  return Math.random().toString(36).slice(2, 11);
}

const defaultMetrics: PerformanceMetrics = {
  sttLatencyMs: null,
  ttfTokenMs: null,
  ttsLatencyMs: null,
  e2eLatencyMs: null,
  turnCount: 0,
  taskSuccessRate: 100,
  escalationCount: 0,
  complaintsLogged: 0,
  sentimentHistory: [],
  totalTurns: 0,
  successfulTurns: 0,
};

// Sentence boundary: ends with . ! ? followed by space/end, or newline
const SENTENCE_END = /[.!?][)\"]?\s+|[.!?][)\"]?$|\n/;

const AGENT_TYPE_MAP: Record<string, AgentNodeType> = {
  orchestrator: "orchestrator",
  clinical_agent: "clinical",
  billing_agent: "billing",
  experience_agent: "experience",
  compliance_agent: "compliance",
  scheduling_agent: "scheduling",
  summary_agent: "summary",
  closer_agent: "closer",
};

// Safe because this component is never SSR'd (imported with ssr: false)
function readSessionMessages(): Message[] {
  try {
    const saved = sessionStorage.getItem("kira-chat-messages");
    return saved ? (JSON.parse(saved) as Message[]) : [];
  } catch { return []; }
}

function readSessionComplaintId(): string | null {
  try { return sessionStorage.getItem("kira-complaint-id"); } catch { return null; }
}

export default function ChatApp() {
  // Safe lazy initializers — this component is never server-rendered
  const [messages, setMessages] = useState<Message[]>(readSessionMessages);
  const [workbenchSteps, setWorkbenchSteps] = useState<WorkbenchStep[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [isTTSPlaying, setIsTTSPlaying] = useState(false);
  const [metrics, setMetrics] = useState<PerformanceMetrics>(defaultMetrics);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sessionComplaintIdRef = useRef<string | null>(readSessionComplaintId());
  const turnIdRef = useRef<number>(0);
  const turnStartRef = useRef<number>(0);
  const voiceStartRef = useRef<number>(0);
  const llmStartRef = useRef<number>(0);
  const voiceLatencyRef = useRef<number | null>(null);
  const isMutedRef = useRef(false); // stable ref so callbacks don't stale-close over isMuted

  // TTS streaming queue
  const ttsQueueRef = useRef<string[]>([]);
  const ttsPlayingRef = useRef(false);
  const ttsFirstRef = useRef(true); // track first chunk for latency metric

  // Cached voices — one per language, initialized once via voiceschanged
  const selectedVoiceRef = useRef<SpeechSynthesisVoice | null>(null);   // en-US
  const selectedZhVoiceRef = useRef<SpeechSynthesisVoice | null>(null); // zh-CN

  // Voice recognition language (used by VoiceButton)
  const [inputLang, setInputLang] = useState<"en-US" | "zh-CN">("en-US");

  const { data: session } = useSession();

  // ── Persist chat history so it survives navigating to /complaints and back ──
  useEffect(() => {
    try {
      sessionStorage.setItem("kira-chat-messages", JSON.stringify(messages));
    } catch {}
  }, [messages]);

  // Resizable split panel
  const [leftPct, setLeftPct] = useState(40);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftPct(Math.min(Math.max(pct, 25), 70));
    };
    const onMouseUp = () => { isDraggingRef.current = false; };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  // Pick and cache the best available TTS voice for each language
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;

    const pickVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) return;

      // English — priority: Microsoft Neural/Natural Online → Google → Apple Samantha → en-US female → en-US → en
      selectedVoiceRef.current =
        voices.find((v) => /aria.*natural|jenny.*natural|natasha.*natural|libby.*natural|ryan.*natural/i.test(v.name)) ??
        voices.find((v) => /microsoft.*online.*natural|natural.*online/i.test(v.name) && v.lang.startsWith("en")) ??
        voices.find((v) => /google.*us.*english|google.*english.*us/i.test(v.name)) ??
        voices.find((v) => v.lang === "en-US" && /google/i.test(v.name)) ??
        voices.find((v) => /^samantha$/i.test(v.name) && v.lang.startsWith("en")) ??
        voices.find((v) => v.lang === "en-US" && /female|woman|zira|jenny|aria|hazel|susan/i.test(v.name)) ??
        voices.find((v) => v.lang === "en-US") ??
        voices.find((v) => v.lang.startsWith("en")) ??
        null;

      // Chinese — priority: Microsoft Xiaoxiao Natural → any zh-CN Natural → any zh-CN → any zh
      selectedZhVoiceRef.current =
        voices.find((v) => /xiaoxiao.*natural|natural.*xiaoxiao/i.test(v.name)) ??
        voices.find((v) => v.lang === "zh-CN" && /natural|neural|online/i.test(v.name)) ??
        voices.find((v) => v.lang === "zh-CN") ??
        voices.find((v) => v.lang.startsWith("zh")) ??
        null;
    };

    pickVoices();
    window.speechSynthesis.onvoiceschanged = pickVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  const addWorkbenchStep = useCallback((step: WorkbenchStep) => {
    setWorkbenchSteps((prev) => [...prev, step]);
  }, []);

  const updateWorkbenchStep = useCallback(
    (id: string, updates: Partial<WorkbenchStep>) => {
      setWorkbenchSteps((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
      );
    },
    []
  );

  // Browser speech synthesis — picks voice by language, consistent across all sentences
  const speakWithBrowser = useCallback((text: string, lang: "en" | "zh" = "en"): Promise<void> => {
    return new Promise((resolve) => {
      if (!("speechSynthesis" in window)) { resolve(); return; }
      const utt = new SpeechSynthesisUtterance(text);
      const isZh = lang === "zh" || /[\u4e00-\u9fff]/.test(text);
      utt.lang = isZh ? "zh-CN" : "en-US";
      utt.rate = 1.0;
      utt.pitch = 1.0;
      const voice = isZh ? selectedZhVoiceRef.current : selectedVoiceRef.current;
      if (voice) utt.voice = voice;
      utt.onend = () => resolve();
      utt.onerror = () => resolve();
      window.speechSynthesis.speak(utt);
    });
  }, []);

  // Play next item from the TTS queue
  const playNextInQueue = useCallback(async () => {
    if (ttsPlayingRef.current) return;
    const text = ttsQueueRef.current.shift();
    if (!text) return;

    ttsPlayingRef.current = true;
    setIsTTSPlaying(true);

    // Auto-detect language from the text content
    const ttsLang: "en" | "zh" = /[\u4e00-\u9fff]/.test(text) ? "zh" : "en";

    try {
      const ttsStart = Date.now();
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang: ttsLang }),
      });

      if (res.ok) {
        // Azure TTS succeeded — play the audio buffer
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);

        if (ttsFirstRef.current) {
          ttsFirstRef.current = false;
          setMetrics((prev) => ({
            ...prev,
            ttsLatencyMs: Date.now() - ttsStart,
            e2eLatencyMs: turnStartRef.current ? Date.now() - turnStartRef.current : null,
          }));
        }

        const audio = new Audio(url);
        audioRef.current = audio;

        await new Promise<void>((resolve) => {
          audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
          audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
          audio.play().catch(() => {
            URL.revokeObjectURL(url);
            resolve();
          });
        });
      } else {
        // Azure TTS failed — fall back to browser speech synthesis
        if (ttsFirstRef.current) {
          ttsFirstRef.current = false;
          setMetrics((prev) => ({
            ...prev,
            ttsLatencyMs: Date.now() - ttsStart,
            e2eLatencyMs: turnStartRef.current ? Date.now() - turnStartRef.current : null,
          }));
        }
        await speakWithBrowser(text, ttsLang);
      }
    } catch {
      // Network error — try browser fallback
      await speakWithBrowser(text, ttsLang);
    } finally {
      ttsPlayingRef.current = false;
      if (ttsQueueRef.current.length > 0) {
        playNextInQueue();
      } else {
        setIsTTSPlaying(false);
      }
    }
  }, [speakWithBrowser]);

  // Enqueue a sentence for TTS (no-op when muted)
  const enqueueTTS = useCallback(
    (text: string) => {
      if (isMutedRef.current) return;
      const clean = text.trim();
      if (!clean) return;
      ttsQueueRef.current.push(clean);
      playNextInQueue();
    },
    [playNextInQueue]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (isStreaming) return;

      turnIdRef.current += 1;
      const turnId = turnIdRef.current;

      turnStartRef.current = Date.now();
      llmStartRef.current = Date.now();

      // Reset TTS queue for new turn
      ttsQueueRef.current = [];
      ttsPlayingRef.current = false;
      ttsFirstRef.current = true;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const userMsg: Message = {
        id: generateId(),
        role: "user",
        content: text,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsStreaming(true);
      setIsThinking(true);
      setStreamingContent("");
      setInterimTranscript("");
      setIsTTSPlaying(false);

      const thinkingStepId = generateId();
      addWorkbenchStep({
        id: thinkingStepId,
        type: "thinking",
        title: "Processing request",
        description: `"${text.slice(0, 60)}${text.length > 60 ? "…" : ""}"`,
        input: { message: text },
        timestamp: Date.now(),
        status: "running",
        turnId,
      });

      let fullResponse = "";
      let llmFirstToken = false;
      let success = true;
      let ttsBuffer = ""; // accumulates tokens until sentence boundary
      let pendingComplaintCard: Complaint | undefined;
      let pendingSuggestions: string[] | undefined;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            conversationHistory: messages,
            existingComplaintId: sessionComplaintIdRef.current,
            userName: session?.user?.name ?? null,
          }),
        });

        if (!res.ok || !res.body) {
          throw new Error("Chat API request failed");
        }

        updateWorkbenchStep(thinkingStepId, { status: "done" });

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          sseBuffer += decoder.decode(value, { stream: true });
          const lines = sseBuffer.split("\n");
          sseBuffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            let event: SSEEvent;
            try {
              event = JSON.parse(jsonStr) as SSEEvent;
            } catch {
              continue;
            }

            if (event.type === "agent_start") {
              addWorkbenchStep({
                id: `${event.agent}-${Date.now()}`,
                type: "thinking",
                title: event.agentLabel,
                description: event.description,
                tool: event.agent,
                agentType: AGENT_TYPE_MAP[event.agent],
                timestamp: Date.now(),
                status: "running",
                turnId,
              });
              setIsThinking(true);
            } else if (event.type === "agent_result") {
              setWorkbenchSteps((prev) => {
                const idx = [...prev]
                  .reverse()
                  .findIndex(
                    (s) => s.tool === event.agent && s.status === "running"
                  );
                if (idx === -1) return prev;
                const realIdx = prev.length - 1 - idx;
                const updated = [...prev];
                const isCompliance =
                  event.agent === "compliance_agent" &&
                  (event.output as { urgency?: string }).urgency === "critical";
                updated[realIdx] = {
                  ...updated[realIdx],
                  type: isCompliance ? "escalation" : "tool_result",
                  status: "done",
                  output: event.output,
                  description: formatAgentResultDescription(
                    event.agent,
                    event.output
                  ),
                };
                return updated;
              });
              setIsThinking(false);

              // ── Tier 2/3 metric capture from agent results ──────────────
              if (event.agent === "orchestrator") {
                const o = event.output;
                if (o.requiresImmediateEscalation) {
                  setMetrics((prev) => ({ ...prev, escalationCount: prev.escalationCount + 1 }));
                }
                // Sentiment is now analysed as a tool inside the orchestrator
                const sentiment = o.sentiment as { emotion?: string; intensity?: string } | undefined;
                if (sentiment) {
                  const snap = {
                    turn: turnId,
                    emotion: String(sentiment.emotion ?? "neutral"),
                    intensity: String(sentiment.intensity ?? "low"),
                  };
                  setMetrics((prev) => ({
                    ...prev,
                    sentimentHistory: [...prev.sentimentHistory, snap],
                  }));
                }
              }
            } else if (event.type === "token") {
              if (!llmFirstToken) {
                llmFirstToken = true;
                setMetrics((prev) => ({ ...prev, ttfTokenMs: Date.now() - llmStartRef.current }));
                setIsThinking(false);
              }
              fullResponse += event.content;
              ttsBuffer += event.content;
              setStreamingContent(fullResponse);

              // Flush TTS buffer when a sentence boundary is detected
              if (SENTENCE_END.test(ttsBuffer)) {
                const parts = ttsBuffer.split(SENTENCE_END);
                const toSpeak = parts.slice(0, -1).join(" ").trim();
                ttsBuffer = parts[parts.length - 1];
                if (toSpeak) enqueueTTS(toSpeak);
              }
            } else if (event.type === "tool_start") {
              addWorkbenchStep({
                id: `${event.tool}-${Date.now()}`,
                type: "tool_call",
                title: formatToolTitle(event.tool),
                tool: event.tool,
                input: event.input,
                timestamp: Date.now(),
                status: "running",
                description: `Calling ${event.tool}`,
                turnId,
              });
            } else if (event.type === "tool_result") {
              setWorkbenchSteps((prev) => {
                const idx = [...prev]
                  .reverse()
                  .findIndex(
                    (s) => s.tool === event.tool && s.status === "running"
                  );
                if (idx === -1) return prev;
                const realIdx = prev.length - 1 - idx;
                const updated = [...prev];
                updated[realIdx] = {
                  ...updated[realIdx],
                  status: "done",
                  output: event.output,
                  description: formatToolResultDescription(
                    event.tool,
                    event.output
                  ),
                };
                return updated;
              });
            } else if (event.type === "done") {
              fullResponse = event.fullResponse;
              setStreamingContent("");
              // Flush any remaining TTS buffer
              if (ttsBuffer.trim()) {
                enqueueTTS(ttsBuffer);
                ttsBuffer = "";
              }
              // Capture suggestions and complaint card
              if (event.suggestions?.length) {
                pendingSuggestions = event.suggestions;
              }
              if (event.complaint) {
                pendingComplaintCard = event.complaint;
                sessionComplaintIdRef.current = event.complaintId ?? sessionComplaintIdRef.current;
                if (sessionComplaintIdRef.current) {
                  try { sessionStorage.setItem("kira-complaint-id", sessionComplaintIdRef.current); } catch {}
                }
                setMetrics((prev) => ({ ...prev, complaintsLogged: prev.complaintsLogged + 1 }));
              }
              addWorkbenchStep({
                id: generateId(),
                type: "complete",
                title: "Response complete",
                description: `${fullResponse.length} chars`,
                timestamp: Date.now(),
                status: "done",
                turnId,
              });
            } else if (event.type === "error") {
              success = false;
              addWorkbenchStep({
                id: generateId(),
                type: "error",
                title: "Error",
                description: event.message,
                timestamp: Date.now(),
                status: "error",
                turnId,
              });
            }
          }
        }

        // Final flush for any remaining buffer not caught by "done" event
        if (ttsBuffer.trim()) {
          enqueueTTS(ttsBuffer);
        }
      } catch (err) {
        success = false;
        const errMsg =
          err instanceof Error ? err.message : "An error occurred";
        addWorkbenchStep({
          id: generateId(),
          type: "error",
          title: "Error",
          description: errMsg,
          timestamp: Date.now(),
          status: "error",
          turnId,
        });
        fullResponse = "I'm sorry, I encountered an error. Please try again.";
      } finally {
        setIsStreaming(false);
        setIsThinking(false);
        setStreamingContent("");

        if (fullResponse) {
          const assistantMsg: Message = {
            id: generateId(),
            role: "assistant",
            content: fullResponse,
            timestamp: Date.now(),
            ...(pendingComplaintCard ? { complaintCard: pendingComplaintCard } : {}),
            ...(pendingSuggestions?.length ? { suggestions: pendingSuggestions } : {}),
          };
          setMessages((prev) => [...prev, assistantMsg]);
        }

        setMetrics((prev) => {
          const newTotal = prev.totalTurns + 1;
          const newSuccess = prev.successfulTurns + (success ? 1 : 0);
          return {
            ...prev,
            sttLatencyMs: voiceLatencyRef.current,
            turnCount: prev.turnCount + 1,
            totalTurns: newTotal,
            successfulTurns: newSuccess,
            taskSuccessRate: Math.round((newSuccess / newTotal) * 100),
          };
        });
      }
    },
    [isStreaming, messages, session, addWorkbenchStep, updateWorkbenchStep, enqueueTTS]
  );

  const handleNewSession = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    ttsQueueRef.current = [];
    ttsPlayingRef.current = false;
    sessionComplaintIdRef.current = null;
    sessionStorage.removeItem("kira-chat-messages");
    sessionStorage.removeItem("kira-complaint-id");
    setMessages([]);
    setWorkbenchSteps([]);
    setStreamingContent("");
    setInterimTranscript("");
    setIsStreaming(false);
    setIsThinking(false);
    setIsTTSPlaying(false);
    setMetrics(defaultMetrics);
    voiceLatencyRef.current = null;
  };

  const handleRecordingStart = () => {
    voiceStartRef.current = Date.now();
  };

  const handleRecordingStop = (latencyMs: number) => {
    voiceLatencyRef.current = latencyMs || Date.now() - voiceStartRef.current;
  };

  const handleToggleMute = () => {
    setIsMuted((v) => {
      const next = !v;
      isMutedRef.current = next;
      if (next) {
        if (audioRef.current) audioRef.current.pause();
        if ("speechSynthesis" in window) window.speechSynthesis.cancel();
        ttsQueueRef.current = [];
        ttsPlayingRef.current = false;
        setIsTTSPlaying(false);
      }
      return next;
    });
  };

  return (
    <div ref={containerRef} className={`relative flex ${session?.user ? "pt-8" : ""} h-screen bg-slate-50 text-slate-800 overflow-hidden select-none`}>
      {session?.user && (
        <div className="absolute top-0 left-0 right-0 z-10 h-8 bg-sky-500 flex items-center justify-end px-4 gap-3">
          <span className="text-[10px] text-sky-100">
            {session.user.name}
          </span>
          <a href="/complaints" className="text-[10px] text-white hover:text-sky-100 transition-colors font-medium">
            My Complaints
          </a>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-[10px] text-sky-100 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      )}
      {/* Left: Dialog Panel */}
      <div style={{ width: `${leftPct}%` }} className="flex-shrink-0 flex flex-col overflow-hidden">
        <DialogPanel
          messages={messages}
          isStreaming={isStreaming}
          streamingContent={streamingContent}
          interimTranscript={interimTranscript}
          isMuted={isMuted}
          isTTSPlaying={isTTSPlaying}
          onSend={sendMessage}
          onToggleMute={handleToggleMute}
          onNewSession={handleNewSession}
          onRecordingStart={handleRecordingStart}
          onRecordingStop={handleRecordingStop}
          onVoiceTranscript={() => {}}
          onInterimTranscript={setInterimTranscript}
          recognitionLang={inputLang}
          onLanguageChange={setInputLang}
        />
      </div>

      {/* Drag handle */}
      <div
        onMouseDown={() => { isDraggingRef.current = true; }}
        className="w-1.5 flex-shrink-0 bg-gray-200 hover:bg-blue-400/50 active:bg-blue-500/70 cursor-col-resize transition-colors group relative z-10"
      >
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none">
          <div className="w-0.5 h-10 rounded-full bg-gray-300 group-hover:bg-blue-500 transition-colors" />
        </div>
      </div>

      {/* Right: Workbench Panel */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <WorkbenchPanel
          steps={workbenchSteps}
          isThinking={isThinking}
          metrics={metrics}
        />
      </div>
    </div>
  );
}

function formatToolTitle(tool: string): string {
  const titles: Record<string, string> = {
    generate_complaint_log: "Generating complaint log",
    log_complaint: "Logging complaint",
    check_complaint_status: "Checking complaint status",
    escalate_to_human: "Escalating to human staff",
    send_acknowledgement_email: "Sending acknowledgement email",
  };
  return titles[tool] ?? `Calling ${tool}`;
}

function formatToolResultDescription(
  tool: string,
  output: Record<string, unknown>
): string {
  switch (tool) {
    case "log_complaint":
      return `Complaint logged: ${output.complaint_id ?? ""}`;
    case "check_complaint_status":
      return `Status: ${output.status ?? ""} — ${output.assigned_team ?? ""}`;
    case "escalate_to_human":
      return (output.message as string) ?? "Escalated";
    case "send_acknowledgement_email":
      return (output.message as string) ?? "Email sent";
    default:
      return JSON.stringify(output).slice(0, 80);
  }
}

function formatAgentResultDescription(
  agent: string,
  output: Record<string, unknown>
): string {
  switch (agent) {
    case "orchestrator": {
      const cats = (output.categories as string[] | undefined)?.join(", ") ?? "";
      const pri = output.priority ?? "";
      const id = output.complaintId ? ` · ${output.complaintId}` : "";
      return `Priority: ${pri} · Categories: ${cats}${id}`;
    }
    case "summary_agent":
      return (output.situation as string) ?? "SBAR summary generated";
    case "closer_agent":
      return "Response context ready";
    default: {
      const findings = output.findings as string | undefined;
      const urgency = output.urgency as string | undefined;
      return findings
        ? `[${urgency ?? "routine"}] ${findings.slice(0, 100)}`
        : JSON.stringify(output).slice(0, 100);
    }
  }
}
