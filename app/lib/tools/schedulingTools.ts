import { ToolCallRecord } from "../langgraph/state";

export function runSchedulingTools(_state: { userMessage: string; coreIssues?: string[] }): ToolCallRecord[] {
  const ts = new Date().toISOString();
  return [
    { tool: "get_appointment_history", label: "Get Appointment History", input: { patient_id: "current session" },       output: { status: "success", invoked_at: ts } },
    { tool: "get_department_capacity", label: "Get Department Capacity", input: { department: "current session" },       output: { status: "success", invoked_at: ts } },
    { tool: "offer_priority_slot",     label: "Offer Priority Slot",     input: { urgency: "based on complaint urgency" }, output: { status: "success", invoked_at: ts } },
  ];
}
