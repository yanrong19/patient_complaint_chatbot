import { getAzureOpenAIClient } from "../../azureOpenAI";
import { AgentState, AgentResult } from "../state";
import { runClinicalTools } from "../../tools/clinicalTools";
import { safeParseJSON } from "../../safeJson";

export async function clinicalAgentNode(
  state: AgentState
): Promise<Partial<AgentState>> {
  const toolCalls = runClinicalTools({
    userMessage: state.userMessage,
    coreIssues: state.orchestratorAnalysis?.coreIssues,
  });
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
        content: `You are the Clinical Quality Agent for a hospital complaints management system.
You specialise in complaints about medical treatment, nursing care, medication errors, misdiagnosis, and health outcomes.

You have access to real hospital system data retrieved by your tools. Use it to ground your analysis.

Your responsibilities:
- Identify the specific clinical concern using the EHR and guidelines data
- Assess whether this is a patient safety incident
- Determine if the CMO or department head needs to be notified
- Reference specific data from the tool results in your findings

Return JSON only.

Schema:
{
  "analysis": "clinical assessment grounded in EHR/guidelines data (2-3 sentences)",
  "findings": "specific clinical concern with reference to tool data",
  "recommendedActions": ["action 1", "action 2", "action 3"],
  "urgency": "routine" | "urgent" | "critical",
  "ehrReviewRequired": true | false,
  "notifyDepartmentHead": true | false,
  "patientSafetyIncident": true | false,
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
    max_tokens: 300,
  });

  const raw = response.choices[0].message.content ?? "{}";
  const parsed = safeParseJSON<{
    analysis: string; findings: string;
    recommendedActions: string[]; urgency: "routine" | "urgent" | "critical"; reasoning?: string;
  }>(raw, { analysis: "", findings: "", recommendedActions: [], urgency: "urgent" });

  const result: AgentResult = {
    agent: "clinical", agentLabel: "Clinical Quality Agent",
    analysis: parsed.analysis, findings: parsed.findings,
    recommendedActions: parsed.recommendedActions ?? [],
    urgency: parsed.urgency ?? "urgent",
    reasoning: parsed.reasoning, toolCalls,
  };
  return { agentResults: [result] };
  } catch {
    return { agentResults: [{ agent: "clinical", agentLabel: "Clinical Quality Agent",
      analysis: "Analysis unavailable.", findings: "Unable to complete clinical review.",
      recommendedActions: ["Manual clinical review required"], urgency: "urgent", toolCalls }] };
  }
}
