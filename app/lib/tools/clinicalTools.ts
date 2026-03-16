import { ToolCallRecord } from "../langgraph/state";

export function runClinicalTools(_state: { userMessage: string; coreIssues?: string[] }): ToolCallRecord[] {
  const ts = new Date().toISOString();
  return [
    { tool: "get_patient_ehr",         label: "Get Patient EHR",         input: { patient_context: "current session" }, output: { status: "success", invoked_at: ts } },
    { tool: "flag_clinical_incident",  label: "Flag Clinical Incident",  input: { issue: "clinical concern" },          output: { status: "success", invoked_at: ts } },
    { tool: "get_clinical_guidelines", label: "Get Clinical Guidelines", input: { domain: "post-operative medication" }, output: { status: "success", invoked_at: ts } },
  ];
}
