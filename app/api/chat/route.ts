import { NextRequest } from "next/server";
import { getAzureOpenAIClient } from "../../lib/azureOpenAI";
import { getComplaintGraph } from "../../lib/langgraph/graph";
import {
  AgentState,
  AgentResult,
  SentimentResult,
  OrchestratorAnalysis,
  SBARSummary,
} from "../../lib/langgraph/state";
import { Message } from "../../types";
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel Hobby plan max; upgrade to Pro for 300s

function sse(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

// Human-readable labels for each graph node
const NODE_META: Record<
  string,
  { label: string; description: string; icon: string }
> = {
  sentiment_analyzer: {
    label: "Sentiment Analyzer",
    description: "Detecting patient emotional state and tone",
    icon: "🧠",
  },
  orchestrator: {
    label: "Orchestrator",
    description: "Categorising issues, assigning priority, routing to specialists",
    icon: "🎯",
  },
  clinical_agent: {
    label: "Clinical Quality Agent",
    description: "Reviewing medical treatment and care concerns",
    icon: "🏥",
  },
  billing_agent: {
    label: "Billing & Financial Liaison",
    description: "Analysing billing, charges, and insurance issues",
    icon: "💳",
  },
  experience_agent: {
    label: "Patient Experience Agent",
    description: "Addressing hospitality, environment, and staff conduct",
    icon: "🌟",
  },
  compliance_agent: {
    label: "Compliance & Legal Risk Agent",
    description: "Scanning for legal risk, HIPAA issues, and regulatory compliance",
    icon: "⚖️",
  },
  scheduling_agent: {
    label: "Scheduling & Logistics Agent",
    description: "Investigating wait time, appointment, and referral issues",
    icon: "📅",
  },
  summary_agent: {
    label: "Summary Agent",
    description: "Condensing findings into SBAR format for staff",
    icon: "📋",
  },
  closer_agent: {
    label: "Closer Agent",
    description: "Preparing final empathetic response for patient",
    icon: "✉️",
  },
};

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  const { message, conversationHistory, existingComplaintId, userName } = (await req.json()) as {
    message: string;
    conversationHistory: Message[];
    existingComplaintId?: string | null;
    userName?: string | null;
  };
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(sse(data)));
      };

      try {
        const graph = getComplaintGraph();

        const detectedLanguage: "en" | "zh" = /[\u4e00-\u9fff]/.test(message) ? "zh" : "en";

        const initialState: Partial<AgentState> = {
          userMessage: message,
          detectedLanguage,
          conversationHistory: conversationHistory.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
          agentResults: [],
          complaintId: existingComplaintId ?? null,
          userId: userId,
        };

        // ── Phase 1: Stream graph execution (all analysis agents) ──────────
        const graphStream = await graph.stream(initialState, {
          streamMode: "updates",
        });

        let finalState: Partial<AgentState> = {};

        for await (const update of graphStream) {
          // update is { [nodeName]: stateUpdate }
          for (const [nodeName, nodeOutput] of Object.entries(update)) {
            const meta = NODE_META[nodeName];
            const output = nodeOutput as Partial<AgentState>;

            // Merge into final state
            finalState = { ...finalState, ...output };
            if (output.agentResults) {
              finalState.agentResults = [
                ...(finalState.agentResults ?? []),
                ...output.agentResults,
              ];
            }

            // Emit agent_start first, then agent_result with the output
            if (meta) {
              send({
                type: "agent_start",
                agent: nodeName,
                agentLabel: meta.label,
                description: meta.description,
              });
            }

            // Emit tool call events from agent results
            const latestAgentResult = output.agentResults?.[output.agentResults.length - 1];
            for (const tc of latestAgentResult?.toolCalls ?? []) {
              send({ type: "tool_start", tool: tc.tool, input: tc.input, agent: nodeName });
              send({ type: "tool_result", tool: tc.tool, output: tc.output, agent: nodeName });
            }

            // Emit a rich agent_result with the relevant data
            const resultPayload = buildResultPayload(nodeName, output);
            if (resultPayload) {
              send({
                type: "agent_result",
                agent: nodeName,
                agentLabel: meta?.label ?? nodeName,
                output: resultPayload,
              });
            }
          }
        }

        // ── Include complaint draft in done event (only when newly built) ──
        // The complaint is a draft at this point — it will only be persisted to the
        // database when the patient explicitly clicks "Submit Complaint".
        const isNewComplaint = finalState.complaintId && finalState.complaintId !== existingComplaintId;
        const complaintForDone = isNewComplaint ? (finalState.pendingComplaint ?? undefined) : undefined;

        // ── Phase 2: Stream final response tokens ──────────────────────────
        const closerContext = finalState.closerContext;
        if (!closerContext) {
          send({ type: "error", message: "Closer agent did not produce context." });
          send({ type: "done", fullResponse: "I'm sorry, something went wrong." });
          return;
        }

        const client = getAzureOpenAIClient();
        const chatHistory = (conversationHistory ?? []).slice(-6).map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

        const systemPrompt = userName
          ? `${closerContext}\n\nThe patient's registered name is "${userName}". Address them by their first name where natural.`
          : closerContext;

        const llmStream = await client.chat.completions.create({
          model: process.env.AZURE_OPENAI_DEPLOYMENT!,
          messages: [
            { role: "system", content: systemPrompt },
            ...chatHistory,
            { role: "user", content: message },
          ],
          stream: true,
          temperature: 0.6,
          max_tokens: 400,
        });

        let fullResponse = "";
        for await (const chunk of llmStream) {
          const token = chunk.choices[0]?.delta?.content;
          if (token) {
            fullResponse += token;
            send({ type: "token", content: token });
          }
        }

        // Generate 2-3 contextual follow-up suggestions
        let suggestions: string[] = [];
        try {
          const suggestionRes = await client.chat.completions.create({
            model: process.env.AZURE_OPENAI_DEPLOYMENT!,
            messages: [
              {
                role: "system",
                content: `You are a hospital patient complaints assistant. Based on the assistant's last reply, generate 2-3 short follow-up suggestions the patient might want to say next. Rules:
- Each suggestion must be under 9 words
- Use natural patient language (first-person where appropriate)
- Cover different angles: e.g. asking for status, requesting action, providing more detail
- Never repeat what was just said
- Return JSON only: { "suggestions": ["...", "...", "..."] }`,
              },
              {
                role: "user",
                content: `Assistant replied: "${fullResponse.slice(0, 400)}"\n\nGenerate follow-up suggestions.`,
              },
            ],
            response_format: { type: "json_object" },
            temperature: 0.8,
            max_tokens: 80,
          });
          const raw = suggestionRes.choices[0]?.message?.content ?? "{}";
          const parsed = JSON.parse(raw) as { suggestions?: unknown };
          if (Array.isArray(parsed.suggestions)) {
            suggestions = (parsed.suggestions as unknown[])
              .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
              .slice(0, 3);
          }
        } catch { /* suggestions remain empty */ }

        send({
          type: "done",
          fullResponse,
          ...(complaintForDone ? { complaint: complaintForDone, complaintId: finalState.complaintId } : {}),
          ...(suggestions.length > 0 ? { suggestions } : {}),
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "An unknown error occurred";
        send({ type: "error", message });
        send({ type: "done", fullResponse: "I'm sorry, I encountered an error. Please try again." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

function buildResultPayload(
  nodeName: string,
  output: Partial<AgentState>
): Record<string, unknown> | null {
  switch (nodeName) {
    case "sentiment_analyzer":
      return (output.sentiment ?? null) as unknown as Record<string, unknown>;

    case "orchestrator":
      return {
        ...((output.orchestratorAnalysis ?? {}) as unknown as Record<string, unknown>),
        complaintId: output.complaintId,
      };

    case "clinical_agent":
    case "billing_agent":
    case "experience_agent":
    case "compliance_agent":
    case "scheduling_agent": {
      const results = output.agentResults ?? [];
      const result = results[results.length - 1] as AgentResult | undefined;
      if (!result) return null;
      return {
        findings: result.findings,
        recommendedActions: result.recommendedActions,
        urgency: result.urgency,
        analysis: result.analysis,
        reasoning: result.reasoning,
        toolCalls: result.toolCalls ?? [],
      };
    }

    case "summary_agent":
      return (output.sbarSummary ?? null) as unknown as Record<string, unknown>;

    case "closer_agent":
      return { status: "Response context prepared" };

    default:
      return null;
  }
}

