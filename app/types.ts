export type MessageRole = "user" | "assistant" | "system";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  complaintCard?: Complaint;
}

export type ComplaintType = "billing" | "clinical" | "staff" | "facility" | "other";
export type UrgencyLevel = "low" | "medium" | "high";
export type ComplaintStatus = "received" | "under_review" | "resolved";

export interface Complaint {
  complaint_id: string;
  patient_name: string;
  complaint_type: ComplaintType;
  description: string;
  urgency: UrgencyLevel;
  status: ComplaintStatus;
  assigned_team: string;
  created_at: string;
  last_updated: string;
  escalated: boolean;
  escalation_reason?: string;
  acknowledgement_sent: boolean;
}

export type WorkbenchStepType = "thinking" | "tool_call" | "tool_result" | "complete" | "escalation" | "error";
export type WorkbenchStepStatus = "pending" | "running" | "done" | "error";

export type AgentNodeType =
  | "orchestrator"
  | "sentiment"
  | "clinical"
  | "billing"
  | "experience"
  | "compliance"
  | "scheduling"
  | "summary"
  | "closer";

export interface WorkbenchStep {
  id: string;
  type: WorkbenchStepType;
  title: string;
  description?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  timestamp: number;
  status: WorkbenchStepStatus;
  tool?: string;
  agentType?: AgentNodeType;
  turnId?: number;
}

export interface SentimentSnapshot {
  turn: number;
  emotion: string;
  intensity: string;
}

export interface PerformanceMetrics {
  // Tier 1 — Technical
  sttLatencyMs: number | null;   // Voice-to-text pipeline (voice turns only)
  ttfTokenMs: number | null;     // Time to first streaming token (graph + LLM)
  ttsLatencyMs: number | null;   // Text-to-speech pipeline
  e2eLatencyMs: number | null;   // Full round-trip: send → response complete

  // Tier 2 — Conversational
  turnCount: number;
  taskSuccessRate: number;       // % turns that completed without error
  escalationCount: number;       // Turns where immediate escalation was triggered
  complaintsLogged: number;      // Complaints formally registered this session

  // Tier 3 — Healthcare Outcomes
  sentimentHistory: SentimentSnapshot[];   // Per-turn emotion snapshots

  // Internal accumulators (not displayed directly)
  totalTurns: number;
  successfulTurns: number;
}

export type SSEEventType =
  | "token"
  | "tool_start"
  | "tool_result"
  | "agent_start"
  | "agent_result"
  | "done"
  | "error";

export interface SSEToken {
  type: "token";
  content: string;
}

export interface SSEToolStart {
  type: "tool_start";
  tool: string;
  input: Record<string, unknown>;
}

export interface SSEToolResult {
  type: "tool_result";
  tool: string;
  output: Record<string, unknown>;
}

export interface SSEAgentStart {
  type: "agent_start";
  agent: string;
  agentLabel: string;
  description: string;
}

export interface SSEAgentResult {
  type: "agent_result";
  agent: string;
  agentLabel: string;
  output: Record<string, unknown>;
}

export interface SSEDone {
  type: "done";
  fullResponse: string;
  complaint?: Complaint;
  complaintId?: string;
}

export interface SSEError {
  type: "error";
  message: string;
}

export type SSEEvent =
  | SSEToken
  | SSEToolStart
  | SSEToolResult
  | SSEAgentStart
  | SSEAgentResult
  | SSEDone
  | SSEError;
