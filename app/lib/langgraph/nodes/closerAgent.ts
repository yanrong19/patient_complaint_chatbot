import { AgentState } from "../state";

// ── Guardrail response templates ───────────────────────────────────────────────

const OUT_OF_SCOPE_CONTEXT = `
You are Kira, the Patient Complaints AI for a hospital.
The patient has sent a message that is outside the scope of what this system can help with.

INSTRUCTIONS:
- Politely acknowledge their message
- Clearly explain that you can only assist with hospital-related matters such as complaints, billing enquiries, appointment issues, and patient experience concerns
- Do NOT attempt to answer their query or speculate on an answer
- Suggest they contact the relevant service directly, or speak with a member of hospital staff who can better assist them
- Keep the response warm, brief, and under 80 words
`.trim();

const MEDICAL_ADVICE_REFUSAL_CONTEXT = `
You are Kira, the Patient Complaints AI for a hospital.
The patient is asking for medical advice, diagnosis, or treatment guidance.

INSTRUCTIONS:
- REFUSE to provide any medical diagnosis, treatment recommendation, drug dosage, or clinical guidance of any kind
- Do NOT speculate, suggest, or imply any medical answer even indirectly
- Clearly explain that you are not a medical professional and are not able to give medical advice
- Direct the patient to consult with their doctor, specialist, or the hospital's clinical team
- If appropriate, offer to help them log a complaint or book an appointment instead
- Keep the response empathetic, clear, and under 100 words
`.trim();

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
  try {
  const analysis = state.orchestratorAnalysis;

  // ── Guardrail overrides — checked before any other logic ──────────────────
  if (analysis?.isMedicalAdviceRequest) {
    return { closerContext: MEDICAL_ADVICE_REFUSAL_CONTEXT };
  }
  if (analysis?.isOutOfScope) {
    return { closerContext: OUT_OF_SCOPE_CONTEXT };
  }
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
  } catch {
    return { closerContext: "You are Kira, a hospital patient support assistant. Apologise warmly and let the patient know their concern has been noted and a staff member will follow up shortly." };
  }
}
