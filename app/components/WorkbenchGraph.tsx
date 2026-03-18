"use client";

import { useState } from "react";
import { WorkbenchStep, AgentNodeType, WorkbenchStepStatus } from "../types";

interface WorkbenchGraphProps {
  steps: WorkbenchStep[];
  turnNumber: number;
  userMessage?: string;
  isActive?: boolean;
}

// ── Visual config ─────────────────────────────────────────────────────────────
const AGENT_META: Record<
  AgentNodeType,
  { label: string; icon: string; colorHex: string; bgClass: string; borderClass: string; textClass: string; description: string }
> = {
  orchestrator: { label: "Orchestrator",            icon: "🎯", colorHex: "#d97706", bgClass: "bg-amber-50",   borderClass: "border-amber-300",  textClass: "text-amber-700",   description: "Categorises issues, assigns priority, routes to specialist agents"   },
  clinical:     { label: "Clinical Quality",        icon: "🏥", colorHex: "#0f766e", bgClass: "bg-teal-50",    borderClass: "border-teal-300",   textClass: "text-teal-700",    description: "Reviews medical treatment, care quality, and clinical concerns"      },
  billing:      { label: "Billing & Financial",     icon: "💳", colorHex: "#1d4ed8", bgClass: "bg-blue-50",    borderClass: "border-blue-300",   textClass: "text-blue-700",    description: "Analyses billing discrepancies, charges, and insurance issues"       },
  experience:   { label: "Patient Experience",      icon: "🌟", colorHex: "#047857", bgClass: "bg-emerald-50", borderClass: "border-emerald-300",textClass: "text-emerald-700", description: "Addresses hospitality, environment, and staff conduct concerns"      },
  compliance:   { label: "Compliance & Legal Risk", icon: "⚖️", colorHex: "#b91c1c", bgClass: "bg-red-50",     borderClass: "border-red-300",    textClass: "text-red-700",     description: "Scans for legal risk, HIPAA issues, and regulatory compliance"       },
  scheduling:   { label: "Scheduling & Logistics",  icon: "📅", colorHex: "#c2410c", bgClass: "bg-orange-50",  borderClass: "border-orange-300", textClass: "text-orange-700",  description: "Investigates wait times, appointment scheduling, and referral issues" },
  summary:      { label: "Summary Agent",           icon: "📋", colorHex: "#0e7490", bgClass: "bg-cyan-50",    borderClass: "border-cyan-300",   textClass: "text-cyan-700",    description: "Condenses all findings into SBAR format for clinical staff"          },
  closer:       { label: "Closer Agent",            icon: "✉️", colorHex: "#7e22ce", bgClass: "bg-purple-50",  borderClass: "border-purple-300", textClass: "text-purple-700",  description: "Prepares a final empathetic response for the patient"                },
};

const STATUS_DOT: Record<WorkbenchStepStatus, string> = {
  pending: "bg-gray-300",
  running: "bg-blue-500 animate-pulse",
  done:    "bg-green-500",
  error:   "bg-red-500",
};

const STATUS_LABEL: Record<WorkbenchStepStatus, string> = {
  pending: "Pending",
  running: "Running",
  done:    "Done",
  error:   "Error",
};

const STATUS_BADGE: Record<WorkbenchStepStatus, string> = {
  pending: "bg-gray-100 text-gray-500",
  running: "bg-blue-100 text-blue-700 animate-pulse",
  done:    "bg-green-100 text-green-700",
  error:   "bg-red-100 text-red-700",
};

const SPECIALIST_ORDER: AgentNodeType[] = [
  "clinical", "billing", "experience", "compliance", "scheduling",
];

