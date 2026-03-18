"use client";

import { useEffect, useRef, useState } from "react";
import { Message } from "../types";
import VoiceButton from "./VoiceButton";
import ComplaintCard from "./ComplaintCard";

interface DialogPanelProps {
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;
  interimTranscript: string;
  isMuted: boolean;
  isTTSPlaying: boolean;
  onSend: (text: string) => void;
  onToggleMute: () => void;
  onNewSession: () => void;
  onRecordingStart: () => void;
  onRecordingStop: (latencyMs: number) => void;
  onVoiceTranscript: (text: string) => void;
  onInterimTranscript: (text: string) => void;
  recognitionLang: "en-US" | "zh-CN";
  onLanguageChange: (lang: "en-US" | "zh-CN") => void;
}

function AgentAvatar() {
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center flex-shrink-0 shadow-sm">
      <span className="text-xs font-bold text-white">K</span>
    </div>
  );
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function DialogPanel({
  messages,
  isStreaming,
  streamingContent,
  interimTranscript,
  isMuted,
  isTTSPlaying,
  onSend,
  onToggleMute,
  onNewSession,
  onRecordingStart,
  onRecordingStop,
  onVoiceTranscript,
  onInterimTranscript,
  recognitionLang,
  onLanguageChange,
}: DialogPanelProps) {
  const [inputValue, setInputValue] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent, interimTranscript]);

  const handleSubmit = () => {
    const text = inputValue.trim();
    if (!text || isStreaming) return;
    setInputValue("");
    onSend(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleVoiceTranscript = (text: string) => {
    onVoiceTranscript(text);
    onSend(text);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-sky-200 bg-sky-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center shadow-sm">
              <span className="text-xs font-bold text-white">KR</span>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-sky-900">
                Patient Complaints AI
              </h1>
              <p className="text-xs text-sky-500">Powered by Kira</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* TTS playing indicator */}
            {isTTSPlaying && (
              <div className="flex items-center gap-1 text-xs text-sky-600">
                <span className="flex gap-px items-end h-3">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-1 bg-sky-500 rounded-sm animate-bounce"
                      style={{
                        animationDelay: `${i * 0.15}s`,
                        height: `${60 + i * 20}%`,
                      }}
                    />
                  ))}
                </span>
                <span>Speaking</span>
              </div>
            )}
            {/* Mute toggle */}
            <button
              onClick={onToggleMute}
              className={`p-2 rounded-lg transition-all ${
                isMuted
                  ? "bg-red-100 text-red-600 hover:bg-red-200"
                  : "bg-sky-100 text-sky-600 hover:bg-sky-200"
              }`}
              title={isMuted ? "Unmute audio" : "Mute audio"}
            >
              {isMuted ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path d="M9.547 3.062A.75.75 0 0 1 10 3.75v12.5a.75.75 0 0 1-1.264.546L4.703 13H3.167a.75.75 0 0 1-.7-.48A6.985 6.985 0 0 1 2 10c0-.887.165-1.737.468-2.52a.75.75 0 0 1 .7-.48h1.535l4.033-3.796a.75.75 0 0 1 .811-.142ZM13.28 7.22a.75.75 0 1 0-1.06 1.06L13.44 9.5l-1.22 1.22a.75.75 0 1 0 1.06 1.06l1.22-1.22 1.22 1.22a.75.75 0 1 0 1.06-1.06L15.56 9.5l1.22-1.22a.75.75 0 1 0-1.06-1.06l-1.22 1.22-1.22-1.22Z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path d="M10 3.75a.75.75 0 0 0-1.264-.546L4.703 7H3.167a.75.75 0 0 0-.7.48A6.985 6.985 0 0 0 2 10c0 .887.165 1.737.468 2.52.111.29.39.48.7.48h1.535l4.033 3.796A.75.75 0 0 0 10 16.25V3.75ZM15.95 5.05a.75.75 0 0 0-1.06 1.061 5.5 5.5 0 0 1 0 7.778.75.75 0 0 0 1.06 1.06 7 7 0 0 0 0-9.899ZM13.829 7.172a.75.75 0 0 0-1.061 1.06 2.5 2.5 0 0 1 0 3.536.75.75 0 0 0 1.06 1.06 4 4 0 0 0 0-5.656Z" />
                </svg>
              )}
            </button>
            {/* New Session */}
            <button
              onClick={onNewSession}
              className="px-3 py-1.5 text-xs bg-sky-100 hover:bg-sky-200 text-sky-700 rounded-lg transition-colors font-medium"
              title="Start new session"
            >
              New Session
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-slate-50">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center mb-4 shadow-md">
              <span className="text-xl font-bold text-white">K</span>
            </div>
            <p className="text-sm font-medium text-slate-700">Welcome to Patient Complaints AI</p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              Speak or type your concern. Kira will help log, track, and escalate your complaint.
            </p>
          </div>
        )}

        {messages.map((msg, idx) => {
          const isLastAssistant =
            msg.role === "assistant" &&
            idx === messages.length - 1 &&
            !isStreaming;
          return (
            <div key={msg.id}>
              <div
                className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                {msg.role === "assistant" && <AgentAvatar />}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                    msg.role === "user"
                      ? "bg-sky-500 text-white rounded-tr-sm"
                      : "bg-white text-slate-700 rounded-tl-sm border border-gray-200 shadow-sm"
                  }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </p>
                  {msg.complaintCard && (
                    <ComplaintCard complaint={msg.complaintCard} />
                  )}
                  <p
                    className={`text-xs mt-1 ${
                      msg.role === "user" ? "text-blue-200" : "text-slate-400"
                    }`}
                  >
                    {formatTime(msg.timestamp)}
                  </p>
                </div>
              </div>
              {isLastAssistant && msg.suggestions && msg.suggestions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2 ml-11">
                  {msg.suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => onSend(s)}
                      className="px-3 py-1.5 text-xs font-medium rounded-full border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-400 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Streaming response */}
        {isStreaming && streamingContent && (
          <div className="flex gap-3">
            <AgentAvatar />
            <div className="max-w-[80%] rounded-2xl rounded-tl-sm px-4 py-2.5 bg-white text-slate-700 border border-gray-200 shadow-sm">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {streamingContent}
                <span className="inline-block w-1.5 h-4 bg-blue-500 ml-0.5 animate-pulse align-middle" />
              </p>
            </div>
          </div>
        )}

        {/* Thinking indicator (no content yet) */}
        {isStreaming && !streamingContent && (
          <div className="flex gap-3">
            <AgentAvatar />
            <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-white border border-gray-200 shadow-sm">
              <div className="flex gap-1 items-center">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Interim transcript */}
        {interimTranscript && (
          <div className="flex flex-row-reverse gap-3">
            <div className="max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-2.5 bg-blue-50 text-blue-700 border border-blue-200">
              <p className="text-sm leading-relaxed italic">{interimTranscript}</p>
              <p className="text-xs mt-1 text-blue-500">Listening...</p>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-gray-200 bg-white">
        <div className="flex items-end gap-2">
          <VoiceButton
            onTranscript={handleVoiceTranscript}
            onInterimTranscript={onInterimTranscript}
            onRecordingStart={onRecordingStart}
            onRecordingStop={onRecordingStop}
            disabled={isStreaming}
            recognitionLang={recognitionLang}
            onLanguageChange={onLanguageChange}
          />
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isStreaming}
              placeholder="Type your message or use the mic..."
              rows={1}
              className="w-full bg-gray-50 text-slate-800 text-sm placeholder-slate-400 rounded-xl px-4 py-2.5 pr-12 border border-gray-300 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-300 resize-none transition-colors disabled:opacity-50"
              style={{ minHeight: "42px", maxHeight: "120px" }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
              }}
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={!inputValue.trim() || isStreaming}
            className="w-10 h-10 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4 text-white"
            >
              <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.908 6.653H13.5a.75.75 0 0 1 0 1.5H4.188l-1.91 6.664a.75.75 0 0 0 .826.95 28.896 28.896 0 0 0 15.293-7.154.75.75 0 0 0 0-1.115A28.897 28.897 0 0 0 3.105 2.288Z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
