import { getAzureOpenAIClient } from "../../azureOpenAI";
import { AgentState, SBARSummary } from "../state";
import { safeParseJSON } from "../../safeJson";

export async function summaryAgentNode(
  state: AgentState
): Promise<Partial<AgentState>> {
  try {
  const client = getAzureOpenAIClient();

  const agentResultsText = state.agentResults
    .map(
      (r) =>
        `[${r.agentLabel}]\nFindings: ${r.findings}\nActions: ${r.recommendedActions.join(", ")}`
    )
    .join("\n\n");

  const response = await client.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT!,
    messages: [
      {
        role: "system",
        content: `You are the Summary Agent for a hospital patient complaints system.
Your role is to condense all specialist agent findings into a concise SBAR (Situation, Background, Assessment, Recommendation) brief for hospital staff.

SBAR format:
- Situation: What is happening right now? (1-2 sentences)
- Background: Relevant context about the patient and their complaint (2-3 sentences)
- Assessment: What the specialist agents found, combined into a unified picture (2-3 sentences)
- Recommendation: Clear, prioritised action plan for staff (3-5 bullet points as a single string)

Return JSON only.

Schema:
{
  "situation": "...",
  "background": "...",
  "assessment": "...",
  "recommendation": "..."
}`,
      },
      {
        role: "user",
        content: `Patient message: "${state.userMessage}"

Sentiment: ${JSON.stringify(state.sentiment)}
Orchestrator analysis: ${JSON.stringify(state.orchestratorAnalysis)}
Complaint ID: ${state.complaintId ?? "not yet logged"}

Specialist agent findings:
${agentResultsText || "No specialist agents were invoked."}`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
    max_tokens: 400,
  });

  const raw = response.choices[0].message.content ?? "{}";
  const sbarSummary = safeParseJSON<SBARSummary>(raw, {
    situation: state.userMessage,
    background: "Summary could not be generated.",
    assessment: state.agentResults.map((r) => r.findings).filter(Boolean).join(" ") || "See specialist findings.",
    recommendation: "Manual review required.",
  });
  return { sbarSummary };
  } catch {
    return { sbarSummary: {
      situation: state.userMessage,
      background: "Summary unavailable.",
      assessment: "An error occurred during summarisation.",
      recommendation: "Please review the complaint manually.",
    }};
  }
}
