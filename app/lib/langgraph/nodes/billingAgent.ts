import { getAzureOpenAIClient } from "../../azureOpenAI";
import { AgentState, AgentResult } from "../state";
import { runBillingTools } from "../../tools/billingTools";
import { safeParseJSON } from "../../safeJson";

export async function billingAgentNode(
  state: AgentState
): Promise<Partial<AgentState>> {
  const toolCalls = runBillingTools({ userMessage: state.userMessage });
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
        content: `You are the Billing & Financial Liaison Agent for a hospital complaints management system.
You specialise in billing disputes, insurance claims, overcharging, "surprise bills", and financial hardship.

You have access to real hospital billing data retrieved by your tools. Use it to ground your analysis.

Your responsibilities:
- Identify the specific billing concern (overcharge, insurance denial, coding error, double-billing)
- Assess eligibility for financial assistance or payment plans
- Flag potential billing code errors (ICD/CPT) based on the audit results
- Determine if a billing audit is required
- Reference specific data from the tool results in your findings

Return JSON only.

Schema:
{
  "analysis": "billing assessment grounded in statement/audit data (2-3 sentences)",
  "findings": "specific billing issue identified with reference to tool data",
  "recommendedActions": ["action 1", "action 2", "action 3"],
  "urgency": "routine" | "urgent" | "critical",
  "auditRequired": true | false,
  "financialAidEligible": true | false,
  "insuranceReviewRequired": true | false,
  "estimatedResolution": "brief description of expected resolution path",
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
    temperature: 0.2,
  });

  const raw = response.choices[0].message.content ?? "{}";
  const parsed = safeParseJSON<{
    analysis: string; findings: string;
    recommendedActions: string[]; urgency: "routine" | "urgent" | "critical"; reasoning?: string;
  }>(raw, { analysis: "", findings: "", recommendedActions: [], urgency: "routine" });

  const result: AgentResult = {
    agent: "billing", agentLabel: "Billing & Financial Liaison",
    analysis: parsed.analysis, findings: parsed.findings,
    recommendedActions: parsed.recommendedActions ?? [],
    urgency: parsed.urgency ?? "routine",
    reasoning: parsed.reasoning, toolCalls,
  };
  return { agentResults: [result] };
  } catch {
    return { agentResults: [{ agent: "billing", agentLabel: "Billing & Financial Liaison",
      analysis: "Analysis unavailable.", findings: "Unable to complete billing review.",
      recommendedActions: ["Manual billing review required"], urgency: "routine", toolCalls }] };
  }
}
