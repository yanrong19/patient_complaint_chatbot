"use client";

import { useState, useEffect } from "react";
import { Complaint, ComplaintStatus, UrgencyLevel } from "../types";

interface ComplaintCardProps {
  complaint: Complaint;
}

const STATUS_CONFIG: Record<ComplaintStatus, { label: string; color: string; bg: string }> = {
  received:     { label: "Received",     color: "text-blue-700",   bg: "bg-blue-100"   },
  under_review: { label: "Under Review", color: "text-amber-700",  bg: "bg-amber-100"  },
  resolved:     { label: "Resolved",     color: "text-green-700",  bg: "bg-green-100"  },
};

const URGENCY_CONFIG: Record<UrgencyLevel, { label: string; color: string; dot: string }> = {
  low:    { label: "Low",    color: "text-slate-500",  dot: "bg-slate-400"  },
  medium: { label: "Medium", color: "text-amber-700",  dot: "bg-amber-500"  },
  high:   { label: "High",   color: "text-red-700",    dot: "bg-red-500"    },
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: false,
    });
  } catch {
    return iso;
  }
}

function isComplaintSubmitted(id: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const saved = sessionStorage.getItem("kira-submitted-complaints");
    return saved ? (JSON.parse(saved) as string[]).includes(id) : false;
  } catch { return false; }
}

function markComplaintSubmitted(id: string) {
  try {
    const saved = sessionStorage.getItem("kira-submitted-complaints");
    const ids: string[] = saved ? JSON.parse(saved) : [];
    if (!ids.includes(id)) ids.push(id);
    sessionStorage.setItem("kira-submitted-complaints", JSON.stringify(ids));
  } catch {}
}

export default function ComplaintCard({ complaint }: ComplaintCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    if (isComplaintSubmitted(complaint.complaint_id)) setSubmitted(true);
  }, [complaint.complaint_id]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const status = STATUS_CONFIG[complaint.status] ?? STATUS_CONFIG.received;
  const urgency = URGENCY_CONFIG[complaint.urgency] ?? URGENCY_CONFIG.medium;

  // ── Submitted confirmation state ─────────────────────────────────────────
  if (submitted) {
    return (
      <div className="mt-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
            className="w-4 h-4 text-green-600 flex-shrink-0">
            <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="text-xs font-semibold text-green-700">Complaint Submitted</p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Reference: <span className="font-mono text-green-700">{complaint.complaint_id}</span> · {complaint.assigned_team} will follow up
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Draft / pending state ─────────────────────────────────────────────────
  return (
    <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50/60 overflow-hidden text-left shadow-sm">
      {/* Header row — always visible */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-sky-100/60 transition-colors text-left"
      >
        <div className="w-7 h-7 rounded-lg bg-sky-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
            className="w-4 h-4 text-sky-600">
            <path fillRule="evenodd" d="M4 4a2 2 0 0 1 2-2h4.586A2 2 0 0 1 12 2.586L15.414 6A2 2 0 0 1 16 7.414V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Zm2 6a.75.75 0 0 1 .75-.75h6.5a.75.75 0 0 1 0 1.5h-6.5A.75.75 0 0 1 6 10Zm.75 2.25a.75.75 0 0 0 0 1.5h3.5a.75.75 0 0 0 0-1.5h-3.5Z" clipRule="evenodd" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-sky-700 font-mono">{complaint.complaint_id}</span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${status.bg} ${status.color}`}>
              {status.label}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 truncate mt-0.5">{complaint.description}</p>
        </div>

        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
          className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>
          <path fillRule="evenodd" d="M9.47 6.47a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 1 1-1.06 1.06L10 8.06l-3.72 3.72a.75.75 0 0 1-1.06-1.06l4.25-4.25Z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-sky-100 space-y-2">
          <Row label="Patient"      value={complaint.patient_name} />
          <Row label="Type"         value={complaint.complaint_type} capitalize />
          <Row label="Assigned To"  value={complaint.assigned_team} />
          <Row label="Description"  value={complaint.description} multiline />
          <Row label="Logged"       value={formatDate(complaint.created_at)} />
          {complaint.escalated && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-2.5 py-2">
              <p className="text-[10px] font-semibold text-red-700 uppercase tracking-wide mb-0.5">Escalated</p>
              {complaint.escalation_reason && (
                <p className="text-xs text-slate-600">{complaint.escalation_reason}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Submit footer */}
      <div className="px-3 py-2.5 border-t border-sky-100 space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] text-slate-500">
            Would you like to formally submit this complaint?
          </p>
          <button
            onClick={async () => {
              setSubmitError("");
              setSubmitting(true);
              try {
                const res = await fetch("/api/complaints/submit", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(complaint),
                });
                if (!res.ok) throw new Error("Submission failed.");
                markComplaintSubmitted(complaint.complaint_id);
                setSubmitted(true);
              } catch {
                setSubmitError("Could not submit. Please try again.");
              } finally {
                setSubmitting(false);
              }
            }}
            disabled={submitting}
            className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold bg-sky-500 hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            {submitting ? "Submitting…" : "Submit Complaint"}
          </button>
        </div>
        {submitError && (
          <p className="text-[10px] text-red-600">{submitError}</p>
        )}
      </div>
    </div>
  );
}

function Row({
  label, value, capitalize, multiline,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
  multiline?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <span className="text-[9px] text-slate-500 uppercase tracking-wide font-medium w-20 flex-shrink-0 pt-0.5">
        {label}
      </span>
      <span className={`text-xs text-slate-700 flex-1 ${capitalize ? "capitalize" : ""} ${multiline ? "whitespace-pre-wrap" : "truncate"}`}>
        {value}
      </span>
    </div>
  );
}
