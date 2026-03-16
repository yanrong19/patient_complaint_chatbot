"use server";
import { AgentState } from "../state";
import { sentimentAnalyzerNode } from "./sentimentAnalyzer";
import { orchestratorNode } from "./orchestrator";

/**
 * Runs sentiment analysis and orchestration in parallel (Promise.all).
 * Saves ~1-2s vs the previous sequential sentiment → orchestrator chain.
 *
 * The orchestrator runs without sentiment context (handled gracefully via its
 * "Sentiment not yet analyzed" fallback). All downstream nodes still receive
 * the full sentiment result because it is merged into the returned state.
 */
export async function intakeNode(
  state: AgentState
): Promise<Partial<AgentState>> {
  const [sentimentResult, orchestratorResult] = await Promise.all([
    sentimentAnalyzerNode(state),
    orchestratorNode(state),
  ]);
  // sentiment: { sentiment }
  // orchestrator: { orchestratorAnalysis, complaintId, pendingComplaint }
  // No key conflicts — safe to merge.
  return { ...sentimentResult, ...orchestratorResult };
}
