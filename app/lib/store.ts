import { Complaint, ComplaintType, UrgencyLevel } from "../types";
import { prisma } from "./db";

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

function toComplaint(row: {
  complaintId: string;
  patientName: string;
  complaintType: string;
  description: string;
  urgency: string;
  status: string;
  assignedTeam: string;
  createdAt: Date;
  lastUpdated: Date;
  escalated: boolean;
  escalationReason: string | null;
  acknowledgementSent: boolean;
}): Complaint {
  return {
    complaint_id: row.complaintId,
    patient_name: row.patientName,
    complaint_type: row.complaintType as ComplaintType,
    description: row.description,
    urgency: row.urgency as UrgencyLevel,
    status: row.status as Complaint["status"],
    assigned_team: row.assignedTeam,
    created_at: row.createdAt.toISOString(),
    last_updated: row.lastUpdated.toISOString(),
    escalated: row.escalated,
    escalation_reason: row.escalationReason ?? undefined,
    acknowledgement_sent: row.acknowledgementSent,
  };
}

/** Build a complaint object in memory — does NOT write to the database. */
export function buildComplaint(
  patient_name: string,
  complaint_type: ComplaintType,
  description: string,
  urgency: UrgencyLevel
): Complaint {
  const complaint_id = generateComplaintId();
  const now = new Date().toISOString();
  return {
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
}

/** Persist a previously built complaint to the database. */
export async function persistComplaint(
  complaint: Complaint,
  userId?: string | null
): Promise<void> {
  await prisma.complaint.create({
    data: {
      complaintId: complaint.complaint_id,
      patientName: complaint.patient_name,
      complaintType: complaint.complaint_type,
      description: complaint.description,
      urgency: complaint.urgency,
      status: complaint.status,
      assignedTeam: complaint.assigned_team,
      escalated: complaint.escalated,
      acknowledgementSent: complaint.acknowledgement_sent,
      userId: userId ?? null,
    },
  });
}

/** @deprecated Use buildComplaint + persistComplaint instead. */
export async function createComplaint(
  patient_name: string,
  complaint_type: ComplaintType,
  description: string,
  urgency: UrgencyLevel,
  userId?: string | null
): Promise<{ complaint_id: string; timestamp: string }> {
  const complaint = buildComplaint(patient_name, complaint_type, description, urgency);
  await persistComplaint(complaint, userId);
  return { complaint_id: complaint.complaint_id, timestamp: complaint.created_at };
}

export async function getComplaint(complaint_id: string): Promise<Complaint | undefined> {
  const row = await prisma.complaint.findUnique({ where: { complaintId: complaint_id } });
  if (!row) return undefined;
  return toComplaint(row);
}

export async function escalateComplaint(
  complaint_id: string,
  reason: string
): Promise<{ success: boolean; estimated_response_time: string; message: string }> {
  const existing = await prisma.complaint.findUnique({ where: { complaintId: complaint_id } });
  if (!existing) {
    return { success: false, estimated_response_time: "", message: `Complaint ${complaint_id} not found.` };
  }

  await prisma.complaint.update({
    where: { complaintId: complaint_id },
    data: { escalated: true, escalationReason: reason, status: "under_review" },
  });

  return {
    success: true,
    estimated_response_time: "within 2 hours",
    message: `Complaint ${complaint_id} has been escalated. A representative will follow up ${existing.urgency === "high" ? "within 30 minutes" : "within 2 hours"}.`,
  };
}

export async function markAcknowledgementSent(
  complaint_id: string,
  patient_email: string,
  patient_name: string
): Promise<{ success: boolean; message: string }> {
  const existing = await prisma.complaint.findUnique({ where: { complaintId: complaint_id } });
  if (!existing) {
    return { success: false, message: `Complaint ${complaint_id} not found.` };
  }

  await prisma.complaint.update({
    where: { complaintId: complaint_id },
    data: { acknowledgementSent: true },
  });

  console.log(`[MOCK EMAIL] Acknowledgement sent to ${patient_name} <${patient_email}> for complaint ${complaint_id}`);
  return {
    success: true,
    message: `Acknowledgement email sent to ${patient_name} at ${patient_email} for complaint ${complaint_id}.`,
  };
}

export async function getComplaintsByUser(userId: string): Promise<Complaint[]> {
  const rows = await prisma.complaint.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toComplaint);
}

export async function deleteComplaint(complaint_id: string, userId: string): Promise<boolean> {
  const row = await prisma.complaint.findUnique({ where: { complaintId: complaint_id } });
  // Only allow deletion by the owning user
  if (!row || row.userId !== userId) return false;
  await prisma.complaint.delete({ where: { complaintId: complaint_id } });
  return true;
}

export async function getAllComplaints(): Promise<Complaint[]> {
  const rows = await prisma.complaint.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map(toComplaint);
}
