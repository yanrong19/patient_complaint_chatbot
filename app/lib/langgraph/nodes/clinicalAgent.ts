import { getAzureOpenAIClient } from "../../azureOpenAI";
import { AgentState, AgentResult } from "../state";

export async function clinicalAgentNode(
  state: AgentState
): Promise<Partial<AgentState>> {
  const client = getAzureOpenAIClient();

  const response = await client.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT!,
    messages: [
      {
        role: "system",
        content: `You are the Clinical Quality Agent for a hospital complaints management system.
You specialise in complaints about medical treatment, nursing care, medication errors, misdiagnosis, and health outcomes.

Your responsibilities:
- Identify the specific clinical concern (treatment, diagnosis, medication, procedure, nursing care)
- Assess whether this requires an EHR review or clinical audit
- Determine if the Chief Medical Officer or department head needs to be notified
- Flag any patient safety incidents

Return JSON only.

Schema:
{
  "analysis": "clinical assessment of the complaint in 2-3 sentences",
  "findings": "specific clinical concern identified",
  "recommendedActions": ["action 1", "action 2", "action 3"],
  "urgency": "routine" | "urgent" | "critical",
  "ehrReviewRequired": true | false,
  "notifyDepartmentHead": true | false,
  "patientSafetyIncident": true | false,
  "reasoning": "one sentence explaining why this urgency level and these actions were selected"
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
    agent: "clinical",
    agentLabel: "Clinical Quality Agent",
    analysis: parsed.analysis,
    findings: parsed.findings,
    recommendedActions: parsed.recommendedActions ?? [],
    urgency: parsed.urgency ?? "urgent",
    reasoning: parsed.reasoning,
  };

  return { agentResults: [result] };
}
