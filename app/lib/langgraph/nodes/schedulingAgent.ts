import { getAzureOpenAIClient } from "../../azureOpenAI";
import { AgentState, AgentResult } from "../state";

export async function schedulingAgentNode(
  state: AgentState
): Promise<Partial<AgentState>> {
  const client = getAzureOpenAIClient();

  const response = await client.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT!,
    messages: [
      {
        role: "system",
        content: `You are the Scheduling & Logistics Agent for a hospital complaints management system.
You handle complaints about wait times, cancelled appointments, referral delays, and scheduling bottlenecks.

Your responsibilities:
- Identify the scheduling breakdown (wait time, cancellation, referral delay, overbooking)
- Analyse the workflow bottleneck that likely caused the issue
- Offer priority rescheduling or triage explanation
- Recommend process improvements to prevent recurrence

Return JSON only.

Schema:
{
  "analysis": "scheduling/logistics assessment of the complaint in 2-3 sentences",
  "findings": "specific scheduling issue identified",
  "recommendedActions": ["action 1", "action 2", "action 3"],
  "urgency": "routine" | "urgent" | "critical",
  "bottleneckType": "wait_time" | "cancellation" | "referral_delay" | "overbooking" | "other",
  "priorityReschedulingOffered": true | false,
  "triageExplanation": "brief patient-friendly explanation of why the delay occurred",
  "processImprovement": "recommended system change to prevent recurrence",
  "reasoning": "one sentence explaining which scheduling failure caused the complaint and how it was determined"
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
    agent: "scheduling",
    agentLabel: "Scheduling & Logistics Agent",
    analysis: parsed.analysis,
    findings: parsed.findings,
    recommendedActions: parsed.recommendedActions ?? [],
    urgency: parsed.urgency ?? "routine",
    reasoning: parsed.reasoning,
  };

  return { agentResults: [result] };
}
