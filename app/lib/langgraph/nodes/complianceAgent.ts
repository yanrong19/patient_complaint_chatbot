import { getAzureOpenAIClient } from "../../azureOpenAI";
import { AgentState, AgentResult } from "../state";
import { runComplianceTools } from "../../tools/complianceTools";
import { safeParseJSON } from "../../safeJson";

const HIGH_RISK_KEYWORDS = [
  "lawsuit", "sue", "legal action", "attorney", "lawyer", "negligence",
  "malpractice", "rights violated", "discrimination", "abuse", "hipaa",
  "privacy breach", "confidentiality", "harm", "injury", "death",
];

export async function complianceAgentNode(
  state: AgentState
): Promise<Partial<AgentState>> {
  const toolCalls = runComplianceTools({ userMessage: state.userMessage });
  try {
  const client = getAzureOpenAIClient();

  const toolResultsText = toolCalls.map(tc =>
    `[${tc.label}]\n${JSON.stringify(tc.output, null, 2)}`
  ).join("\n\n");

  const detectedKeywords = HIGH_RISK_KEYWORDS.filter((kw) =>
    state.userMessage.toLowerCase().includes(kw)
  );

  const response = await client.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT!,
    messages: [
      {
        role: "system",
        content: `You are the Compliance & Legal Risk Agent for a hospital complaints management system.
You are the most critical agent — you handle HIPAA violations, privacy breaches, malpractice threats, and legal/regulatory risks.

You have access to real risk assessment data retrieved by your tools. Use it to ground your analysis.

Your responsibilities:
- Scan for high-risk legal language (lawsuit, negligence, malpractice, rights violated)
- Assess HIPAA / data privacy risk
- Determine if immediate escalation to Risk Management is required
- Ensure any hospital response will be legally compliant
- Recommend whether legal counsel should be involved
- Reference the risk score and legal hold status from the tool results

High-risk keywords detected in this complaint: ${detectedKeywords.length > 0 ? detectedKeywords.join(", ") : "none"}

Return JSON only.

Schema:
{
  "analysis": "compliance and legal risk assessment grounded in tool data (2-3 sentences)",
  "findings": "specific legal/compliance risk identified with reference to tool data",
  "recommendedActions": ["action 1", "action 2", "action 3"],
  "urgency": "routine" | "urgent" | "critical",
  "legalRiskLevel": "none" | "low" | "medium" | "high" | "critical",
  "hipaaRisk": true | false,
  "escalateToRiskManagement": true | false,
  "legalCounselRequired": true | false,
  "responseGuidelines": "key things the hospital response must include or avoid for legal compliance",
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
    temperature: 0.1,
    max_tokens: 300,
  });

  const raw = response.choices[0].message.content ?? "{}";
  const parsed = safeParseJSON<{
    analysis: string; findings: string; recommendedActions: string[];
    urgency: "routine" | "urgent" | "critical"; legalRiskLevel?: string;
    hipaaRisk?: boolean; escalateToRiskManagement?: boolean; reasoning?: string;
  }>(raw, { analysis: "", findings: "", recommendedActions: [], urgency: "critical" });

  const result: AgentResult = {
    agent: "compliance", agentLabel: "Compliance & Legal Risk Agent",
    analysis: parsed.analysis, findings: parsed.findings,
    recommendedActions: parsed.recommendedActions ?? [],
    urgency: parsed.urgency ?? "critical",
    reasoning: parsed.reasoning, toolCalls,
  };
  return { agentResults: [result] };
  } catch {
    return { agentResults: [{ agent: "compliance", agentLabel: "Compliance & Legal Risk Agent",
      analysis: "Analysis unavailable.", findings: "Unable to complete compliance review.",
      recommendedActions: ["Manual legal review required"], urgency: "critical", toolCalls }] };
  }
}
