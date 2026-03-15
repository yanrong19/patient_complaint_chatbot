import { Complaint, ComplaintType, UrgencyLevel } from "../types";

const complaintStore = new Map<string, Complaint>();
let complaintCounter = 1000;

function generateComplaintId(): string {
  complaintCounter += 1;
  return `COMP-2024-${complaintCounter}`;
}

function getAssignedTeam(type: ComplaintType, urgency: UrgencyLevel): string {
  const teamMap: Record<ComplaintType, string> = {
    billing: "Billing & Finance Team",
    clinical: "Clinical Quality Team",
    staff: "HR & Patient Relations",
    facility: "Facilities Management",
    other: "General Patient Services",
  };
  const team = teamMap[type];
  if (urgency === "high") return `${team} (Priority)`;
  return team;
}

export function createComplaint(
  patient_name: string,
  complaint_type: ComplaintType,
  description: string,
  urgency: UrgencyLevel
): { complaint_id: string; timestamp: string } {
  const complaint_id = generateComplaintId();
  const now = new Date().toISOString();
  const complaint: Complaint = {
    complaint_id,
    patient_name,
    complaint_type,
    description,
    urgency,
    status: "received",
    assigned_team: getAssignedTeam(complaint_type, urgency),
    created_at: now,
    last_updated: now,
    escalated: false,
    acknowledgement_sent: false,
  };
  complaintStore.set(complaint_id, complaint);
  return { complaint_id, timestamp: now };
}

export function getComplaint(complaint_id: string): Complaint | undefined {
  return complaintStore.get(complaint_id);
}

export function escalateComplaint(
  complaint_id: string,
  reason: string
): { success: boolean; estimated_response_time: string; message: string } {
  const complaint = complaintStore.get(complaint_id);
  if (!complaint) {
    return {
      success: false,
      estimated_response_time: "",
      message: `Complaint ${complaint_id} not found.`,
    };
  }
  complaint.escalated = true;
  complaint.escalation_reason = reason;
  complaint.status = "under_review";
  complaint.last_updated = new Date().toISOString();
  complaintStore.set(complaint_id, complaint);
  return {
    success: true,
    estimated_response_time: "within 2 hours",
    message: `Complaint ${complaint_id} has been escalated to senior staff. A human representative will follow up ${complaint.urgency === "high" ? "within 30 minutes" : "within 2 hours"}.`,
  };
}

export function markAcknowledgementSent(
  complaint_id: string,
  patient_email: string,
  patient_name: string
): { success: boolean; message: string } {
  const complaint = complaintStore.get(complaint_id);
  if (!complaint) {
    return {
      success: false,
      message: `Complaint ${complaint_id} not found.`,
    };
  }
  complaint.acknowledgement_sent = true;
  complaint.last_updated = new Date().toISOString();
  complaintStore.set(complaint_id, complaint);
  console.log(
    `[MOCK EMAIL] Acknowledgement sent to ${patient_name} <${patient_email}> for complaint ${complaint_id}`
  );
  return {
    success: true,
    message: `Acknowledgement email sent to ${patient_name} at ${patient_email} for complaint ${complaint_id}.`,
  };
}

export function getAllComplaints(): Complaint[] {
  return Array.from(complaintStore.values());
}
