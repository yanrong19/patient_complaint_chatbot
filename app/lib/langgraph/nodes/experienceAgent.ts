import { getAzureOpenAIClient } from "../../azureOpenAI";
import { AgentState, AgentResult } from "../state";
import { runExperienceTools } from "../../tools/experienceTools";
import { safeParseJSON } from "../../safeJson";

export async function experienceAgentNode(
  state: AgentState
): Promise<Partial<AgentState>> {
  const toolCalls = runExperienceTools({ userMessage: state.userMessage });
  try {
  const client = getAzureOpenAIClient();
  const toolResultsText = toolCalls.map(tc =>
    `[${tc.label}]\n${JSON.stringify(tc.output, null, 2)}`
  ).join("\n\n");

  const response = await client.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT!,
    messages: [
      {
        role: "system",
        content: `You are the Patient Experience Agent (Patient Advocate) for a hospital complaints management system.
You handle "soft" complaints about food quality, room cleanliness, noise levels, staff attitude, wait room comfort, and general hospitality.

You have access to real ward and facilities data retrieved by your tools. Use it to ground your analysis.

Your responsibilities:
- Identify the specific experience failure (food, cleanliness, noise, staff attitude, environment) using the ward details
- Determine which team to notify (EVS, dietary, hospitality, nursing manager)
- Draft a warm, personalised apology statement
- Suggest immediate rectification actions based on the EVS task created

Return JSON only.

Schema:
{
  "analysis": "experience assessment grounded in ward/facilities data (2-3 sentences)",
  "findings": "specific experience issue identified with reference to tool data",
  "recommendedActions": ["action 1", "action 2", "action 3"],
  "urgency": "routine" | "urgent" | "critical",
  "teamsToNotify": ["EVS", "Dietary", "Nursing Manager"],
  "apologyDraft": "a warm, empathetic 2-3 sentence apology personalised to the complaint",
  "immediateRectification": "what can be done right now",
  "reasoning": "one sentence referencing the specific tool evidence"
}`,
      },
      {
        role: "user",
        content: `Patient complaint: "${state.userMessage}"

Orchestrator analysis: ${JSON.stringify(state.orchestratorAnalysis, null, 2)}
Patient sentiment: ${JSON.stringify(state.sentiment, null, 2)}

TOOL RESULTS:
${toolResultsText}`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
    max_tokens: 600,
  });

  const raw = response.choices[0].message.content ?? "{}";
  const parsed = safeParseJSON<{
    analysis: string; findings: string;
    recommendedActions: string[]; urgency: "routine" | "urgent" | "critical"; reasoning?: string;
    teamsToNotify?: string[]; apologyDraft?: string; immediateRectification?: string;
  }>(raw, { analysis: "", findings: "", recommendedActions: [], urgency: "routine" });

  const result: AgentResult = {
    agent: "experience", agentLabel: "Patient Experience Agent",
    analysis: parsed.analysis, findings: parsed.findings,
    recommendedActions: parsed.recommendedActions ?? [],
    urgency: parsed.urgency ?? "routine",
    reasoning: parsed.reasoning, toolCalls,
    teamsToNotify: parsed.teamsToNotify,
    apologyDraft: parsed.apologyDraft,
    immediateRectification: parsed.immediateRectification,
  };
  return { agentResults: [result] };
  } catch {
    return { agentResults: [{ agent: "experience", agentLabel: "Patient Experience Agent",
      analysis: "Analysis unavailable.", findings: "Unable to complete experience review.",
      recommendedActions: ["Manual review required"], urgency: "routine", toolCalls }] };
  }
}
