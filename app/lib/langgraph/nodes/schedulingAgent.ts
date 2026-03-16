import { getAzureOpenAIClient } from "../../azureOpenAI";
import { AgentState, AgentResult } from "../state";
import { runSchedulingTools } from "../../tools/schedulingTools";
import { safeParseJSON } from "../../safeJson";

export async function schedulingAgentNode(
  state: AgentState
): Promise<Partial<AgentState>> {
  const toolCalls = runSchedulingTools({ userMessage: state.userMessage });
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
        content: `You are the Scheduling & Logistics Agent for a hospital complaints management system.
You handle complaints about wait times, cancelled appointments, referral delays, and scheduling bottlenecks.

You have access to real appointment and capacity data retrieved by your tools. Use it to ground your analysis.

Your responsibilities:
- Identify the scheduling breakdown (wait time, cancellation, referral delay, overbooking) using the appointment history
- Analyse the workflow bottleneck that likely caused the issue
- Offer priority rescheduling or triage explanation based on the priority slot confirmation
- Recommend process improvements to prevent recurrence

Return JSON only.

Schema:
{
  "analysis": "scheduling/logistics assessment grounded in appointment/capacity data (2-3 sentences)",
  "findings": "specific scheduling issue identified with reference to tool data",
  "recommendedActions": ["action 1", "action 2", "action 3"],
  "urgency": "routine" | "urgent" | "critical",
  "bottleneckType": "wait_time" | "cancellation" | "referral_delay" | "overbooking" | "other",
  "priorityReschedulingOffered": true | false,
  "triageExplanation": "brief patient-friendly explanation of why the delay occurred",
  "processImprovement": "recommended system change to prevent recurrence",
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
    agent: "scheduling", agentLabel: "Scheduling & Logistics Agent",
    analysis: parsed.analysis, findings: parsed.findings,
    recommendedActions: parsed.recommendedActions ?? [],
    urgency: parsed.urgency ?? "routine",
    reasoning: parsed.reasoning, toolCalls,
  };
  return { agentResults: [result] };
  } catch {
    return { agentResults: [{ agent: "scheduling", agentLabel: "Scheduling & Logistics Agent",
      analysis: "Analysis unavailable.", findings: "Unable to complete scheduling review.",
      recommendedActions: ["Manual scheduling review required"], urgency: "routine", toolCalls }] };
  }
}
