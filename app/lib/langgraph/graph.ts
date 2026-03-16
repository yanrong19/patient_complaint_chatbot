import { StateGraph, START, END, Send } from "@langchain/langgraph";
import { AgentStateAnnotation, AgentState, AgentCategory } from "./state";
import { sentimentAnalyzerNode } from "./nodes/sentimentAnalyzer";
import { orchestratorNode } from "./nodes/orchestrator";
import { clinicalAgentNode } from "./nodes/clinicalAgent";
import { billingAgentNode } from "./nodes/billingAgent";
import { experienceAgentNode } from "./nodes/experienceAgent";
import { complianceAgentNode } from "./nodes/complianceAgent";
import { schedulingAgentNode } from "./nodes/schedulingAgent";
import { summaryAgentNode } from "./nodes/summaryAgent";
import { closerAgentNode } from "./nodes/closerAgent";

const AGENT_NODE_MAP: Record<AgentCategory, string> = {
  clinical: "clinical_agent",
  billing: "billing_agent",
  experience: "experience_agent",
  compliance: "compliance_agent",
  scheduling: "scheduling_agent",
};

// Conditional routing from orchestrator → worker agents (parallel fan-out)
function routeAfterOrchestrator(state: AgentState): Send[] {
  const assigned = state.orchestratorAnalysis?.assignedAgents ?? [];

  if (assigned.length === 0) {
    // No specialist needed — route directly to summary
    return [new Send("summary_agent", state)];
  }

  return assigned.map(
    (category) => new Send(AGENT_NODE_MAP[category as AgentCategory], state)
  );
}

// All worker agents fan back in to summary_agent
// LangGraph waits for all parallel Send branches before continuing

export function buildComplaintGraph() {
  const graph = new StateGraph(AgentStateAnnotation)
    // ── Utility agents ──────────────────────────────────────────────────
    .addNode("sentiment_analyzer", sentimentAnalyzerNode)
    .addNode("summary_agent", summaryAgentNode)
    .addNode("closer_agent", closerAgentNode)
    // ── Orchestrator ─────────────────────────────────────────────────────
    .addNode("orchestrator", orchestratorNode)
    // ── Specialist worker agents ─────────────────────────────────────────
    .addNode("clinical_agent", clinicalAgentNode)
    .addNode("billing_agent", billingAgentNode)
    .addNode("experience_agent", experienceAgentNode)
    .addNode("compliance_agent", complianceAgentNode)
    .addNode("scheduling_agent", schedulingAgentNode)

    // ── Edges ─────────────────────────────────────────────────────────────
    .addEdge(START, "sentiment_analyzer")
    .addEdge("sentiment_analyzer", "orchestrator")

    // Orchestrator fans out to worker agents (or directly to summary if none needed)
    .addConditionalEdges("orchestrator", routeAfterOrchestrator)

    // All worker agents fan back in to summary_agent
    .addEdge("clinical_agent", "summary_agent")
    .addEdge("billing_agent", "summary_agent")
    .addEdge("experience_agent", "summary_agent")
    .addEdge("compliance_agent", "summary_agent")
    .addEdge("scheduling_agent", "summary_agent")

    .addEdge("summary_agent", "closer_agent")
    .addEdge("closer_agent", END);

  return graph.compile();
}

// Compile a fresh graph per request — sharing a compiled graph across concurrent
// requests can corrupt LangGraph's internal channel state.
export function getComplaintGraph() {
  return buildComplaintGraph();
}
