import { AgentState } from "../state";

const URGENCY_LABELS: Record<string, string> = {
  critical: "⚠️ CRITICAL — immediate escalation required",
  urgent: "🔴 URGENT — same-day response required",
  routine: "🟢 Routine — standard resolution pathway",
};

const EMOTION_TONE_GUIDE: Record<string, string> = {
  anger:
    "The patient is angry. Open with a sincere acknowledgement of their frustration. Avoid defensive language.",
  sadness:
    "The patient is distressed or sad. Lead with compassion and reassurance that they are being heard.",
  confusion:
    "The patient is confused. Be clear, structured, and patient. Avoid jargon.",
  frustration:
    "The patient is frustrated. Validate their experience and give concrete next steps.",
  distress:
    "The patient is in distress. Prioritise empathy and immediate reassurance before logistics.",
  neutral: "Maintain a warm, professional tone.",
};

export async function closerAgentNode(
  state: AgentState
): Promise<Partial<AgentState>> {
  const analysis = state.orchestratorAnalysis;
  const sentiment = state.sentiment;
  const sbar = state.sbarSummary;

  const toneGuide =
    EMOTION_TONE_GUIDE[sentiment?.emotion ?? "neutral"] ??
    EMOTION_TONE_GUIDE.neutral;

  const priorityLabel = analysis?.priority ?? "medium";
  const escalation = analysis?.requiresImmediateEscalation
    ? "⚠️ This complaint requires IMMEDIATE escalation to senior staff."
    : "";

  const agentSummaries = state.agentResults
    .map((r) => {
      const urgencyLabel = URGENCY_LABELS[r.urgency] ?? r.urgency;
      return `• ${r.agentLabel} [${urgencyLabel}]: ${r.findings}\n  Actions: ${r.recommendedActions.slice(0, 2).join("; ")}`;
    })
    .join("\n");

  const isZh = state.detectedLanguage === "zh";
  const langInstruction = isZh
    ? `\nLANGUAGE: The patient wrote in Chinese Mandarin. Your ENTIRE response MUST be written in Simplified Chinese (简体中文). Do not use English in your response except for the complaint ID (e.g. CR-XXXX-XXXX).`
    : `\nLANGUAGE: Respond in English.`;

  const closerContext = `
=== KIRA RESPONSE CONTEXT ===
You are Kira, the Patient Complaints AI for a hospital. Draft a spoken, empathetic response to the patient.
${langInstruction}

TONE GUIDANCE:
${toneGuide}

PRIORITY: ${priorityLabel.toUpperCase()}
${escalation}

COMPLAINT ID: ${state.complaintId ?? "pending"}
CORE ISSUES: ${analysis?.coreIssues?.join(", ") ?? state.userMessage}

SBAR ASSESSMENT:
- Situation: ${sbar?.situation ?? ""}
- Assessment: ${sbar?.assessment ?? ""}
- Recommendation: ${sbar?.recommendation ?? ""}

SPECIALIST FINDINGS:
${agentSummaries || "General review completed."}

RESPONSE GUIDELINES:
1. Acknowledge the specific issue(s) the patient raised
2. Express genuine empathy calibrated to their emotional state
3. Tell them what happens next (concrete steps and timeline)
4. Mention their complaint ID if one was created
5. If escalation is required, say a senior team member will contact them shortly
6. Close warmly — the patient should feel heard and supported
7. Keep the response conversational and under 200 words
8. Do NOT use clinical jargon or defensive language
`.trim();

  return { closerContext };
}
