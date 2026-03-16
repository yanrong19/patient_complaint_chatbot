import { ChatCompletionTool } from "openai/resources/chat/completions";
import {
  createComplaint,
  getComplaint,
  escalateComplaint,
  markAcknowledgementSent,
} from "./store";
import { ComplaintType, UrgencyLevel } from "../types";

export const toolDefinitions: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "log_complaint",
      description:
        "Creates a new patient complaint record in the system. Use this when a patient describes a complaint that needs to be formally logged.",
      parameters: {
        type: "object",
        properties: {
          patient_name: {
            type: "string",
            description: "Full name of the patient submitting the complaint",
          },
          complaint_type: {
            type: "string",
            enum: ["billing", "clinical", "staff", "facility", "other"],
            description: "Category of the complaint",
          },
          description: {
            type: "string",
            description: "Detailed description of the complaint",
          },
          urgency: {
            type: "string",
            enum: ["low", "medium", "high"],
            description:
              "Urgency level: high for safety/clinical concerns, medium for significant issues, low for general feedback",
          },
        },
        required: ["patient_name", "complaint_type", "description", "urgency"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_complaint_status",
      description:
        "Looks up the current status of an existing complaint by its ID.",
      parameters: {
        type: "object",
        properties: {
          complaint_id: {
            type: "string",
            description: "The complaint ID (e.g. COMP-2024-1001)",
          },
        },
        required: ["complaint_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "escalate_to_human",
      description:
        "Escalates a complaint to a human staff member for urgent follow-up. Use for high urgency cases, safety concerns, or when the patient is very distressed.",
      parameters: {
        type: "object",
        properties: {
          complaint_id: {
            type: "string",
            description: "The complaint ID to escalate",
          },
          reason: {
            type: "string",
            description: "Reason for escalation",
          },
        },
        required: ["complaint_id", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_acknowledgement_email",
      description:
        "Sends a mock acknowledgement email to the patient confirming their complaint was received.",
      parameters: {
        type: "object",
        properties: {
          complaint_id: {
            type: "string",
            description: "The complaint ID",
          },
          patient_email: {
            type: "string",
            description: "Patient's email address",
          },
          patient_name: {
            type: "string",
            description: "Patient's full name",
          },
        },
        required: ["complaint_id", "patient_email", "patient_name"],
      },
    },
  },
];

export type ToolInput = Record<string, unknown>;
export type ToolOutput = Record<string, unknown>;

export async function executeTool(toolName: string, input: ToolInput): Promise<ToolOutput> {
  switch (toolName) {
    case "log_complaint": {
      const { patient_name, complaint_type, description, urgency } = input as {
        patient_name: string;
        complaint_type: ComplaintType;
        description: string;
        urgency: UrgencyLevel;
      };
      return createComplaint(patient_name, complaint_type, description, urgency);
    }

    case "check_complaint_status": {
      const { complaint_id } = input as { complaint_id: string };
      const complaint = await getComplaint(complaint_id);
      if (!complaint) {
        return { error: `No complaint found with ID ${complaint_id}` };
      }
      return {
        complaint_id: complaint.complaint_id,
        status: complaint.status,
        assigned_team: complaint.assigned_team,
        last_updated: complaint.last_updated,
        escalated: complaint.escalated,
        urgency: complaint.urgency,
      };
    }

    case "escalate_to_human": {
      const { complaint_id, reason } = input as {
        complaint_id: string;
        reason: string;
      };
      return escalateComplaint(complaint_id, reason);
    }

    case "send_acknowledgement_email": {
      const { complaint_id, patient_email, patient_name } = input as {
        complaint_id: string;
        patient_email: string;
        patient_name: string;
      };
      return markAcknowledgementSent(complaint_id, patient_email, patient_name);
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}
