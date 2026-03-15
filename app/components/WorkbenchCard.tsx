"use client";

import { useState } from "react";
import { WorkbenchStep, WorkbenchStepStatus, AgentNodeType } from "../types";

interface WorkbenchCardProps {
  step: WorkbenchStep;
}

// ── Per-agent visual config ──────────────────────────────────────────────────
interface AgentVisualConfig {
  accentHex: string;
  borderClass: string;
  bgClass: string;
  labelClass: string;
  badgeLabel?: string;
  badgeClass?: string;
  isOrchestrator?: boolean;
  isCompliance?: boolean;
}

const AGENT_CONFIG: Record<AgentNodeType, AgentVisualConfig> = {
  orchestrator: {
    accentHex: "#f59e0b",
    borderClass: "border-amber-500/50",
    bgClass: "bg-amber-500/10",
    labelClass: "text-amber-400",
    badgeLabel: "MASTER",
    badgeClass: "bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider",
    isOrchestrator: true,
  },
  sentiment: {
    accentHex: "#8b5cf6",
    borderClass: "border-violet-500/30",
    bgClass: "bg-violet-500/5",
    labelClass: "text-violet-400",
  },
  clinical: {
    accentHex: "#06b6d4",
    borderClass: "border-cyan-500/30",
    bgClass: "bg-cyan-500/5",
    labelClass: "text-cyan-400",
  },
  billing: {
    accentHex: "#3b82f6",
    borderClass: "border-blue-500/30",
    bgClass: "bg-blue-500/5",
    labelClass: "text-blue-400",
  },
  experience: {
    accentHex: "#10b981",
    borderClass: "border-emerald-500/30",
    bgClass: "bg-emerald-500/5",
    labelClass: "text-emerald-400",
  },
  compliance: {
    accentHex: "#ef4444",
    borderClass: "border-red-500/50",
    bgClass: "bg-red-500/5",
    labelClass: "text-red-400",
    isCompliance: true,
  },
  scheduling: {
    accentHex: "#f97316",
    borderClass: "border-orange-500/30",
    bgClass: "bg-orange-500/5",
    labelClass: "text-orange-400",
  },
  summary: {
    accentHex: "#14b8a6",
    borderClass: "border-teal-500/30",
    bgClass: "bg-teal-500/5",
    labelClass: "text-teal-400",
  },
  closer: {
    accentHex: "#a855f7",
    borderClass: "border-purple-500/30",
    bgClass: "bg-purple-500/5",
    labelClass: "text-purple-400",
  },
};

// Fallback for generic step types (thinking, tool_call, etc.)
const STEP_TYPE_CONFIG: Record<string, { accentHex: string; borderClass: string; bgClass: string }> = {
  thinking:    { accentHex: "#3b82f6", borderClass: "border-blue-500/30",  bgClass: "bg-blue-500/5" },
  tool_call:   { accentHex: "#06b6d4", borderClass: "border-cyan-500/30",  bgClass: "bg-cyan-500/5" },
  tool_result: { accentHex: "#14b8a6", borderClass: "border-teal-500/30",  bgClass: "bg-teal-500/5" },
  complete:    { accentHex: "#22c55e", borderClass: "border-green-500/30", bgClass: "bg-green-500/5" },
  escalation:  { accentHex: "#f59e0b", borderClass: "border-amber-500/40", bgClass: "bg-amber-500/5" },
  error:       { accentHex: "#ef4444", borderClass: "border-red-500/30",   bgClass: "bg-red-500/5" },
};

const STATUS_CONFIG: Record<WorkbenchStepStatus, { label: string; classes: string }> = {
  pending: { label: "Pending", classes: "bg-slate-700 text-slate-300" },
  running: { label: "Running", classes: "bg-blue-500/20 text-blue-300 animate-pulse" },
  done:    { label: "Done",    classes: "bg-green-500/20 text-green-300" },
  error:   { label: "Error",   classes: "bg-red-500/20 text-red-300" },
};

// ── Insight pill derivation ──────────────────────────────────────────────────
interface Pill { label: string; colorClass: string }

