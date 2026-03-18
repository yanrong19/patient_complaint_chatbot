"use client";

import { useState } from "react";
import { PerformanceMetrics, SentimentSnapshot } from "../types";

interface MetricsDrawerProps {
  metrics: PerformanceMetrics;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(ms: number | null): string {
  if (ms === null) return "—";
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

const EMOTION_CONFIG: Record<string, { color: string; bg: string; emoji: string }> = {
  anger:       { color: "text-red-700",    bg: "bg-red-50",    emoji: "😠" },
  distress:    { color: "text-red-700",    bg: "bg-red-50",    emoji: "😰" },
  frustration: { color: "text-orange-700", bg: "bg-orange-50", emoji: "😤" },
  sadness:     { color: "text-amber-700",  bg: "bg-amber-50",  emoji: "😢" },
  confusion:   { color: "text-yellow-700", bg: "bg-yellow-50", emoji: "😕" },
  neutral:     { color: "text-green-700",  bg: "bg-green-50",  emoji: "😐" },
};

// Numeric score for sentiment delta (higher = more positive)
const EMOTION_SCORE: Record<string, number> = {
  distress: 1, anger: 1, sadness: 2, frustration: 2, confusion: 3, neutral: 5,
};
const INTENSITY_OFFSET: Record<string, number> = { high: -0.5, medium: 0, low: 0.5 };

function sentimentScore(snap: SentimentSnapshot): number {
  return (EMOTION_SCORE[snap.emotion] ?? 3) + (INTENSITY_OFFSET[snap.intensity] ?? 0);
}

function SentimentDelta({ history }: { history: SentimentSnapshot[] }) {
  if (history.length < 2) return null;
  const first = sentimentScore(history[0]);
  const last  = sentimentScore(history[history.length - 1]);
  const diff  = last - first;
  if (diff > 0.4)  return <span className="text-green-700 font-semibold text-xs">↑ Improving</span>;
  if (diff < -0.4) return <span className="text-red-700   font-semibold text-xs">↓ Declining</span>;
  return               <span className="text-slate-500    font-semibold text-xs">→ Stable</span>;
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ tier, label, color, children }: {
  tier: string; label: string; color: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${color}`}>
          {tier}
        </span>
        <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{label}</span>
      </div>
      {children}
    </div>
  );
}

// ── Metric cell ───────────────────────────────────────────────────────────────
function Cell({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] text-slate-500 uppercase tracking-wide font-medium whitespace-nowrap">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${accent ? "text-blue-600" : "text-slate-800"}`}>
        {value}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MetricsDrawer({ metrics }: MetricsDrawerProps) {
  const [open, setOpen] = useState(false);

  const { sentimentHistory, escalationCount, complaintsLogged,
          turnCount, taskSuccessRate, ttfTokenMs, e2eLatencyMs,
          sttLatencyMs, ttsLatencyMs } = metrics;

  const escalationRate = turnCount > 0
    ? `${Math.round((escalationCount / turnCount) * 100)}%`
    : "—";

  return (
    <div className="border-t border-gray-200 bg-white">
      {/* Toggle bar */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
            className="w-4 h-4 text-blue-600">
            <path d="M15.5 2A1.5 1.5 0 0 0 14 3.5v13a1.5 1.5 0 0 0 3 0v-13A1.5 1.5 0 0 0 15.5 2ZM9.5 6A1.5 1.5 0 0 0 8 7.5v9a1.5 1.5 0 0 0 3 0v-9A1.5 1.5 0 0 0 9.5 6ZM3.5 10A1.5 1.5 0 0 0 2 11.5v5a1.5 1.5 0 0 0 3 0v-5A1.5 1.5 0 0 0 3.5 10Z" />
          </svg>
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
            Performance Metrics
          </span>
          {turnCount > 0 && (
            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
              {turnCount} turn{turnCount !== 1 ? "s" : ""}
            </span>
          )}
          {/* Live summary badges when collapsed */}
          {!open && turnCount > 0 && (
            <div className="flex items-center gap-1 ml-1">
              {e2eLatencyMs !== null && (
                <span className="text-[9px] bg-gray-100 text-slate-500 px-1.5 py-0.5 rounded">
                  E2E {fmt(e2eLatencyMs)}
                </span>
              )}
              {escalationCount > 0 && (
                <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                  {escalationCount} escalation{escalationCount !== 1 ? "s" : ""}
                </span>
              )}
              {sentimentHistory.length >= 2 && (
                <SentimentDelta history={sentimentHistory} />
              )}
            </div>
          )}
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 flex-shrink-0 ${open ? "rotate-180" : ""}`}>
          <path fillRule="evenodd" d="M9.47 6.47a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 1 1-1.06 1.06L10 8.06l-3.72 3.72a.75.75 0 0 1-1.06-1.06l4.25-4.25Z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-4">

          {/* ── Tier 1: Technical ── */}
          <Section tier="T1" label="Technical" color="bg-blue-100 text-blue-700">
            <div className="grid grid-cols-4 gap-x-4 gap-y-2">
              <Cell label="TTFT"     value={fmt(ttfTokenMs)}  accent />
              <Cell label="E2E"      value={fmt(e2eLatencyMs)} accent />
              <Cell label="STT"      value={fmt(sttLatencyMs)} />
              <Cell label="TTS"      value={fmt(ttsLatencyMs)} />
            </div>
            <p className="text-[9px] text-slate-400 mt-1">
              TTFT = Time to First Token · E2E = full round-trip · STT/TTS = voice pipeline
            </p>
          </Section>

          {/* ── Tier 2: Conversational ── */}
          <Section tier="T2" label="Conversational" color="bg-teal-100 text-teal-700">
            <div className="grid grid-cols-4 gap-x-4 gap-y-2">
              <Cell label="Turns"        value={turnCount > 0 ? String(turnCount) : "—"} />
              <Cell label="Success"      value={turnCount > 0 ? `${taskSuccessRate}%` : "—"} accent />
              <Cell label="Escalation %" value={escalationRate} />
              <Cell label="Complaints"   value={complaintsLogged > 0 ? String(complaintsLogged) : "—"} />
            </div>
          </Section>

          {/* ── Tier 3: Healthcare Outcomes ── */}
          <Section tier="T3" label="Healthcare Outcomes" color="bg-purple-100 text-purple-700">
            {sentimentHistory.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No sentiment data yet</p>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] text-slate-500 uppercase tracking-wide font-medium">
                    Sentiment Trend
                  </span>
                  <SentimentDelta history={sentimentHistory} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {sentimentHistory.map((snap, i) => {
                    const cfg = EMOTION_CONFIG[snap.emotion] ?? EMOTION_CONFIG.neutral;
                    return (
                      <div key={i}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg ${cfg.bg} border border-gray-200`}>
                        <span className="text-sm leading-none">{cfg.emoji}</span>
                        <div>
                          <p className={`text-[9px] font-semibold ${cfg.color} capitalize`}>
                            {snap.emotion}
                          </p>
                          <p className="text-[8px] text-slate-400 capitalize">{snap.intensity}</p>
                        </div>
                        <span className="text-[8px] text-slate-400 ml-0.5">T{i + 1}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Section>

        </div>
      )}
    </div>
  );
}