// ── Key insight (single short string shown on the node itself) ────────────────
function getInsight(agentType: AgentNodeType, step: WorkbenchStep): string | null {
  if (step.status !== "done" || !step.output) return null;
  const o = step.output;
  switch (agentType) {
    case "orchestrator": {
      const pri = o.priority as string | undefined;
      const cats = o.categories as string[] | undefined;
      if (!pri) return null;
      const cat = cats?.[0] ?? "";
      return cat ? `${pri.toUpperCase()} · ${cat}` : pri.toUpperCase();
    }
    case "compliance":
      if (o.hipaaRisk) return "⚠ HIPAA Risk";
      return (o.legalRiskLevel as string | undefined) === "none" ? "Clear" : ((o.legalRiskLevel as string | undefined) ?? null);
    case "summary":
      return "SBAR ready";
    case "closer": {
      const emotion = o.emotion as string | undefined;
      const priority = o.priority as string | undefined;
      if (emotion && priority) return `${priority} · ${emotion}`;
      return "Response ready";
    }
    default:
      return (o.urgency as string | undefined) ?? null;
  }
}

// ── Detail panel: formatted output per agent type ─────────────────────────────
function renderOutputFields(agentType: AgentNodeType, output: Record<string, unknown>) {
  const row = (label: string, value: unknown, highlight?: string) => {
    if (value === undefined || value === null || value === "") return null;
    const str = Array.isArray(value) ? (value as string[]).join(", ") : String(value);
    return (
      <div key={label} className="flex gap-2 text-xs">
        <span className="text-slate-400 w-32 flex-shrink-0">{label}</span>
        <span className={highlight ?? "text-slate-700"}>{str}</span>
      </div>
    );
  };

  switch (agentType) {
    case "orchestrator":
      return [
        row("Priority", (output.priority as string | undefined)?.toUpperCase(), output.priority === "high" ? "text-red-700 font-semibold" : output.priority === "medium" ? "text-amber-700 font-medium" : "text-green-700"),
        row("Categories", output.categories),
        row("Complaint ID", output.complaintId, "text-amber-700 font-mono"),
        row("Assigned Agents", output.assignedAgents),
        row("Immediate Escalation", output.requiresImmediateEscalation ? "YES ⚠️" : undefined, "text-red-700 font-bold"),
      ].filter(Boolean);
    case "compliance":
      return [
        row("Legal Risk", output.legalRiskLevel, (output.legalRiskLevel === "critical" || output.legalRiskLevel === "high") ? "text-red-700 font-semibold" : "text-amber-700"),
        row("HIPAA Risk", output.hipaaRisk ? "YES ⚠️" : undefined, "text-red-700 font-bold"),
        row("Escalate to Risk Mgmt", output.escalateToRiskManagement ? "YES" : undefined, "text-red-700"),
        row("Urgency", output.urgency),
        row("Findings", output.findings),
      ].filter(Boolean);
    case "experience":
      return [
        row("Urgency", output.urgency, output.urgency === "critical" ? "text-red-700 font-semibold" : output.urgency === "urgent" ? "text-amber-700" : "text-green-700"),
        row("Findings", output.findings),
        row("Analysis", output.analysis),
        row("Teams to Notify", output.teamsToNotify),
        row("Immediate Rectification", output.immediateRectification),
        row("Apology Draft", output.apologyDraft),
        row("Recommended Actions", output.recommendedActions),
      ].filter(Boolean);
    case "summary":
      return [
        row("Situation", output.situation),
        row("Background", output.background),
        row("Assessment", output.assessment),
        row("Recommendation", output.recommendation),
      ].filter(Boolean);
    case "closer": {
      const emotion = output.emotion as string | undefined;
      const intensity = output.emotionIntensity as string | undefined;
      const summary = output.emotionSummary as string | undefined;
      const priority = output.priority as string | undefined;
      const issues = output.coreIssues as string[] | undefined;
      const specialists = output.specialistAgents as string[] | undefined;
      const escalation = output.requiresEscalation as boolean | undefined;
      const isComplaint = output.isComplaint as boolean | undefined;
      const complaintId = output.complaintId as string | null | undefined;
      return [
        row("Patient Emotion", emotion && intensity ? `${emotion} (${intensity})` : emotion, "text-purple-700 font-medium"),
        row("Emotional Summary", summary),
        row("Priority", priority, priority === "HIGH" ? "text-red-700 font-semibold" : priority === "MEDIUM" ? "text-amber-700" : "text-green-700"),
        row("Type", isComplaint ? "Complaint" : "General enquiry", isComplaint ? "text-amber-700" : "text-slate-600"),
        row("Core Issues", issues?.join("; ")),
        row("Specialist Input", specialists?.join(", ")),
        row("Complaint ID", complaintId, "text-amber-700 font-mono"),
        row("Immediate Escalation", escalation ? "YES ⚠️" : undefined, "text-red-700 font-bold"),
      ].filter(Boolean);
    }
    default:
      return [
        row("Urgency", output.urgency, output.urgency === "critical" ? "text-red-700 font-semibold" : output.urgency === "urgent" ? "text-amber-700" : "text-green-700"),
        row("Analysis", output.analysis),
        row("Findings", output.findings),
        row("Recommended Actions", output.recommendedActions),
      ].filter(Boolean);
  }
}

