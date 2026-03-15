import { getAzureOpenAIClient } from "../../azureOpenAI";
import { AgentState, SentimentResult } from "../state";

export async function sentimentAnalyzerNode(
  state: AgentState
): Promise<Partial<AgentState>> {
  const client = getAzureOpenAIClient();

  const response = await client.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT!,
    messages: [
      {
        role: "system",
        content: `You are a clinical sentiment analysis specialist for a hospital patient relations team.
Analyze the emotional state and communication tone of a patient complaint.
Return a JSON object only — no markdown, no explanation.

Schema:
{
  "emotion": "anger" | "sadness" | "confusion" | "frustration" | "distress" | "neutral",
  "intensity": "low" | "medium" | "high",
  "summary": "one sentence describing the patient's emotional state",
  "tone": "brief description of how the patient is communicating (e.g. hostile, tearful, calm but firm)",
  "reasoning": "one sentence explaining which specific words or phrases led to this assessment"
}`,
      },
      {
        role: "user",
        content: `Analyze the sentiment of this patient message:\n\n"${state.userMessage}"`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  const raw = response.choices[0].message.content ?? "{}";
  const sentiment = JSON.parse(raw) as SentimentResult;
  return { sentiment };
}