function deriveInsightPills(step: WorkbenchStep): Pill[] {
  const { agentType, output } = step;
  if (!output || step.status !== "done") return [];

  const pills: Pill[] = [];

  if (agentType === "sentiment") {
    const emotion = output.emotion as string | undefined;
    const intensity = output.intensity as string | undefined;
    if (emotion) pills.push({ label: `😤 ${emotion}`, colorClass: "bg-violet-500/20 text-violet-300" });
    if (intensity) {
      const ic = intensity === "high" ? "bg-red-500/20 text-red-300" : intensity === "medium" ? "bg-amber-500/20 text-amber-300" : "bg-green-500/20 text-green-300";
      pills.push({ label: `⚡ ${intensity} intensity`, colorClass: ic });
    }
    return pills;
  }

  if (agentType === "orchestrator") {
    const priority = output.priority as string | undefined;
    const categories = output.categories as string[] | undefined;
    const cid = output.complaintId as string | undefined;
    const escalate = output.requiresImmediateEscalation as boolean | undefined;
    if (priority) {
      const pc = priority === "high" ? "bg-red-500/20 text-red-300" : priority === "medium" ? "bg-amber-500/20 text-amber-300" : "bg-green-500/20 text-green-300";
      pills.push({ label: `🎯 ${priority.toUpperCase()} priority`, colorClass: pc });
    }
    categories?.slice(0, 2).forEach(c =>
      pills.push({ label: `📂 ${c}`, colorClass: "bg-amber-500/15 text-amber-400" })
    );
    if (cid) pills.push({ label: `🆔 ${cid}`, colorClass: "bg-slate-700 text-slate-300" });
    if (escalate) pills.push({ label: "⚠️ Escalate", colorClass: "bg-red-500/30 text-red-200 font-bold" });
    return pills;
  }

  if (agentType === "compliance") {
    const legalRisk = output.legalRiskLevel as string | undefined;
    const hipaa = output.hipaaRisk as boolean | undefined;
    const escalate = output.escalateToRiskManagement as boolean | undefined;
    if (legalRisk && legalRisk !== "none") {
      const lc = legalRisk === "critical" || legalRisk === "high" ? "bg-red-500/30 text-red-200 font-semibold" : "bg-amber-500/20 text-amber-300";
      pills.push({ label: `⚖️ Legal: ${legalRisk}`, colorClass: lc });
    }
    if (hipaa) pills.push({ label: "🔒 HIPAA Risk", colorClass: "bg-red-500/30 text-red-200 font-bold" });
    if (escalate) pills.push({ label: "📞 Risk Mgmt", colorClass: "bg-red-500/20 text-red-300" });
    if (!legalRisk && !hipaa && !escalate) {
      const urgency = output.urgency as string | undefined;
      if (urgency) pills.push({ label: `🚨 ${urgency}`, colorClass: "bg-red-500/20 text-red-300" });
    }
    return pills;
  }

  // Generic worker agents (clinical, billing, experience, scheduling)
  const urgency = output.urgency as string | undefined;
  if (urgency) {
    const uc = urgency === "critical" ? "bg-red-500/20 text-red-300" : urgency === "urgent" ? "bg-amber-500/20 text-amber-300" : "bg-green-500/20 text-green-300";
    pills.push({ label: `🚨 ${urgency}`, colorClass: uc });
  }
  const actions = output.recommendedActions as string[] | undefined;
  if (actions?.[0]) {
    pills.push({ label: `✅ ${actions[0].slice(0, 32)}${actions[0].length > 32 ? "…" : ""}`, colorClass: "bg-slate-700 text-slate-300" });
  }

  if (agentType === "summary") {
    return [{ label: "📋 SBAR Ready", colorClass: "bg-teal-500/20 text-teal-300" }];
  }
  if (agentType === "closer") {
    return [{ label: "✉️ Response Prepared", colorClass: "bg-purple-500/20 text-purple-300" }];
  }

  return pills.slice(0, 3);
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
}

