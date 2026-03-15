import { getAzureOpenAIClient } from "../../azureOpenAI";
import { createComplaint } from "../../store";
import { AgentState, OrchestratorAnalysis, AgentCategory } from "../state";
import { ComplaintType, UrgencyLevel } from "../../../types";

const URGENCY_MAP: Record<string, UrgencyLevel> = { high: "high", medium: "medium", low: "low" };

const COMPLAINT_TYPE_MAP: Record<AgentCategory, ComplaintType> = {
  clinical: "clinical",
  billing: "billing",
  experience: "staff",
  compliance: "other",
  scheduling: "other",
};

const CATEGORY_KEYWORDS: Record<AgentCategory, string[]> = {
  clinical: [
    "treatment", "doctor", "nurse", "medication", "surgery", "diagnosis",
    "misdiagnosis", "care", "medical", "health", "infection", "pain",
    "procedure", "clinical", "physician", "hospital", "ward",
  ],
  billing: [
    "bill", "charge", "payment", "insurance", "cost", "fee", "invoice",
    "overcharged", "refund", "financial", "price", "amount", "claim",
    "coverage", "out-of-pocket", "deductible",
  ],
  experience: [
    "food", "room", "clean", "noise", "staff", "attitude", "rude",
    "wait", "comfort", "facilities", "parking", "environment", "hygiene",
    "hospitality", "service", "unfriendly", "unhelpful",
  ],
  compliance: [
    "lawsuit", "sue", "legal", "negligence", "malpractice", "rights",
    "hipaa", "privacy", "breach", "violation", "lawyer", "attorney",
    "complaint", "discrimination", "abuse", "harm",
  ],
  scheduling: [
    "appointment", "wait", "delay", "canceled", "rescheduled", "referral",
    "queue", "time", "late", "scheduling", "booking", "slot", "available",
  ],
};


export async function orchestratorNode(
  state: AgentState
): Promise<Partial<AgentState>> {
  const client = getAzureOpenAIClient();

  const sentimentContext = state.sentiment
    ? `Patient emotion: ${state.sentiment.emotion} (intensity: ${state.sentiment.intensity}). ${state.sentiment.summary}`
    : "Sentiment not yet analyzed.";

  const historyContext =
    state.conversationHistory.length > 0
      ? state.conversationHistory
          .slice(-4)
          .map((m) => `${m.role}: ${m.content}`)
          .join("\n")
      : "No prior conversation.";

  const response = await client.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT!,
    messages: [
      {
        role: "system",
        content: `You are the Master Orchestrator Agent for a hospital patient complaints management system.
Your job is to:
1. Determine whether the patient message is an actual complaint or issue that requires action
2. Extract the core issue(s) from genuine complaints
3. Categorize each issue into one or more departments
4. Assign a priority based on clinical risk and emotional intensity
5. Select only the specialist agents that are genuinely needed
6. Extract patient name if mentioned

isComplaint rules — set to true ONLY when the message describes a real grievance, problem, or issue with hospital services (e.g. billing errors, poor care, long waits, staff misconduct). Set to false for general questions, greetings, small talk, unrelated queries, or simple factual questions.

Categories available: clinical, billing, experience, compliance, scheduling

Priority rules:
- high: safety risk, legal threat, clinical emergency, extreme distress, HIPAA concern
- medium: billing dispute, significant service failure, moderate distress
- low: general feedback, minor inconvenience, mild tone

Assign ONLY agents that are relevant — do not assign all agents by default.
If isComplaint is false, assignedAgents should be an empty array.
Compliance agent MUST be assigned if any legal/lawsuit/HIPAA language is present.

Return JSON only, no markdown.

Schema:
{
  "isComplaint": true | false,
  "coreIssues": ["issue 1", "issue 2"],
  "categories": ["clinical", "billing"],
  "priority": "high" | "medium" | "low",
  "assignedAgents": ["clinical", "billing"],
  "reasoning": "brief explanation of routing decisions",
  "requiresImmediateEscalation": true | false,
  "patientName": "extracted name or null",
  "complaintType": "most specific category string"
}`,
      },
      {
        role: "user",
        content: `Sentiment context: ${sentimentContext}

Recent conversation:
${historyContext}

Patient complaint: "${state.userMessage}"`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  const raw = response.choices[0].message.content ?? "{}";
  const analysis = JSON.parse(raw) as OrchestratorAnalysis;

  // Validate and sanitize assignedAgents
  const validCategories: AgentCategory[] = [
    "clinical", "billing", "experience", "compliance", "scheduling",
  ];
  analysis.assignedAgents = (analysis.assignedAgents ?? []).filter((a) =>
    validCategories.includes(a as AgentCategory)
  ) as AgentCategory[];

  // Auto-detect compliance keywords the LLM may have missed
  const lowerMsg = state.userMessage.toLowerCase();
  const complianceHit = CATEGORY_KEYWORDS.compliance.some((kw) =>
    lowerMsg.includes(kw)
  );
  if (complianceHit && !analysis.assignedAgents.includes("compliance")) {
    analysis.assignedAgents.push("compliance");
    analysis.requiresImmediateEscalation = true;
  }

  // Create complaint only when genuinely detected and not already filed this session
  let complaintId = state.complaintId;
  if (!complaintId && analysis.isComplaint === true && analysis.assignedAgents.length > 0) {
    const patientName = analysis.patientName ?? "Unknown Patient";
    const urgency = URGENCY_MAP[analysis.priority] ?? "medium";
    const primaryCategory = analysis.assignedAgents[0] ?? analysis.categories[0] ?? "other";
    const complaintType: ComplaintType = COMPLAINT_TYPE_MAP[primaryCategory as AgentCategory] ?? "other";
    const result = createComplaint(
      patientName,
      complaintType,
      analysis.coreIssues.join("; "),
      urgency as UrgencyLevel
    );
    complaintId = result.complaint_id;
  }

  return { orchestratorAnalysis: analysis, complaintId };
}
