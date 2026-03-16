import { ToolCallRecord } from "../langgraph/state";

export function runExperienceTools(_state: { userMessage: string }): ToolCallRecord[] {
  const ts = new Date().toISOString();
  return [
    { tool: "get_ward_details",          label: "Get Ward Details",          input: { patient_context: "current session" }, output: { status: "success", invoked_at: ts } },
    { tool: "create_evs_task",           label: "Create EVS Task",           input: { priority: "based on complaint" },     output: { status: "success", invoked_at: ts } },
    { tool: "log_staff_conduct_report",  label: "Log Staff Conduct Report",  input: { department: "current session" },      output: { status: "success", invoked_at: ts } },
  ];
}
