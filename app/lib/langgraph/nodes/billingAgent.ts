import { getAzureOpenAIClient } from "../../azureOpenAI";
import { AgentState, AgentResult } from "../state";

export async function billingAgentNode(
  state: AgentState
): Promise<Partial<AgentState>> {
  const client = getAzureOpenAIClient();

  const response = await client.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT!,
    messages: [
      {
        role: "system",
        content: `You are the Billing & Financial Liaison Agent for a hospital complaints management system.
You specialise in billing disputes, insurance claims, overcharging, "surprise bills", and financial hardship.

Your responsibilities:
- Identify the specific billing concern (overcharge, insurance denial, coding error, double-billing)
- Assess eligibility for financial assistance or payment plans
- Flag potential billing code errors (ICD/CPT)
- Determine if a billing audit is required

Return JSON only.

Schema:
{
  "analysis": "billing assessment of the complaint in 2-3 sentences",
  "findings": "specific billing issue identified",
  "recommendedActions": ["action 1", "action 2", "action 3"],
  "urgency": "routine" | "urgent" | "critical",
  "auditRequired": true | false,
  "financialAidEligible": true | false,
  "insuranceReviewRequired": true | false,
  "estimatedResolution": "brief description of expected resolution path",
  "reasoning": "one sentence explaining the key billing concern and why these actions are warranted"
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
    temperature: 0.2,
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
    agent: "billing",
    agentLabel: "Billing & Financial Liaison",
    analysis: parsed.analysis,
    findings: parsed.findings,
    recommendedActions: parsed.recommendedActions ?? [],
    urgency: parsed.urgency ?? "routine",
    reasoning: parsed.reasoning,
  };

  return { agentResults: [result] };
}
