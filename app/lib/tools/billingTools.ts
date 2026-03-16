import { ToolCallRecord } from "../langgraph/state";

export function runBillingTools(_state: { userMessage: string }): ToolCallRecord[] {
  const ts = new Date().toISOString();
  return [
    { tool: "get_patient_billing_statement",  label: "Get Patient Billing Statement",  input: { patient_id: "current session" }, output: { status: "success", invoked_at: ts } },
    { tool: "check_billing_codes",            label: "Check Billing Codes",            input: { claim_id: "current session" },   output: { status: "success", invoked_at: ts } },
    { tool: "check_financial_aid_eligibility",label: "Check Financial Aid Eligibility",input: { patient_id: "current session" }, output: { status: "success", invoked_at: ts } },
  ];
}
