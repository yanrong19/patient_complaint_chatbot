import { getAzureOpenAIClient } from "../../azureOpenAI";
import { AgentState, AgentResult } from "../state";

const HIGH_RISK_KEYWORDS = [
  "lawsuit", "sue", "legal action", "attorney", "lawyer", "negligence",
  "malpractice", "rights violated", "discrimination", "abuse", "hipaa",
  "privacy breach", "confidentiality", "harm", "injury", "death",
];

export async function complianceAgentNode(
  state: AgentState
): Promise<Partial<AgentState>> {
  const client = getAzureOpenAIClient();

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

Your responsibilities:
- Scan for high-risk legal language (lawsuit, negligence, malpractice, rights violated)
- Assess HIPAA / data privacy risk
- Determine if immediate escalation to Risk Management is required
- Ensure any hospital response will be legally compliant
- Recommend whether legal counsel should be involved

High-risk keywords detected in this complaint: ${detectedKeywords.length > 0 ? detectedKeywords.join(", ") : "none"}

Return JSON only.

Schema:
{
  "analysis": "compliance and legal risk assessment in 2-3 sentences",
  "findings": "specific legal/compliance risk identified",
  "recommendedActions": ["action 1", "action 2", "action 3"],
  "urgency": "routine" | "urgent" | "critical",
  "legalRiskLevel": "none" | "low" | "medium" | "high" | "critical",
  "hipaaRisk": true | false,
  "escalateToRiskManagement": true | false,
  "legalCounselRequired": true | false,
  "responseGuidelines": "key things the hospital response must include or avoid for legal compliance",
  "reasoning": "one sentence citing the specific words or phrases that triggered this legal risk assessment"
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
    temperature: 0.1,
  });

  const raw = response.choices[0].message.content ?? "{}";
  const parsed = JSON.parse(raw) as {
    analysis: string;
    findings: string;
    recommendedActions: string[];
    urgency: "routine" | "urgent" | "critical";
    legalRiskLevel: string;
    hipaaRisk?: boolean;
    escalateToRiskManagement?: boolean;
    legalCounselRequired?: boolean;
    reasoning?: string;
  };

  const result: AgentResult = {
    agent: "compliance",
    agentLabel: "Compliance & Legal Risk Agent",
    analysis: parsed.analysis,
    findings: parsed.findings,
    recommendedActions: parsed.recommendedActions ?? [],
    urgency: parsed.urgency ?? "critical",
    reasoning: parsed.reasoning,
  };

  return { agentResults: [result] };
}