interface ToolCallRecord {
  tool: string;
  label: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
}

// ── Agent detail panel (shown when a node is clicked) ────────────────────────
function AgentDetailPanel({
  agentType,
  step,
  onClose,
}: {
  agentType: AgentNodeType;
  step?: WorkbenchStep;
  onClose: () => void;
}) {
  const [rawOpen, setRawOpen] = useState(false);
  const meta = AGENT_META[agentType];
  const status = step?.status ?? "pending";
  const reasoning = step?.output?.reasoning as string | undefined;
  const hasOutput = step?.output && Object.keys(step.output).length > 0;

  return (
    <div className="mt-3 rounded-xl border animate-slide-in overflow-hidden"
      style={{ borderColor: `${meta.colorHex}40` }}>
      {/* Panel header */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ backgroundColor: `${meta.colorHex}15` }}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{meta.icon}</span>
          <div>
            <p className={`text-sm font-semibold ${meta.textClass}`}>{meta.label}</p>
            <p className="text-[10px] text-slate-500">{meta.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[status]}`}>
            {STATUS_LABEL[status]}
          </span>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-0.5"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="px-4 py-3 space-y-3 bg-gray-50">
        {/* Not yet invoked */}
        {!step && (
          <p className="text-xs text-slate-500 italic">
            This agent was not invoked for this query.
          </p>
        )}

        {/* Still running */}
        {step?.status === "running" && (
          <div className="flex items-center gap-2 text-xs text-blue-300">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse inline-block" />
            Agent is processing…
          </div>
        )}

        {/* Chain of thought */}
        {reasoning && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              🧠 Chain of Thought
            </p>
            <div
              className="text-xs text-slate-600 bg-gray-100 rounded-lg p-3 leading-relaxed border-l-2 italic"
              style={{ borderColor: meta.colorHex }}
            >
              &ldquo;{reasoning}&rdquo;
            </div>
          </div>
        )}

        {/* Formatted output fields */}
        {hasOutput && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              📊 Output
            </p>
            <div className="space-y-1.5 bg-gray-100 rounded-lg p-2.5">
              {renderOutputFields(agentType, step!.output!)}
            </div>
          </div>
        )}

        {/* Tool calls — read from agent output */}
        {(() => {
          const toolCalls = (step?.output?.toolCalls ?? []) as ToolCallRecord[];
          if (!toolCalls.length) return null;
          return (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                🔧 Tools Invoked
              </p>
              <div className="flex flex-wrap gap-1.5">
                {toolCalls.map((tc) => (
                  <div
                    key={tc.tool}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-100 border border-gray-200"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      className="w-3 h-3 text-green-400 flex-shrink-0"
                    >
                      <path
                        fillRule="evenodd"
                        d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-[10px] font-medium text-slate-700">{tc.label}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Raw JSON toggle */}
        {hasOutput && (
          <div>
            <button
              onClick={() => setRawOpen((v) => !v)}
              className="flex items-center gap-1.5 text-[10px] text-slate-400 hover:text-slate-600 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                className={`w-3 h-3 transition-transform duration-200 ${rawOpen ? "rotate-180" : ""}`}>
                <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
              </svg>
              {"{ } Raw JSON"}
            </button>
            {rawOpen && (
              <pre className="mt-1.5 text-[9px] text-slate-500 bg-gray-100 rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap break-words border border-gray-200">
                {JSON.stringify(step!.output, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Agent node card ───────────────────────────────────────────────────────────
function AgentNodeCard({
  agentType,
  step,
  compact = false,
  selected = false,
  onClick,
}: {
  agentType: AgentNodeType;
  step?: WorkbenchStep;
  compact?: boolean;
  selected?: boolean;
  onClick: () => void;
}) {
  const meta = AGENT_META[agentType];
  const status = step?.status ?? "pending";
  const isActive = !!step;
  const insight = step ? getInsight(agentType, step) : null;

  return (
    <button
      onClick={onClick}
      className={[
        "border rounded-xl text-left transition-all duration-200 cursor-pointer group",
        compact ? "px-2.5 py-2 min-w-[90px]" : "px-3 py-2.5 min-w-[112px]",
        isActive
          ? `${meta.bgClass} ${meta.borderClass} hover:brightness-95`
          : "bg-gray-100 border-gray-200 opacity-40 cursor-default",
        selected && isActive ? "brightness-125" : "",
        status === "running" ? "ring-1 ring-blue-400/30" : "",
      ].join(" ")}
      style={selected && isActive ? { outline: `2px solid ${meta.colorHex}`, outlineOffset: "2px" } : undefined}
      disabled={!isActive}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className={compact ? "text-base leading-none" : "text-xl leading-none"}>
          {meta.icon}
        </span>
        <div
          className={[
            "rounded-full flex-shrink-0",
            compact ? "w-1.5 h-1.5" : "w-2 h-2",
            isActive ? STATUS_DOT[status] : "bg-gray-300 opacity-50",
          ].join(" ")}
        />
      </div>
      <p
        className={[
          "font-semibold leading-tight",
          compact ? "text-[9px]" : "text-[11px]",
          isActive ? meta.textClass : "text-gray-400",
        ].join(" ")}
      >
        {meta.label}
      </p>
      {insight && (
        <p className="text-[9px] text-slate-400 mt-0.5 leading-tight truncate max-w-[100px]">
          {insight}
        </p>
      )}
      {isActive && !selected && (
        <p className={`text-[8px] mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${meta.textClass}`}>
          click to inspect
        </p>
      )}
    </button>
  );
}

// ── Arrow connector ───────────────────────────────────────────────────────────
function Arrow() {
  return (
    <div className="flex-shrink-0 flex items-center px-1.5">
      <svg width="22" height="14" viewBox="0 0 22 14" fill="none">
        <line x1="0" y1="7" x2="15" y2="7" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M12 4 L18 7 L12 10" stroke="#94a3b8" strokeWidth="1.5" fill="none"
          strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// ── Parallel zone box ─────────────────────────────────────────────────────────
function ParallelZone({
  specialists,
  stepMap,
  pendingRouting,
  selectedAgent,
  onSelectAgent,
}: {
  specialists: AgentNodeType[];
  stepMap: Map<AgentNodeType, WorkbenchStep>;
  pendingRouting: boolean;
  selectedAgent: AgentNodeType | null;
  onSelectAgent: (t: AgentNodeType) => void;
}) {
  return (
    <div className="border border-gray-200 rounded-xl bg-gray-50 px-3 py-2.5 mx-1">
      <p className="text-[8px] text-slate-400 uppercase tracking-widest mb-2 font-bold text-center">
        ⚡ Parallel
      </p>
      {pendingRouting ? (
        <div className="flex items-center gap-1.5 py-1 px-1">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
          <span className="text-[9px] text-slate-400 whitespace-nowrap">Routing…</span>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {specialists.map((t) => (
            <AgentNodeCard
              key={t}
              agentType={t}
              step={stepMap.get(t)}
              compact
              selected={selectedAgent === t}
              onClick={() => onSelectAgent(t)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function WorkbenchGraph({
  steps,
  turnNumber,
  userMessage,
  isActive = false,
}: WorkbenchGraphProps) {
  const [selectedAgent, setSelectedAgent] = useState<AgentNodeType | null>(null);

  const handleSelectAgent = (agentType: AgentNodeType) => {
    setSelectedAgent((prev) => (prev === agentType ? null : agentType));
  };

  // Build lookup maps
  const stepMap = new Map<AgentNodeType, WorkbenchStep>();
  for (const step of steps) {
    if (step.agentType) stepMap.set(step.agentType, step);
  }

  const activeSpecialists = SPECIALIST_ORDER.filter((t) => stepMap.has(t));
  const orchestratorRunning = stepMap.get("orchestrator")?.status === "running";
  // Show the parallel zone while orchestrator is routing, or once specialists have fired
  const showSpecialists = orchestratorRunning || activeSpecialists.length > 0;
  const pendingRouting = orchestratorRunning && activeSpecialists.length === 0;
  const showSummary = stepMap.has("summary");
  const showCloser = stepMap.has("closer");

  const hasError = steps.some((s) => s.status === "error");
  const isDone = stepMap.get("closer")?.status === "done";

  return (
    <div
      className={[
        "rounded-xl border p-4 transition-all duration-300",
        isActive
          ? "border-blue-200 bg-white shadow-md shadow-blue-100/50"
          : "border-gray-200 bg-white",
      ].join(" ")}
    >
      {/* Turn header */}
      <div className="flex items-center gap-2 mb-4">
        <span
          className={[
            "text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded",
            isDone
              ? "bg-green-500/15 text-green-400"
              : hasError
              ? "bg-red-500/15 text-red-400"
              : isActive
              ? "bg-blue-500/15 text-blue-400 animate-pulse"
              : "bg-gray-100 text-gray-500",
          ].join(" ")}
        >
          {isDone ? "✓ Done" : hasError ? "Error" : isActive ? "● Live" : `Turn ${turnNumber}`}
        </span>
        <span className="text-[9px] text-slate-500 font-semibold uppercase tracking-widest">
          Turn {turnNumber}
        </span>
        {userMessage && (
          <span className="text-xs text-slate-400 truncate flex-1 min-w-0">
            &ldquo;{userMessage}&rdquo;
          </span>
        )}
      </div>

      {/* Flow graph — only renders executed nodes */}
      <div className="overflow-x-auto">
        <div className="flex items-center min-w-max gap-0">
          {/* Orchestrator — always shown */}
          <AgentNodeCard
            agentType="orchestrator"
            step={stepMap.get("orchestrator")}
            selected={selectedAgent === "orchestrator"}
            onClick={() => handleSelectAgent("orchestrator")}
          />

          {/* Specialist parallel zone — only while routing or once specialists fired */}
          {showSpecialists && (
            <>
              <Arrow />
              <ParallelZone
                specialists={activeSpecialists}
                stepMap={stepMap}
                pendingRouting={pendingRouting}
                selectedAgent={selectedAgent}
                onSelectAgent={handleSelectAgent}
              />
            </>
          )}

          {/* Summary — only if it ran */}
          {showSummary && (
            <>
              <Arrow />
              <AgentNodeCard
                agentType="summary"
                step={stepMap.get("summary")}
                selected={selectedAgent === "summary"}
                onClick={() => handleSelectAgent("summary")}
              />
            </>
          )}

          {/* Closer — only if it ran */}
          {showCloser && (
            <>
              <Arrow />
              <AgentNodeCard
                agentType="closer"
                step={stepMap.get("closer")}
                selected={selectedAgent === "closer"}
                onClick={() => handleSelectAgent("closer")}
              />
            </>
          )}
        </div>
      </div>

      {/* Detail panel for selected agent */}
      {selectedAgent && (
        <AgentDetailPanel
          agentType={selectedAgent}
          step={stepMap.get(selectedAgent)}
          onClose={() => setSelectedAgent(null)}
        />
      )}
    </div>
  );
}
