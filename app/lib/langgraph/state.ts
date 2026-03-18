import { Annotation } from "@langchain/langgraph";
import type { Complaint } from "../../types";

export type EmotionType =
  | "anger"
  | "sadness"
  | "confusion"
  | "frustration"
  | "distress"
  | "neutral";

export type PriorityLevel = "low" | "medium" | "high";
export type AgentCategory =
  | "clinical"
  | "billing"
  | "experience"
  | "compliance"
  | "scheduling";
export type UrgencyLevel = "routine" | "urgent" | "critical";

export interface SentimentResult {
  emotion: EmotionType;
  intensity: PriorityLevel;
  summary: string;
  tone: string;
  reasoning?: string;
}

export interface OrchestratorAnalysis {
  coreIssues: string[];
  categories: AgentCategory[];
  priority: PriorityLevel;
  assignedAgents: AgentCategory[];
  reasoning: string;
  requiresImmediateEscalation: boolean;
  patientName: string | null;
  complaintType: string | null;
  isComplaint: boolean;
  isOutOfScope: boolean;
  isMedicalAdviceRequest: boolean;
}

export interface ToolCallRecord {
  tool: string;
  label: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
}

export interface AgentResult {
  agent: AgentCategory;
  agentLabel: string;
  analysis: string;
  findings: string;
  recommendedActions: string[];
  urgency: UrgencyLevel;
  reasoning?: string;
  toolCalls?: ToolCallRecord[];
  // compliance-specific
  legalRiskLevel?: string;
  hipaaRisk?: boolean;
  escalateToRiskManagement?: boolean;
  // experience-specific
  teamsToNotify?: string[];
  apologyDraft?: string;
  immediateRectification?: string;
}

export interface SBARSummary {
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
}

export interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export const AgentStateAnnotation = Annotation.Root({
  userMessage: Annotation<string>,
  detectedLanguage: Annotation<"en" | "zh">({
    value: (_prev, next) => next,
    default: () => "en",
  }),
  conversationHistory: Annotation<ConversationMessage[]>,
  complaintId: Annotation<string | null>({
    value: (_prev, next) => next,
    default: () => null,
  }),
  pendingComplaint: Annotation<Complaint | null>({
    value: (_prev, next) => next,
    default: () => null,
  }),
  userId: Annotation<string | null>({
    value: (_prev, next) => next,
    default: () => null,
  }),
  sentiment: Annotation<SentimentResult | null>({
    value: (_prev, next) => next,
    default: () => null,
  }),
  orchestratorAnalysis: Annotation<OrchestratorAnalysis | null>({
    value: (_prev, next) => next,
    default: () => null,
  }),
  agentResults: Annotation<AgentResult[]>({
    value: (existing, update) => [...existing, ...update],
    default: () => [],
  }),
  sbarSummary: Annotation<SBARSummary | null>({
    value: (_prev, next) => next,
    default: () => null,
  }),
  closerContext: Annotation<string | null>({
    value: (_prev, next) => next,
    default: () => null,
  }),
});

export type AgentState = typeof AgentStateAnnotation.State;