// ── Component ────────────────────────────────────────────────────────────────
export default function WorkbenchCard({ step }: WorkbenchCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [reasoningOpen, setReasoningOpen] = useState(false);

  const agentCfg = step.agentType ? AGENT_CONFIG[step.agentType] : null;
  const typeCfg = STEP_TYPE_CONFIG[step.type] ?? STEP_TYPE_CONFIG.thinking;

  const accentHex  = agentCfg?.accentHex  ?? typeCfg.accentHex;
  const borderClass = agentCfg?.borderClass ?? typeCfg.borderClass;
  const bgClass     = agentCfg?.bgClass     ?? typeCfg.bgClass;

  const isCompliance = agentCfg?.isCompliance === true;
  const isOrchestrator = agentCfg?.isOrchestrator === true;
  const isComplianceRunning = isCompliance && step.status === "running";

  const statusCfg = STATUS_CONFIG[step.status];
  const pills = deriveInsightPills(step);
  const reasoning = step.output?.reasoning as string | undefined;
  const hasDetails = step.input || step.output;

  return (
    <div
      className={[
        "relative border rounded-lg overflow-hidden transition-all duration-200 animate-slide-in",
        borderClass,
        bgClass,
        isComplianceRunning ? "animate-pulse-border" : "",
        isOrchestrator ? "shadow-sm shadow-amber-500/10" : "",
      ].join(" ")}
    >
      {/* Colored left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: accentHex }}
      />

      <div className="pl-4 pr-3 pt-3 pb-3">
        {/* ── Header row ── */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-white truncate">
                {step.title}
              </span>

              {/* MASTER badge for orchestrator */}
              {agentCfg?.badgeLabel && (
                <span className={agentCfg.badgeClass}>{agentCfg.badgeLabel}</span>
              )}

              {/* Status badge */}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${statusCfg.classes}`}>
                {statusCfg.label}
              </span>

              {/* Compliance warning when running */}
              {isComplianceRunning && (
                <span className="text-xs text-red-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping inline-block" />
                  Scanning
                </span>
              )}
            </div>

            {step.description && (
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                {step.description}
              </p>
            )}
          </div>

          <span className="text-xs text-slate-500 flex-shrink-0 mt-0.5">
            {formatTime(step.timestamp)}
          </span>
        </div>

        {/* ── Insight pills ── */}
        {pills.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {pills.map((p, i) => (
              <span
                key={i}
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${p.colorClass}`}
              >
                {p.label}
              </span>
            ))}
          </div>
        )}

        {/* ── Chain of Thought accordion ── */}
        {reasoning && step.status === "done" && (
          <div className="mt-2">
            <button
              onClick={() => setReasoningOpen((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className={`w-3 h-3 transition-transform duration-200 ${reasoningOpen ? "rotate-180" : ""}`}
              >
                <path
                  fillRule="evenodd"
                  d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                  clipRule="evenodd"
                />
              </svg>
              <span className={agentCfg?.labelClass ?? "text-slate-400"}>
                🧠 View Chain of Thought
              </span>
            </button>
            {reasoningOpen && (
              <div
                className="mt-1.5 text-xs text-slate-300 bg-slate-950/60 rounded p-2.5 leading-relaxed border-l-2"
                style={{ borderColor: accentHex }}
              >
                <span className="text-slate-500 italic">&ldquo;</span>
                {reasoning}
                <span className="text-slate-500 italic">&rdquo;</span>
              </div>
            )}
          </div>
        )}

        {/* ── Full JSON details accordion ── */}
        {hasDetails && (
          <div className="mt-2">
            <button
              onClick={() => setDetailsOpen((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className={`w-3 h-3 transition-transform duration-200 ${detailsOpen ? "rotate-180" : ""}`}
              >
                <path
                  fillRule="evenodd"
                  d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                  clipRule="evenodd"
                />
              </svg>
              View full details
            </button>

            {detailsOpen && (
              <div className="mt-2 space-y-2">
                {step.input && Object.keys(step.input).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Input</p>
                    <pre className="text-xs text-cyan-300 bg-slate-900/60 rounded p-2 overflow-x-auto whitespace-pre-wrap break-words">
                      {JSON.stringify(step.input, null, 2)}
                    </pre>
                  </div>
                )}
                {step.output && Object.keys(step.output).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Output</p>
                    <pre className="text-xs text-teal-300 bg-slate-900/60 rounded p-2 overflow-x-auto whitespace-pre-wrap break-words">
                      {JSON.stringify(step.output, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
