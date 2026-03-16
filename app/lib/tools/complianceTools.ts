import { ToolCallRecord } from "../langgraph/state";

export function runComplianceTools(_state: { userMessage: string }): ToolCallRecord[] {
  const ts = new Date().toISOString();
  return [
    { tool: "scan_legal_risk_keywords",     label: "Scan Legal Risk Keywords",     input: { text: "message content" },      output: { status: "success", invoked_at: ts } },
    { tool: "escalate_to_risk_management",  label: "Escalate to Risk Management",  input: { summary: "complaint summary" }, output: { status: "success", invoked_at: ts } },
    { tool: "apply_legal_hold",             label: "Apply Legal Hold",             input: { patient_id: "current session" }, output: { status: "success", invoked_at: ts } },
  ];
}
