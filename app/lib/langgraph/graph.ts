import { StateGraph, START, END, Send } from "@langchain/langgraph";
import { AgentStateAnnotation, AgentState, AgentCategory } from "./state";
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

function routeAfterOrchestrator(state: AgentState): Send[] {
  const analysis = state.orchestratorAnalysis;
  const assigned = analysis?.assignedAgents ?? [];

  if (assigned.length === 0) {
    // Non-complaint (greeting, question, etc.) — skip summary, go straight to closer
    if (!analysis?.isComplaint) {
      return [new Send("closer_agent", state)];
    }
    // Complaint with no matched specialist — run summary for SBAR
    return [new Send("summary_agent", state)];
  }

  // Fan out to relevant specialist agents in parallel
  return assigned.map(
    (category) => new Send(AGENT_NODE_MAP[category as AgentCategory], state)
  );
}

export function buildComplaintGraph() {
  const graph = new StateGraph(AgentStateAnnotation)
    // ── Orchestrator (runs sentiment analysis internally as a tool) ──────
    .addNode("orchestrator", orchestratorNode)
    // ── Specialist worker agents ─────────────────────────────────────────
    .addNode("clinical_agent", clinicalAgentNode)
    .addNode("billing_agent", billingAgentNode)
    .addNode("experience_agent", experienceAgentNode)
    .addNode("compliance_agent", complianceAgentNode)
    .addNode("scheduling_agent", schedulingAgentNode)
    // ── Utility agents ───────────────────────────────────────────────────
    .addNode("summary_agent", summaryAgentNode)
    .addNode("closer_agent", closerAgentNode)

    // ── Edges ─────────────────────────────────────────────────────────────
    .addEdge(START, "orchestrator")
    .addConditionalEdges("orchestrator", routeAfterOrchestrator)

    .addEdge("clinical_agent", "summary_agent")
    .addEdge("billing_agent", "summary_agent")
    .addEdge("experience_agent", "summary_agent")
    .addEdge("compliance_agent", "summary_agent")
    .addEdge("scheduling_agent", "summary_agent")

    .addEdge("summary_agent", "closer_agent")
    .addEdge("closer_agent", END);

  return graph.compile();
}

export function getComplaintGraph() {
  return buildComplaintGraph();
}
