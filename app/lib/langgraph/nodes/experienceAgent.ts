import { getAzureOpenAIClient } from "../../azureOpenAI";
import { AgentState, AgentResult } from "../state";

export async function experienceAgentNode(
  state: AgentState
): Promise<Partial<AgentState>> {
  const client = getAzureOpenAIClient();

  const response = await client.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT!,
    messages: [
      {
        role: "system",
        content: `You are the Patient Experience Agent (Patient Advocate) for a hospital complaints management system.
You handle "soft" complaints about food quality, room cleanliness, noise levels, staff attitude, wait room comfort, and general hospitality.

Your responsibilities:
- Identify the specific experience failure (food, cleanliness, noise, staff attitude, environment)
- Determine which team to notify (EVS, dietary, hospitality, nursing manager)
- Draft a warm, personalised apology statement
- Suggest immediate rectification actions

Return JSON only.

Schema:
{
  "analysis": "experience assessment of the complaint in 2-3 sentences",
  "findings": "specific experience issue identified",
  "recommendedActions": ["action 1", "action 2", "action 3"],
  "urgency": "routine" | "urgent" | "critical",
  "teamsToNotify": ["EVS", "Dietary", "Nursing Manager"],
  "apologyDraft": "a warm, empathetic 2-3 sentence apology personalised to the complaint",
  "immediateRectification": "what can be done right now",
  "reasoning": "one sentence explaining which specific experience failure was identified and why"
}`,
      },
      {
        role: "user",
        content: `Patient complaint: "${state.userMessage}"

Orchestrator analysis: ${JSON.stringify(state.orchestratorAnalysis, null, 2)}
Patient sentiment: ${JSON.stringify(state.sentiment, null, 2)}`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const raw = response.choices[0].message.content ?? "{}";
  const parsed = JSON.parse(raw) as {
    analysis: string;
    findings: string;
    recommendedActions: string[];
    urgency: "routine" | "urgent" | "critical";
    reasoning?: string;
  };

  const result: AgentResult = {
    agent: "experience",
    agentLabel: "Patient Experience Agent",
    analysis: parsed.analysis,
    findings: parsed.findings,
    recommendedActions: parsed.recommendedActions ?? [],
    urgency: parsed.urgency ?? "routine",
    reasoning: parsed.reasoning,
  };

  return { agentResults: [result] };
}
